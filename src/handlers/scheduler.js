const { db } = require('../database/db');

/**
 * Get the current date as YYYY-MM-DD
 * @returns {string} Today's date as YYYY-MM-DD
 */
function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Schedule a function to run at a specific time every day
 * @param {Function} callback - Function to execute
 * @param {number} hour - Hour in 24-hour format (0-23)
 * @param {number} minute - Minute (0-59)
 * @param {string} timezone - Timezone offset in hours (e.g., '+3' for GMT+3)
 * @returns {Object} Timer object
 */
function scheduleDaily(callback, hour, minute, timezone) {
  // Parse timezone offset
  const tzOffset = parseInt(timezone.replace(/[^0-9-+]/g, '')) || 0;
  
  console.log(`Scheduling daily task at ${hour}:${minute.toString().padStart(2, '0')} (GMT${timezone})`);
  
  // Calculate initial delay
  const now = new Date();
  const targetTime = new Date();
  
  // Adjust for timezone (convert from local to target timezone)
  const localTzOffset = -now.getTimezoneOffset() / 60; // Local timezone offset in hours
  const hourDiff = tzOffset - localTzOffset; // Difference between local and target timezone
  
  // Set target time
  targetTime.setHours(hour - hourDiff, minute, 0, 0);
  
  // If target time is in the past, add one day
  if (targetTime <= now) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  // Calculate initial delay in milliseconds
  let delay = targetTime - now;
  
  console.log(`Next execution scheduled for: ${targetTime.toLocaleString()} (in ${Math.floor(delay/1000/60)} minutes)`);
  
  // Set timeout for first execution
  const timer = setTimeout(function runSchedule() {
    // Execute the callback
    callback();
    
    // Schedule next execution (24 hours later)
    setTimeout(runSchedule, 24 * 60 * 60 * 1000);
    
    console.log(`Daily task executed at ${new Date().toLocaleString()}`);
    console.log(`Next execution scheduled for: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString()}`);
  }, delay);
  
  return timer;
}

/**
 * Reset daily XP history
 */
function resetDailyLeaderboard() {
  try {
    console.log('Resetting daily leaderboard...');
    
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Archive yesterday's data (optional)
    // This keeps the data but marks it as archived so it won't show in leaderboards
    // db.prepare('UPDATE xp_history SET archived = 1 WHERE date = ?').run(yesterdayStr);
    
    // Or simply delete old daily data to keep the database size manageable
    // Only keep the last 30 days of daily data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const oldDateStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    db.prepare('DELETE FROM xp_history WHERE date < ?').run(oldDateStr);
    
    console.log('Daily leaderboard reset complete');
  } catch (error) {
    console.error('Error resetting daily leaderboard:', error);
  }
}

/**
 * Reset weekly XP history
 */
function resetWeeklyLeaderboard() {
  try {
    console.log('Resetting weekly leaderboard...');
    
    // Get current date
    const today = getCurrentDate();
    
    // Create a "weekly_reset" marker in the database
    // This will be used to determine the start of the current week
    db.prepare('INSERT OR REPLACE INTO xp_history_meta (key, value) VALUES (?, ?)').run('last_weekly_reset', today);
    
    console.log('Weekly leaderboard reset complete');
  } catch (error) {
    console.error('Error resetting weekly leaderboard:', error);
  }
}

/**
 * Reset monthly XP history
 */
function resetMonthlyLeaderboard() {
  try {
    console.log('Resetting monthly leaderboard...');
    
    // Get current date
    const today = getCurrentDate();
    
    // Create a "monthly_reset" marker in the database
    // This will be used to determine the start of the current month
    db.prepare('INSERT OR REPLACE INTO xp_history_meta (key, value) VALUES (?, ?)').run('last_monthly_reset', today);
    
    console.log('Monthly leaderboard reset complete');
  } catch (error) {
    console.error('Error resetting monthly leaderboard:', error);
  }
}

/**
 * Initialize the scheduler
 */
function initScheduler() {
  try {
    // Create metadata table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS xp_history_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    
    // Initialize reset markers if they don't exist
    const today = getCurrentDate();
    
    // Check if weekly reset marker exists
    const weeklyReset = db.prepare('SELECT value FROM xp_history_meta WHERE key = ?').get('last_weekly_reset');
    if (!weeklyReset) {
      db.prepare('INSERT INTO xp_history_meta (key, value) VALUES (?, ?)').run('last_weekly_reset', today);
      console.log('Initialized weekly reset marker');
    }
    
    // Check if monthly reset marker exists
    const monthlyReset = db.prepare('SELECT value FROM xp_history_meta WHERE key = ?').get('last_monthly_reset');
    if (!monthlyReset) {
      db.prepare('INSERT INTO xp_history_meta (key, value) VALUES (?, ?)').run('last_monthly_reset', today);
      console.log('Initialized monthly reset marker');
    }
    
    // Schedule daily reset at 12:05 AM GMT+3
    scheduleDaily(resetDailyLeaderboard, 0, 5, '+3');
    
    // Schedule weekly reset at 12:05 AM GMT+3 on Mondays
    scheduleDaily(() => {
      const now = new Date();
      // Check if it's Monday (1 = Monday, 0 = Sunday)
      if (now.getDay() === 1) {
        resetWeeklyLeaderboard();
      }
    }, 0, 5, '+3');
    
    // Schedule monthly reset at 12:05 AM GMT+3 on the 1st of each month
    scheduleDaily(() => {
      const now = new Date();
      // Check if it's the 1st day of the month
      if (now.getDate() === 1) {
        resetMonthlyLeaderboard();
      }
    }, 0, 5, '+3');
    
    console.log('Scheduler initialized');
  } catch (error) {
    console.error('Error initializing scheduler:', error);
  }
}

module.exports = {
  initScheduler,
  resetDailyLeaderboard,
  resetWeeklyLeaderboard,
  resetMonthlyLeaderboard
};