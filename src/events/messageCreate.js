const { addChatXP } = require('../handlers/xp');
const { db } = require('../database/db');

// Cache for excluded channels and roles to reduce database queries
const excludedChannelsCache = new Map(); // guildId -> Set of channelIds
const excludedRolesCache = new Map();    // guildId -> Set of roleIds
const settingsCache = new Map();         // guildId -> settings object
const cacheTTL = 5 * 60 * 1000;          // 5 minutes cache TTL

// Export the module with the event handler and caches
module.exports = {
  name: 'messageCreate',
  // Export caches so they can be cleared by the cache handler
  settingsCache,
  excludedChannelsCache,
  excludedRolesCache,
  async execute(message, client) {
    try {
      // Skip bot messages
      if (message.author.bot) return;
      
      // Skip DMs or invalid guilds
      if (!message.guild || !message.guild.id) return;
      
      const guildId = message.guild.id;
      
      // Get guild settings (from cache or database)
      const settings = await getGuildSettings(guildId);
      if (!settings) return;
      
      // Check if channel is excluded (from cache or database)
      const excludedChannels = await getExcludedChannels(guildId);
      if (excludedChannels.has(message.channel.id)) {
        return; // Skip excluded channels
      }
      
      // Get member if not already cached
      const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
      if (!member) return; // Skip if member can't be fetched
      
      // Check if user has an excluded role
      const excludedRoles = await getExcludedRoles(guildId);
      const hasExcludedRole = member.roles.cache.some(role => excludedRoles.has(role.id));
      if (hasExcludedRole) {
        return; // Skip users with excluded roles
      }
      
      // Check cooldown
      const user = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?')
        .get(message.author.id, guildId);
      
      const now = Date.now();
      
      if (user && user.last_message_time) {
        const cooldownEnd = user.last_message_time + (settings.message_cooldown * 1000);
        if (now < cooldownEnd) return; // Still in cooldown
      }
      
      // Update last message time
      if (user) {
        db.prepare('UPDATE users SET last_message_time = ? WHERE user_id = ? AND guild_id = ?')
          .run(now, message.author.id, guildId);
      } else {
        // Create new user if they don't exist
        db.prepare(`
          INSERT INTO users (user_id, guild_id, chat_xp, voice_xp, chat_level, voice_level, last_message_time, last_voice_time)
          VALUES (?, ?, 0, 0, 0, 0, ?, 0)
        `).run(message.author.id, guildId, now);
      }
      
      // Add XP with multiplier
      const levelUp = await addChatXP(message.author.id, guildId, settings.xp_multiplier || 1.0);
      
      // Handle level up and role rewards
      if (levelUp) {
        // Check for role rewards
        const roleRewards = db.prepare(`
          SELECT * FROM role_rewards 
          WHERE guild_id = ? 
          AND level <= ? 
          AND (type = 'chat' OR type = 'both')
          ORDER BY level DESC
        `).all(guildId, levelUp.newLevel);
        
        // Apply role rewards
        for (const reward of roleRewards) {
          if (!member.roles.cache.has(reward.role_id)) {
            try {
              await member.roles.add(reward.role_id);
            } catch (error) {
              console.error(`Failed to add role ${reward.role_id} to user ${message.author.id}:`, error);
            }
          }
        }
        
        // Send level up announcement
        if (settings.enable_announcements) {
          try {
            const channel = settings.announcement_channel ? 
              message.guild.channels.cache.get(settings.announcement_channel) : 
              message.channel;
              
            if (channel && channel.isTextBased()) {
              const announceMessage = settings.announcement_message
                .replace('{user}', message.author.toString())
                .replace('{currentlevel}', levelUp.newLevel)
                .replace('{type}', 'chat');
                
              await channel.send(announceMessage);
            }
          } catch (error) {
            console.error(`Error sending level up announcement: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.error('Error in messageCreate event:', error);
    }
  },
};

/**
 * Get guild settings from cache or database
 */
async function getGuildSettings(guildId) {
  // Check cache first
  const cachedSettings = settingsCache.get(guildId);
  if (cachedSettings && cachedSettings.timestamp > Date.now() - cacheTTL) {
    return cachedSettings.data;
  }
  
  // Get from database
  const settings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
  
  // Update cache
  if (settings) {
    settingsCache.set(guildId, {
      data: settings,
      timestamp: Date.now()
    });
  }
  
  return settings;
}

/**
 * Get excluded channels from cache or database
 */
async function getExcludedChannels(guildId) {
  // Check cache first
  const cachedChannels = excludedChannelsCache.get(guildId);
  if (cachedChannels && cachedChannels.timestamp > Date.now() - cacheTTL) {
    return cachedChannels.data;
  }
  
  // Get from database
  const excludedChannelsData = db.prepare('SELECT channel_id FROM excluded_channels WHERE guild_id = ?').all(guildId);
  const excludedChannels = new Set(excludedChannelsData.map(item => item.channel_id));
  
  // Update cache
  excludedChannelsCache.set(guildId, {
    data: excludedChannels,
    timestamp: Date.now()
  });
  
  return excludedChannels;
}

/**
 * Get excluded roles from cache or database
 */
async function getExcludedRoles(guildId) {
  // Check cache first
  const cachedRoles = excludedRolesCache.get(guildId);
  if (cachedRoles && cachedRoles.timestamp > Date.now() - cacheTTL) {
    return cachedRoles.data;
  }
  
  // Get from database
  const excludedRolesData = db.prepare('SELECT role_id FROM excluded_roles WHERE guild_id = ?').all(guildId);
  const excludedRoles = new Set(excludedRolesData.map(item => item.role_id));
  
  // Update cache
  excludedRolesCache.set(guildId, {
    data: excludedRoles,
    timestamp: Date.now()
  });
  
  return excludedRoles;
}