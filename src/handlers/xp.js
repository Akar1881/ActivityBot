const { db } = require('../database/unifiedDb');
const { recordXpGain } = require('./xpHistory');

/**
 * Calculate level based on XP
 * @param {number} xp - The amount of XP
 * @returns {number} The calculated level
 */
function calculateLevel(xp) {
  if (typeof xp !== 'number' || isNaN(xp) || xp < 0) {
    console.warn(`Invalid XP value: ${xp}, using 0 instead`);
    return 0;
  }
  return Math.floor(0.1 * Math.sqrt(xp));
}

/**
 * Calculate XP required for a specific level
 * @param {number} level - The level
 * @returns {number} The XP required
 */
function calculateXpForLevel(level) {
  if (typeof level !== 'number' || isNaN(level) || level < 0) {
    console.warn(`Invalid level value: ${level}, using 0 instead`);
    return 0;
  }
  return Math.pow(level / 0.1, 2);
}

/**
 * Calculate progress to next level
 * @param {number} currentXp - The current XP
 * @returns {number} Progress as a value between 0 and 1
 */
function calculateProgress(currentXp) {
  if (typeof currentXp !== 'number' || isNaN(currentXp) || currentXp < 0) {
    return 0;
  }
  
  const currentLevel = calculateLevel(currentXp);
  const nextLevelXp = calculateXpForLevel(currentLevel + 1);
  const currentLevelXp = calculateXpForLevel(currentLevel);
  
  // Avoid division by zero
  if (nextLevelXp === currentLevelXp) return 1;
  
  const progress = (currentXp - currentLevelXp) / (nextLevelXp - currentLevelXp);
  return Math.min(Math.max(progress, 0), 1); // Ensure progress is between 0 and 1
}

/**
 * Add chat XP to a user
 * @param {string} userId - The user ID
 * @param {string} guildId - The guild ID
 * @param {number} multiplier - Optional XP multiplier
 * @returns {Promise<Object|null>} Level up information or null
 */
async function addChatXP(userId, guildId, multiplier = 1.0) {
  try {
    if (!userId || !guildId) {
      console.error('Missing required parameters for addChatXP');
      return null;
    }
    
    // Validate multiplier
    if (typeof multiplier !== 'number' || isNaN(multiplier) || multiplier <= 0) {
      multiplier = 1.0;
    }
    
    // Get guild settings
    const settings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
    if (!settings) {
      console.log(`No settings found for guild ${guildId}`);
      return null;
    }

    // Calculate XP gain with multiplier
    const minXp = settings.min_xp_per_message || 15;
    const maxXp = settings.max_xp_per_message || 25;
    
    const xpGain = Math.floor(
      (Math.random() * (maxXp - minXp + 1) + minXp) * multiplier
    );

    // Get user data
    const user = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    
    // If user doesn't exist, create a new entry
    if (!user) {
      try {
        db.prepare(`
          INSERT INTO users (user_id, guild_id, chat_xp, voice_xp, chat_level, voice_level, last_message_time, last_voice_time)
          VALUES (?, ?, ?, 0, ?, 0, ?, 0)
        `).run(userId, guildId, xpGain, calculateLevel(xpGain), Date.now());
        
        // Record initial XP gain in history
        recordXpGain(userId, guildId, xpGain, 0);
        
        console.log(`Created new user ${userId} in guild ${guildId} with ${xpGain} chat XP`);
        return { oldLevel: 0, newLevel: calculateLevel(xpGain), type: 'chat' };
      } catch (error) {
        console.error(`Error creating new user for chat XP: ${error.message}`);
        return null;
      }
    }

    // Calculate new level
    const oldLevel = calculateLevel(user.chat_xp || 0);
    const newXp = (user.chat_xp || 0) + xpGain;
    const newLevel = calculateLevel(newXp);

    // Update user data
    try {
      db.prepare('UPDATE users SET chat_xp = ?, chat_level = ?, last_message_time = ? WHERE user_id = ? AND guild_id = ?')
        .run(newXp, newLevel, Date.now(), userId, guildId);
      
      // Record XP gain in history
      recordXpGain(userId, guildId, xpGain, 0);
      
      console.log(`Updated user ${userId} in guild ${guildId} to ${newXp} chat XP (level ${newLevel})`);
      
      // Return level up info if leveled up
      if (newLevel > oldLevel) {
        return { oldLevel, newLevel, type: 'chat' };
      }
    } catch (error) {
      console.error(`Error updating chat XP: ${error.message}`);
    }

    return null;
  } catch (error) {
    console.error(`Unexpected error in addChatXP: ${error.message}`);
    return null;
  }
}

/**
 * Add voice XP to a user
 * @param {string} userId - The user ID
 * @param {string} guildId - The guild ID
 * @param {number} minutes - Minutes spent in voice
 * @param {number} multiplier - Optional XP multiplier
 * @returns {Promise<Object|null>} Level up information or null
 */
async function addVoiceXP(userId, guildId, minutes, multiplier = 1.0) {
  try {
    if (!userId || !guildId || typeof minutes !== 'number') {
      console.error('Missing or invalid parameters for addVoiceXP');
      return null;
    }
    
    // Validate minutes
    if (isNaN(minutes) || minutes <= 0) {
      console.warn(`Invalid minutes value: ${minutes}`);
      return null;
    }
    
    // Validate multiplier
    if (typeof multiplier !== 'number' || isNaN(multiplier) || multiplier <= 0) {
      multiplier = 1.0;
    }
    
    // Get guild settings
    const settings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
    if (!settings) {
      console.log(`No settings found for guild ${guildId}`);
      return null;
    }

    // Calculate XP gain with multiplier
    const minXp = settings.min_xp_per_voice_minute || 10;
    const maxXp = settings.max_xp_per_voice_minute || 20;
    
    const xpPerMinute = Math.floor(
      (Math.random() * (maxXp - minXp + 1) + minXp) * multiplier
    );
    
    const xpGain = xpPerMinute * minutes;
    console.log(`Calculated ${xpGain} XP for ${minutes} minutes of voice activity`);

    // Get user data
    const user = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    
    // If user doesn't exist, create a new entry
    if (!user) {
      try {
        db.prepare(`
          INSERT INTO users (user_id, guild_id, chat_xp, voice_xp, chat_level, voice_level, last_message_time, last_voice_time)
          VALUES (?, ?, 0, ?, 0, ?, 0, ?)
        `).run(userId, guildId, xpGain, calculateLevel(xpGain), Date.now());
        
        // Record initial XP gain in history
        recordXpGain(userId, guildId, 0, xpGain);
        
        console.log(`Created new user ${userId} in guild ${guildId} with ${xpGain} voice XP`);
        return { oldLevel: 0, newLevel: calculateLevel(xpGain), type: 'voice' };
      } catch (error) {
        console.error(`Error creating new user for voice XP: ${error.message}`);
        return null;
      }
    }

    // Calculate new level
    const oldLevel = calculateLevel(user.voice_xp || 0);
    const newXp = (user.voice_xp || 0) + xpGain;
    const newLevel = calculateLevel(newXp);

    // Update user data
    try {
      db.prepare('UPDATE users SET voice_xp = ?, voice_level = ? WHERE user_id = ? AND guild_id = ?')
        .run(newXp, newLevel, userId, guildId);
      
      // Record XP gain in history
      recordXpGain(userId, guildId, 0, xpGain);
      
      console.log(`Updated user ${userId} in guild ${guildId} to ${newXp} voice XP (level ${newLevel})`);
      
      // Return level up info if leveled up
      if (newLevel > oldLevel) {
        return { oldLevel, newLevel, type: 'voice' };
      }
    } catch (error) {
      console.error(`Error updating voice XP: ${error.message}`);
    }

    return null;
  } catch (error) {
    console.error(`Unexpected error in addVoiceXP: ${error.message}`);
    return null;
  }
}

module.exports = {
  calculateLevel,
  calculateXpForLevel,
  calculateProgress,
  addChatXP,
  addVoiceXP
};