const { db } = require('../database/db');

module.exports = {
  name: 'guildCreate',
  async execute(guild, client) {
    console.log(`Bot added to new guild: ${guild.name} (${guild.id})`);
    
    try {
      // Create guild settings if they don't exist
      await createGuildSettings(guild);
      
      // Initialize guild channels and members
      await initializeNewGuild(guild);
      
      console.log(`Successfully initialized new guild: ${guild.name} (${guild.id})`);
    } catch (error) {
      console.error(`Error initializing new guild ${guild.id}:`, error);
    }
  },
};

/**
 * Create default settings for a new guild
 */
async function createGuildSettings(guild) {
  try {
    // Check if settings already exist
    const existingSettings = db.prepare('SELECT 1 FROM guild_settings WHERE guild_id = ?').get(guild.id);
    
    if (!existingSettings) {
      // Create default settings
      db.prepare(`
        INSERT INTO guild_settings (
          guild_id, guild_name, min_xp_per_message, max_xp_per_message,
          min_xp_per_voice_minute, max_xp_per_voice_minute, min_voice_minutes_to_earn,
          max_voice_minutes_to_earn, message_cooldown, voice_cooldown, xp_multiplier,
          enable_announcements, announcement_message
        ) VALUES (?, ?, 15, 25, 10, 20, 1, 30, 60, 300, 1.0, true, '{user} reached level {currentlevel} in {type}!')
      `).run(guild.id, guild.name);
      
      console.log(`Created default settings for new guild ${guild.id}`);
    }
  } catch (error) {
    console.error(`Error creating settings for guild ${guild.id}:`, error);
    throw error;
  }
}

/**
 * Initialize a newly added guild
 */
async function initializeNewGuild(guild) {
  try {
    // Fetch all channels
    await guild.channels.fetch()
      .catch(error => console.error(`Failed to fetch channels for guild ${guild.id}:`, error));
    
    // Find a text channel to send welcome message
    const systemChannel = guild.systemChannel;
    const generalChannel = guild.channels.cache.find(
      channel => channel.type === 0 && 
      (channel.name.includes('general') || channel.name.includes('chat'))
    );
    const firstTextChannel = guild.channels.cache.find(channel => channel.type === 0);
    
    const welcomeChannel = systemChannel || generalChannel || firstTextChannel;
    
    // Send welcome message if possible
    if (welcomeChannel) {
      try {
        await welcomeChannel.send({
          content: `👋 **Thanks for adding ActivityBot!**\n\nI'll track XP for messages and voice activity in this server. Use \`/help\` to see available commands, and server admins can configure me through the dashboard.`
        });
      } catch (messageError) {
        console.error(`Could not send welcome message to guild ${guild.id}:`, messageError);
      }
    }
    
    // Track any users already in voice channels
    let trackedUsers = 0;
    const voiceChannels = guild.channels.cache.filter(c => c.type === 2); // 2 is voice channel
    
    for (const channel of voiceChannels.values()) {
      for (const [memberId, member] of channel.members) {
        // Skip bots
        if (member.user.bot) continue;
        
        // Create user entry
        try {
          db.prepare(`
            INSERT INTO users (user_id, guild_id, chat_xp, voice_xp, chat_level, voice_level, last_message_time, last_voice_time)
            VALUES (?, ?, 0, 0, 0, 0, 0, ?)
          `).run(memberId, guild.id, Date.now());
          
          trackedUsers++;
        } catch (error) {
          console.error(`Error tracking member ${memberId} in new guild ${guild.id}:`, error);
        }
      }
    }
    
    if (trackedUsers > 0) {
      console.log(`Tracked ${trackedUsers} voice users in new guild ${guild.id}`);
    }
  } catch (error) {
    console.error(`Error initializing new guild ${guild.id}:`, error);
    throw error;
  }
}