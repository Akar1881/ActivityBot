const { addVoiceXP } = require('../handlers/xp');
const { db } = require('../database/db');
const { addUserToVoiceCache, removeUserFromVoiceCache } = require('../handlers/voiceTimer');

// Share the same cache with messageCreate.js
// If these files are loaded separately, each will have its own cache instance
// This is fine as they'll just populate their own caches
const excludedChannelsCache = new Map(); // guildId -> Set of channelIds
const excludedRolesCache = new Map();    // guildId -> Set of roleIds
const settingsCache = new Map();         // guildId -> settings object
const cacheTTL = 5 * 60 * 1000;          // 5 minutes cache TTL

// Export the module with the event handler and caches
module.exports = {
  name: 'voiceStateUpdate',
  // Export caches so they can be cleared by the cache handler
  settingsCache,
  excludedChannelsCache,
  excludedRolesCache,
  async execute(oldState, newState, client) {
    try {
      // Skip if the channel hasn't changed
      if (oldState.channelId === newState.channelId) return;
      
      // Skip if the member is a bot
      if (newState.member?.user?.bot) return;
      
      // Ensure we have a valid guild
      if (!newState.guild || !newState.guild.id) {
        return;
      }

      const guildId = newState.guild.id;
      
      // Get guild settings (from cache or database)
      const settings = await getGuildSettings(guildId);
      if (!settings) return;

      // User joined a voice channel or switched channels
      if (newState.channelId) {
        try {
          // Check if the voice channel is excluded (from cache or database)
          const excludedChannels = await getExcludedChannels(guildId);
          if (excludedChannels.has(newState.channelId)) {
            return; // Skip excluded channels
          }

          // Check if user has an excluded role
          const excludedRoles = await getExcludedRoles(guildId);
          const hasExcludedRole = newState.member.roles.cache.some(role => excludedRoles.has(role.id));
          if (hasExcludedRole) {
            return; // Skip users with excluded roles
          }

          const now = Date.now();
          
          // Check if user exists in the database
          const user = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?')
            .get(newState.member.id, guildId);
            
          if (!user) {
            // Create new user entry if they don't exist
            db.prepare(`
              INSERT INTO users (user_id, guild_id, chat_xp, voice_xp, chat_level, voice_level, last_message_time, last_voice_time)
              VALUES (?, ?, 0, 0, 0, 0, 0, ?)
            `).run(newState.member.id, guildId, now);
            
            // Add user to voice cache for periodic XP awards
            addUserToVoiceCache(newState.member.id, guildId, now);
          } else if (!oldState.channelId) {
            // Only update the time if they're newly joining voice, not switching channels
            db.prepare('UPDATE users SET last_voice_time = ? WHERE user_id = ? AND guild_id = ?')
              .run(now, newState.member.id, guildId);
              
            // Add user to voice cache for periodic XP awards
            addUserToVoiceCache(newState.member.id, guildId, now);
          } else {
            // User is switching channels, update the voice cache
            addUserToVoiceCache(newState.member.id, guildId, now);
          }
        } catch (error) {
          console.error(`Error handling user joining voice channel: ${error.message}`);
        }
      }

      // User left a voice channel or switched channels
      if (oldState.channelId && (oldState.channelId !== newState.channelId)) {
        try {
          const oldGuildId = oldState.guild.id;
          
          // Check if the voice channel they're leaving is excluded
          const excludedChannels = await getExcludedChannels(oldGuildId);
          if (excludedChannels.has(oldState.channelId)) {
            return; // Skip excluded channels
          }

          // Check if user has an excluded role
          const excludedRoles = await getExcludedRoles(oldGuildId);
          const hasExcludedRole = oldState.member.roles.cache.some(role => excludedRoles.has(role.id));
          if (hasExcludedRole) {
            return; // Skip users with excluded roles
          }

          const user = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?')
            .get(oldState.member.id, oldGuildId);

          if (!user || !user.last_voice_time) {
            return; // No valid user data
          }
          
          // Only process XP if they're fully leaving voice, not switching channels
          if (!newState.channelId) {
            // Remove user from voice cache
            removeUserFromVoiceCache(oldState.member.id, oldGuildId);
            
            const currentTime = Date.now();
            const minutesInVoice = Math.floor((currentTime - user.last_voice_time) / 60000);
            
            if (minutesInVoice >= settings.min_voice_minutes_to_earn) {
              const effectiveMinutes = Math.min(minutesInVoice, settings.max_voice_minutes_to_earn);
              
              try {
                const levelUp = await addVoiceXP(
                  oldState.member.id, 
                  oldGuildId, 
                  effectiveMinutes, 
                  settings.xp_multiplier || 1.0
                );

                if (levelUp) {
                  // Check for role rewards
                  try {
                    const roleRewards = db.prepare(`
                      SELECT * FROM role_rewards 
                      WHERE guild_id = ? 
                      AND level <= ? 
                      AND (type = 'voice' OR type = 'both')
                      ORDER BY level DESC
                    `).all(oldGuildId, levelUp.newLevel);

                    // Apply role rewards
                    for (const reward of roleRewards) {
                      try {
                        const member = await oldState.guild.members.fetch(oldState.member.id);
                        if (!member.roles.cache.has(reward.role_id)) {
                          await member.roles.add(reward.role_id);
                        }
                      } catch (roleError) {
                        console.error(`Failed to add role ${reward.role_id} to user ${oldState.member.id}:`, roleError);
                      }
                    }
                  } catch (rewardsError) {
                    console.error(`Error processing role rewards: ${rewardsError.message}`);
                  }

                  // Send level up announcement
                  if (settings.enable_announcements && settings.announcement_channel) {
                    try {
                      const channel = oldState.guild.channels.cache.get(settings.announcement_channel);
                      if (channel && channel.isTextBased()) {
                        const announceMessage = settings.announcement_message
                          .replace('{user}', oldState.member.toString())
                          .replace('{currentlevel}', levelUp.newLevel)
                          .replace('{type}', 'voice');

                        await channel.send(announceMessage);
                      }
                    } catch (announcementError) {
                      console.error(`Failed to send level up announcement: ${announcementError.message}`);
                    }
                  }
                }
              } catch (xpError) {
                console.error(`Error adding voice XP: ${xpError.message}`);
              }
            }
          }
        } catch (error) {
          console.error(`Error handling user leaving voice channel: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('Error in voiceStateUpdate event:', error);
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