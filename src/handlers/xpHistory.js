const { db } = require('../database/unifiedDb');

/**
 * Format a date as YYYY-MM-DD
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Get the current date as YYYY-MM-DD
 * @returns {string} Today's date as YYYY-MM-DD
 */
function getCurrentDate() {
  return formatDate(new Date());
}

/**
 * Record XP gain in the history table
 * @param {string} userId - The user ID
 * @param {string} guildId - The guild ID
 * @param {number} chatXp - Chat XP to add (default 0)
 * @param {number} voiceXp - Voice XP to add (default 0)
 */
function recordXpGain(userId, guildId, chatXp = 0, voiceXp = 0) {
  try {
    if (!userId || !guildId) {
      console.error('Missing required parameters for recordXpGain');
      return;
    }
    
    // Get today's date
    const today = getCurrentDate();
    
    // Check if there's already an entry for today
    const existingEntry = db.prepare(
      'SELECT * FROM xp_history WHERE user_id = ? AND guild_id = ? AND date = ?'
    ).get(userId, guildId, today);
    
    if (existingEntry) {
      // Update existing entry
      db.prepare(
        'UPDATE xp_history SET chat_xp = chat_xp + ?, voice_xp = voice_xp + ? WHERE user_id = ? AND guild_id = ? AND date = ?'
      ).run(chatXp, voiceXp, userId, guildId, today);
    } else {
      // Create new entry
      db.prepare(
        'INSERT INTO xp_history (user_id, guild_id, date, chat_xp, voice_xp) VALUES (?, ?, ?, ?, ?)'
      ).run(userId, guildId, today, chatXp, voiceXp);
    }
  } catch (error) {
    console.error('Error recording XP history:', error);
  }
}

/**
 * Get XP history for a specific time period
 * @param {string} userId - The user ID
 * @param {string} guildId - The guild ID
 * @param {string} period - Time period ('day', 'week', 'month', 'all')
 * @returns {Object} XP history data
 */
function getXpHistory(userId, guildId, period = 'all') {
  try {
    if (!userId || !guildId) {
      console.error('Missing required parameters for getXpHistory');
      return { chatXp: 0, voiceXp: 0, totalXp: 0 };
    }
    
    const today = new Date();
    let startDate;
    
    // Determine start date based on period
    if (period === 'day') {
      startDate = formatDate(today);
    } else if (period === 'week') {
      // Check if we have a weekly reset marker
      const lastWeeklyReset = db.prepare('SELECT value FROM xp_history_meta WHERE key = ?').get('last_weekly_reset');
      
      if (lastWeeklyReset) {
        startDate = lastWeeklyReset.value;
      } else {
        // Fall back to 7 days ago if no reset marker
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        startDate = formatDate(weekAgo);
      }
    } else if (period === 'month') {
      // Check if we have a monthly reset marker
      const lastMonthlyReset = db.prepare('SELECT value FROM xp_history_meta WHERE key = ?').get('last_monthly_reset');
      
      if (lastMonthlyReset) {
        startDate = lastMonthlyReset.value;
      } else {
        // Fall back to 30 days ago if no reset marker
        const monthAgo = new Date(today);
        monthAgo.setDate(today.getDate() - 30);
        startDate = formatDate(monthAgo);
      }
    }
    
    let query;
    let params;
    
    if (period === 'all') {
      // Get all-time XP from the users table
      query = 'SELECT chat_xp, voice_xp FROM users WHERE user_id = ? AND guild_id = ?';
      params = [userId, guildId];
    } else {
      // Get period-specific XP from xp_history
      query = `
        SELECT SUM(chat_xp) as chat_xp, SUM(voice_xp) as voice_xp 
        FROM xp_history 
        WHERE user_id = ? AND guild_id = ? AND date >= ?
      `;
      params = [userId, guildId, startDate];
    }
    
    const result = db.prepare(query).get(...params);
    
    if (!result) {
      return { chatXp: 0, voiceXp: 0, totalXp: 0 };
    }
    
    const chatXp = result.chat_xp || 0;
    const voiceXp = result.voice_xp || 0;
    
    return {
      chatXp,
      voiceXp,
      totalXp: chatXp + voiceXp
    };
  } catch (error) {
    console.error('Error getting XP history:', error);
    return { chatXp: 0, voiceXp: 0, totalXp: 0 };
  }
}

/**
 * Get leaderboard data for a specific time period
 * @param {string} guildId - The guild ID
 * @param {string} period - Time period ('day', 'week', 'month', 'all')
 * @param {number} limit - Maximum number of users to return
 * @param {string} type - XP type ('chat', 'voice', 'total')
 * @returns {Array} Leaderboard data
 */
function getLeaderboard(guildId, period = 'all', limit = 10, type = 'total') {
  try {
    if (!guildId) {
      console.error('Missing required parameter guildId for getLeaderboard');
      return [];
    }
    
    let query;
    let params;
    
    if (period === 'all') {
      // Get all-time leaderboard from users table
      if (type === 'chat') {
        query = `
          SELECT user_id, chat_xp as xp, chat_level as level
          FROM users
          WHERE guild_id = ? AND chat_xp > 0
          ORDER BY chat_xp DESC
          LIMIT ?
        `;
      } else if (type === 'voice') {
        query = `
          SELECT user_id, voice_xp as xp, voice_level as level
          FROM users
          WHERE guild_id = ? AND voice_xp > 0
          ORDER BY voice_xp DESC
          LIMIT ?
        `;
      } else {
        query = `
          SELECT user_id, (chat_xp + voice_xp) as xp, 
                 (CASE WHEN chat_xp > voice_xp THEN chat_level ELSE voice_level END) as level
          FROM users
          WHERE guild_id = ? AND (chat_xp + voice_xp) > 0
          ORDER BY xp DESC
          LIMIT ?
        `;
      }
      
      params = [guildId, limit];
    } else {
      // Get period-specific leaderboard from xp_history
      const today = new Date();
      let startDate;
      
      // Determine start date based on period
      if (period === 'day') {
        startDate = formatDate(today);
      } else if (period === 'week') {
        // Check if we have a weekly reset marker
        const lastWeeklyReset = db.prepare('SELECT value FROM xp_history_meta WHERE key = ?').get('last_weekly_reset');
        
        if (lastWeeklyReset) {
          startDate = lastWeeklyReset.value;
        } else {
          // Fall back to 7 days ago if no reset marker
          const weekAgo = new Date(today);
          weekAgo.setDate(today.getDate() - 7);
          startDate = formatDate(weekAgo);
        }
      } else if (period === 'month') {
        // Check if we have a monthly reset marker
        const lastMonthlyReset = db.prepare('SELECT value FROM xp_history_meta WHERE key = ?').get('last_monthly_reset');
        
        if (lastMonthlyReset) {
          startDate = lastMonthlyReset.value;
        } else {
          // Fall back to 30 days ago if no reset marker
          const monthAgo = new Date(today);
          monthAgo.setDate(today.getDate() - 30);
          startDate = formatDate(monthAgo);
        }
      }
      
      if (type === 'chat') {
        query = `
          SELECT 
            user_id, 
            SUM(chat_xp) as xp,
            (SELECT chat_level FROM users WHERE users.user_id = xp_history.user_id AND users.guild_id = xp_history.guild_id) as level
          FROM xp_history
          WHERE guild_id = ? AND date >= ? AND chat_xp > 0
          GROUP BY user_id
          ORDER BY xp DESC
          LIMIT ?
        `;
      } else if (type === 'voice') {
        query = `
          SELECT 
            user_id, 
            SUM(voice_xp) as xp,
            (SELECT voice_level FROM users WHERE users.user_id = xp_history.user_id AND users.guild_id = xp_history.guild_id) as level
          FROM xp_history
          WHERE guild_id = ? AND date >= ? AND voice_xp > 0
          GROUP BY user_id
          ORDER BY xp DESC
          LIMIT ?
        `;
      } else {
        query = `
          SELECT 
            user_id, 
            SUM(chat_xp + voice_xp) as xp,
            (SELECT CASE WHEN chat_xp > voice_xp THEN chat_level ELSE voice_level END 
             FROM users WHERE users.user_id = xp_history.user_id AND users.guild_id = xp_history.guild_id) as level
          FROM xp_history
          WHERE guild_id = ? AND date >= ? AND (chat_xp + voice_xp) > 0
          GROUP BY user_id
          ORDER BY xp DESC
          LIMIT ?
        `;
      }
      
      params = [guildId, startDate, limit];
    }
    
    return db.prepare(query).all(...params);
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return [];
  }
}

/**
 * Get guild leaderboard data for a specific time period
 * @param {string} period - Time period ('day', 'week', 'month', 'all')
 * @param {number} limit - Maximum number of guilds to return
 * @returns {Array} Guild leaderboard data
 */
function getGuildLeaderboard(period = 'all', limit = 10) {
  try {
    let query;
    let params;
    
    if (period === 'all') {
      // Get all-time guild leaderboard from users table
      query = `
        SELECT 
          users.guild_id,
          guild_settings.guild_name,
          SUM(chat_xp + voice_xp) as total_xp,
          COUNT(DISTINCT user_id) as active_users
        FROM users
        LEFT JOIN guild_settings ON users.guild_id = guild_settings.guild_id
        WHERE chat_xp + voice_xp > 0
        GROUP BY users.guild_id
        ORDER BY total_xp DESC
        LIMIT ?
      `;
      
      params = [limit];
    } else {
      // Get period-specific guild leaderboard from xp_history
      const today = new Date();
      let startDate;
      
      // Determine start date based on period
      if (period === 'day') {
        startDate = formatDate(today);
      } else if (period === 'week') {
        // Check if we have a weekly reset marker
        const lastWeeklyReset = db.prepare('SELECT value FROM xp_history_meta WHERE key = ?').get('last_weekly_reset');
        
        if (lastWeeklyReset) {
          startDate = lastWeeklyReset.value;
        } else {
          // Fall back to 7 days ago if no reset marker
          const weekAgo = new Date(today);
          weekAgo.setDate(today.getDate() - 7);
          startDate = formatDate(weekAgo);
        }
      } else if (period === 'month') {
        // Check if we have a monthly reset marker
        const lastMonthlyReset = db.prepare('SELECT value FROM xp_history_meta WHERE key = ?').get('last_monthly_reset');
        
        if (lastMonthlyReset) {
          startDate = lastMonthlyReset.value;
        } else {
          // Fall back to 30 days ago if no reset marker
          const monthAgo = new Date(today);
          monthAgo.setDate(today.getDate() - 30);
          startDate = formatDate(monthAgo);
        }
      }
      
      query = `
        SELECT 
          xp_history.guild_id,
          guild_settings.guild_name,
          SUM(chat_xp + voice_xp) as total_xp,
          COUNT(DISTINCT user_id) as active_users
        FROM xp_history
        LEFT JOIN guild_settings ON xp_history.guild_id = guild_settings.guild_id
        WHERE date >= ? AND (chat_xp + voice_xp) > 0
        GROUP BY xp_history.guild_id
        ORDER BY total_xp DESC
        LIMIT ?
      `;
      
      params = [startDate, limit];
    }
    
    return db.prepare(query).all(...params);
  } catch (error) {
    console.error('Error getting guild leaderboard:', error);
    return [];
  }
}

/**
 * Initialize XP history for existing users
 * This should be called when the bot starts up
 */
function initializeXpHistory() {
  try {
    console.log('Initializing XP history for existing users...');
    
    // Get today's date
    const today = getCurrentDate();
    
    // Check if we already have entries for today
    const todayEntries = db.prepare('SELECT COUNT(*) as count FROM xp_history WHERE date = ?').get(today);
    
    // If we already have entries for today, skip initialization
    if (todayEntries && todayEntries.count > 0) {
      console.log(`Found ${todayEntries.count} existing XP history entries for today, skipping initialization`);
      return;
    }
    
    // Get all users with XP
    const users = db.prepare('SELECT user_id, guild_id, chat_xp, voice_xp FROM users WHERE chat_xp > 0 OR voice_xp > 0').all();
    
    if (users.length === 0) {
      console.log('No users with XP found, skipping XP history initialization');
      return;
    }
    
    console.log(`Initializing XP history for ${users.length} users`);
    
    // Begin transaction for better performance
    const initTransaction = db.transaction(() => {
      for (const user of users) {
        // Check if the user already has an entry for today
        const existingEntry = db.prepare(
          'SELECT * FROM xp_history WHERE user_id = ? AND guild_id = ? AND date = ?'
        ).get(user.user_id, user.guild_id, today);
        
        if (!existingEntry) {
          // Create a new entry with a small portion of their total XP
          // This ensures they have some XP for today's leaderboard
          const chatXpToday = Math.floor(user.chat_xp * 0.01); // 1% of total chat XP
          const voiceXpToday = Math.floor(user.voice_xp * 0.01); // 1% of total voice XP
          
          if (chatXpToday > 0 || voiceXpToday > 0) {
            db.prepare(
              'INSERT INTO xp_history (user_id, guild_id, date, chat_xp, voice_xp) VALUES (?, ?, ?, ?, ?)'
            ).run(user.user_id, user.guild_id, today, chatXpToday, voiceXpToday);
          }
        }
      }
    });
    
    // Execute the transaction
    initTransaction();
    
    console.log('XP history initialization complete');
  } catch (error) {
    console.error('Error initializing XP history:', error);
  }
}

module.exports = {
  recordXpGain,
  getXpHistory,
  getLeaderboard,
  getGuildLeaderboard,
  getCurrentDate,
  initializeXpHistory
};