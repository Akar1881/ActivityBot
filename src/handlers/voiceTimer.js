const { db } = require('../database/unifiedDb');
const { addVoiceXP } = require('./xp');

// Cache for tracking users in voice channels
const voiceUserCache = new Map(); // userId_guildId -> { joinTime, lastXpTime }

/**
 * Initialize voice timer to periodically check and award XP to users in voice channels
 * @param {Client} client - Discord.js client
 */
function initVoiceTimer(client) {
  // Run the check every minute
  const checkInterval = 60 * 1000; // 1 minute in milliseconds
  
  console.log('Voice XP timer initialized');
  
  // Scan for users already in voice channels when the bot starts
  scanExistingVoiceUsers(client);
  
  setInterval(async () => {
    try {
      // Process each guild
      for (const [guildId, guild] of client.guilds.cache) {
        // Get guild settings
        const settings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
        if (!settings) continue;
        
        // Get excluded channels and roles for this guild
        const excludedChannelsData = db.prepare('SELECT channel_id FROM excluded_channels WHERE guild_id = ?').all(guildId);
        const excludedChannels = new Set(excludedChannelsData.map(item => item.channel_id));
        
        const excludedRolesData = db.prepare('SELECT role_id FROM excluded_roles WHERE guild_id = ?').all(guildId);
        const excludedRoles = new Set(excludedRolesData.map(item => item.role_id));
        
        // Get all voice channels in the guild
        const voiceChannels = guild.channels.cache.filter(channel => 
          channel.isVoiceBased() && // Voice channel type in Discord.js v14
          !excludedChannels.has(channel.id)
        );
        
        // Process each voice channel
        for (const [channelId, channel] of voiceChannels) {
          // Get all members in the voice channel
          for (const [memberId, member] of channel.members) {
            // Skip bots
            if (member.user.bot) continue;
            
            // Skip members with excluded roles
            const hasExcludedRole = member.roles.cache.some(role => excludedRoles.has(role.id));
            if (hasExcludedRole) continue;
            
            const cacheKey = `${memberId}_${guildId}`;
            const now = Date.now();
            
            // Get or create user cache entry
            if (!voiceUserCache.has(cacheKey)) {
              // Get user from database to check last_voice_time
              const user = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?')
                .get(memberId, guildId);
              
              const joinTime = user?.last_voice_time || now;
              
              voiceUserCache.set(cacheKey, {
                joinTime,
                lastXpTime: joinTime
              });
              continue; // Skip first check to establish baseline
            }
            
            const userData = voiceUserCache.get(cacheKey);
            const timeSinceLastXp = now - userData.lastXpTime;
            
            // Check if enough time has passed since last XP award (based on min_voice_minutes_to_earn)
            const minTimeToEarn = (settings.min_voice_minutes_to_earn || 1) * 60 * 1000;
            
            if (timeSinceLastXp >= minTimeToEarn) {
              // Calculate minutes since last XP award
              const minutesSinceLastXp = Math.floor(timeSinceLastXp / 60000);
              
              // Limit to max_voice_minutes_to_earn
              const effectiveMinutes = Math.min(
                minutesSinceLastXp, 
                settings.max_voice_minutes_to_earn || 30
              );
              
              if (effectiveMinutes >= 1) {
                console.log(`Awarding voice XP to ${member.user.tag} for ${effectiveMinutes} minutes in voice`);
                
                // Award XP
                const levelUp = await addVoiceXP(
                  memberId,
                  guildId,
                  effectiveMinutes,
                  settings.xp_multiplier || 1.0
                );
                
                // Handle level up
                if (levelUp) {
                  // Check for role rewards
                  try {
                    const roleRewards = db.prepare(`
                      SELECT * FROM role_rewards 
                      WHERE guild_id = ? 
                      AND level <= ? 
                      AND (type = 'voice' OR type = 'both')
                      ORDER BY level DESC
                    `).all(guildId, levelUp.newLevel);
                    
                    // Apply role rewards
                    for (const reward of roleRewards) {
                      try {
                        if (!member.roles.cache.has(reward.role_id)) {
                          await member.roles.add(reward.role_id);
                        }
                      } catch (roleError) {
                        console.error(`Failed to add role ${reward.role_id} to user ${memberId}:`, roleError);
                      }
                    }
                  } catch (rewardsError) {
                    console.error(`Error processing role rewards: ${rewardsError.message}`);
                  }
                  
                  // Send level up announcement
                  if (settings.enable_announcements && settings.announcement_channel) {
                    try {
                      const channel = guild.channels.cache.get(settings.announcement_channel);
                      if (channel && channel.isTextBased()) {
                        const announceMessage = settings.announcement_message
                          .replace('{user}', member.toString())
                          .replace('{currentlevel}', levelUp.newLevel)
                          .replace('{type}', 'voice');
                          
                        await channel.send(announceMessage);
                      }
                    } catch (announcementError) {
                      console.error(`Failed to send level up announcement: ${announcementError.message}`);
                    }
                  }
                }
                
                // Update last XP time
                userData.lastXpTime = now;
                voiceUserCache.set(cacheKey, userData);
              }
            }
          }
        }
      }
      
      // Clean up cache for users no longer in voice
      for (const [cacheKey, userData] of voiceUserCache.entries()) {
        const [userId, guildId] = cacheKey.split('_');
        const guild = client.guilds.cache.get(guildId);
        
        if (!guild) {
          voiceUserCache.delete(cacheKey);
          continue;
        }
        
        const member = guild.members.cache.get(userId);
        if (!member || !member.voice.channelId) {
          voiceUserCache.delete(cacheKey);
        }
      }
    } catch (error) {
      console.error('Error in voice XP timer:', error);
    }
  }, checkInterval);
}

// Function to add a user to the voice cache when they join a voice channel
function addUserToVoiceCache(userId, guildId, joinTime) {
  const cacheKey = `${userId}_${guildId}`;
  voiceUserCache.set(cacheKey, {
    joinTime,
    lastXpTime: joinTime
  });
}

// Function to remove a user from the voice cache when they leave a voice channel
function removeUserFromVoiceCache(userId, guildId) {
  const cacheKey = `${userId}_${guildId}`;
  voiceUserCache.delete(cacheKey);
}

/**
 * Scan for users already in voice channels when the bot starts
 * @param {Client} client - Discord.js client
 */
async function scanExistingVoiceUsers(client) {
  try {
    console.log('Scanning for existing voice users...');
    
    // Process each guild
    for (const [guildId, guild] of client.guilds.cache) {
      // Get guild settings
      const settings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
      if (!settings) continue;
      
      // Get excluded channels and roles for this guild
      const excludedChannelsData = db.prepare('SELECT channel_id FROM excluded_channels WHERE guild_id = ?').all(guildId);
      const excludedChannels = new Set(excludedChannelsData.map(item => item.channel_id));
      
      const excludedRolesData = db.prepare('SELECT role_id FROM excluded_roles WHERE guild_id = ?').all(guildId);
      const excludedRoles = new Set(excludedRolesData.map(item => item.role_id));
      
      // Get all voice channels in the guild
      const voiceChannels = guild.channels.cache.filter(channel => 
        channel.isVoiceBased() && // Voice channel type in Discord.js v14
        !excludedChannels.has(channel.id)
      );
      
      // Process each voice channel
      for (const [channelId, channel] of voiceChannels) {
        // Get all members in the voice channel
        for (const [memberId, member] of channel.members) {
          // Skip bots
          if (member.user.bot) continue;
          
          // Skip members with excluded roles
          const hasExcludedRole = member.roles.cache.some(role => excludedRoles.has(role.id));
          if (hasExcludedRole) continue;
          
          const now = Date.now();
          
          // Get user from database
          let user = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?')
            .get(memberId, guildId);
          
          if (!user) {
            // Create new user entry if they don't exist
            db.prepare(`
              INSERT INTO users (user_id, guild_id, chat_xp, voice_xp, chat_level, voice_level, last_message_time, last_voice_time)
              VALUES (?, ?, 0, 0, 0, 0, 0, ?)
            `).run(memberId, guildId, now);
            
            console.log(`Created new user ${memberId} in guild ${guildId} who was already in voice`);
          } else {
            // Update the last_voice_time for existing users
            db.prepare('UPDATE users SET last_voice_time = ? WHERE user_id = ? AND guild_id = ?')
              .run(now, memberId, guildId);
              
            console.log(`Updated existing user ${memberId} in guild ${guildId} who was already in voice`);
          }
          
          // Add to voice cache
          addUserToVoiceCache(memberId, guildId, now);
          console.log(`Added user ${memberId} in guild ${guildId} to voice cache (already in voice)`);
        }
      }
    }
    
    console.log('Finished scanning for existing voice users');
  } catch (error) {
    console.error('Error scanning for existing voice users:', error);
  }
}

module.exports = {
  initVoiceTimer,
  addUserToVoiceCache,
  removeUserFromVoiceCache,
  voiceUserCache
};