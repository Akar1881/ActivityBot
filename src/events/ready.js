const { db } = require('../database/db');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);
    
    try {
      // Set bot status immediately
      client.user.setActivity('/help', { type: 2 }); // 2 is LISTENING
      
      // Initialize guilds in parallel for faster startup
      await initializeGuilds(client);
      
      // Log some stats
      console.log(`Bot is serving ${client.guilds.cache.size} guilds and ${client.users.cache.size} users`);
    } catch (error) {
      console.error('Error during bot initialization:', error);
    }
  },
};

/**
 * Initialize all guilds in parallel for faster startup
 */
async function initializeGuilds(client) {
  console.log('Starting guild initialization...');
  
  try {
    // Fetch all guilds if the cache seems incomplete
    if (client.guilds.cache.size === 0) {
      console.log('Guild cache is empty, fetching guilds...');
      await client.guilds.fetch();
    }
    
    // Process guilds in batches to avoid overwhelming the system
    const allGuilds = [...client.guilds.cache.values()];
    const batchSize = 10; // Process 10 guilds at a time
    
    console.log(`Initializing ${allGuilds.length} guilds in batches of ${batchSize}...`);
    
    // Create guild settings for guilds that don't have them yet
    await ensureGuildSettings(allGuilds);
    
    // Process guilds in batches
    for (let i = 0; i < allGuilds.length; i += batchSize) {
      const batch = allGuilds.slice(i, i + batchSize);
      await Promise.all(batch.map(guild => initializeGuild(guild, client)));
      console.log(`Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allGuilds.length/batchSize)}`);
    }
    
    console.log('All guilds initialized successfully');
  } catch (error) {
    console.error('Error initializing guilds:', error);
  }
}

/**
 * Ensure all guilds have settings in the database
 */
async function ensureGuildSettings(guilds) {
  console.log('Ensuring all guilds have settings...');
  
  try {
    // Get all guild IDs that already have settings
    const existingSettings = db.prepare('SELECT guild_id FROM guild_settings').all();
    const existingGuildIds = new Set(existingSettings.map(s => s.guild_id));
    
    // Create default settings for guilds that don't have them
    const stmt = db.prepare(`
      INSERT INTO guild_settings (
        guild_id, guild_name, min_xp_per_message, max_xp_per_message,
        min_xp_per_voice_minute, max_xp_per_voice_minute, min_voice_minutes_to_earn,
        max_voice_minutes_to_earn, message_cooldown, voice_cooldown, xp_multiplier,
        enable_announcements, announcement_message
      ) VALUES (?, ?, 15, 25, 10, 20, 1, 30, 60, 300, 1.0, true, '{user} reached level {currentlevel} in {type}!')
    `);
    
    let newSettingsCount = 0;
    
    for (const guild of guilds) {
      if (!existingGuildIds.has(guild.id)) {
        try {
          stmt.run(guild.id, guild.name);
          newSettingsCount++;
        } catch (error) {
          console.error(`Error creating settings for guild ${guild.id}:`, error);
        }
      }
    }
    
    console.log(`Created default settings for ${newSettingsCount} new guilds`);
  } catch (error) {
    console.error('Error ensuring guild settings:', error);
  }
}

/**
 * Initialize a single guild
 */
async function initializeGuild(guild, client) {
  try {
    // Fetch channels if needed
    if (guild.channels.cache.size === 0) {
      await guild.channels.fetch()
        .catch(error => console.error(`Failed to fetch channels for guild ${guild.id}:`, error));
    }
    
    // Track voice channel members
    await trackVoiceMembers(guild);
    
    return true;
  } catch (error) {
    console.error(`Error initializing guild ${guild.id}:`, error);
    return false;
  }
}

/**
 * Track users who are in voice channels
 */
async function trackVoiceMembers(guild) {
  try {
    // Get guild settings
    const settings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guild.id);
    if (!settings) {
      return; // Skip if no settings (should not happen after ensureGuildSettings)
    }
    
    // Get excluded channels
    const excludedChannels = new Set();
    const excludedChannelsData = db.prepare('SELECT channel_id FROM excluded_channels WHERE guild_id = ?').all(guild.id);
    excludedChannelsData.forEach(item => excludedChannels.add(item.channel_id));
    
    // Get excluded roles
    const excludedRoles = new Set();
    const excludedRolesData = db.prepare('SELECT role_id FROM excluded_roles WHERE guild_id = ?').all(guild.id);
    excludedRolesData.forEach(item => excludedRoles.add(item.role_id));
    
    // Process voice channels
    let trackedUsers = 0;
    const voiceChannels = guild.channels.cache.filter(c => c.type === 2); // 2 is voice channel
    
    for (const channel of voiceChannels.values()) {
      // Skip excluded channels
      if (excludedChannels.has(channel.id)) continue;
      
      // Process members in the channel
      for (const [memberId, member] of channel.members) {
        // Skip bots
        if (member.user.bot) continue;
        
        // Skip members with excluded roles
        const hasExcludedRole = member.roles.cache.some(role => excludedRoles.has(role.id));
        if (hasExcludedRole) continue;
        
        // Update or create user entry
        try {
          const userExists = db.prepare('SELECT 1 FROM users WHERE user_id = ? AND guild_id = ?')
            .get(memberId, guild.id);
            
          if (!userExists) {
            db.prepare(`
              INSERT INTO users (user_id, guild_id, chat_xp, voice_xp, chat_level, voice_level, last_message_time, last_voice_time)
              VALUES (?, ?, 0, 0, 0, 0, 0, ?)
            `).run(memberId, guild.id, Date.now());
          } else {
            db.prepare('UPDATE users SET last_voice_time = ? WHERE user_id = ? AND guild_id = ?')
              .run(Date.now(), memberId, guild.id);
          }
          
          trackedUsers++;
        } catch (error) {
          console.error(`Error tracking member ${memberId} in guild ${guild.id}:`, error);
        }
      }
    }
    
    if (trackedUsers > 0) {
      console.log(`Tracked ${trackedUsers} voice users in guild ${guild.id} (${guild.name})`);
    }
  } catch (error) {
    console.error(`Error tracking voice members in guild ${guild.id}:`, error);
  }
}