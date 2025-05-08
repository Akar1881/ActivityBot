/**
 * Unified database module for ActivityBot
 * Combines all database operations into a single connection
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');
const logger = require('../utils/logger');

// Try multiple possible database directories
let dbDir;
let dbPath;

// List of possible database directories in order of preference
const possibleDirs = [
  path.join(process.cwd(), 'database'),    // Project root database folder (first priority)
  path.join(os.tmpdir(), 'activitybot-db'), // System temp directory
  path.join(__dirname, 'data')             // Original location (last resort)
];

// Try to find a writable directory
for (const dir of possibleDirs) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Test if we can write to this directory
    const testFile = path.join(dir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    
    // If we get here, we found a writable directory
    dbDir = dir;
    dbPath = path.join(dbDir, 'activitybot.db');
    console.log(`Using unified database directory: ${dbDir}`);
    break;
  } catch (error) {
    console.warn(`Cannot use directory ${dir}: ${error.message}`);
  }
}

if (!dbDir) {
  console.error('Could not find a writable directory for the database');
  console.error('Attempting to use current working directory as a last resort');
  
  try {
    // Try to use the current working directory as a last resort
    dbDir = process.cwd();
    dbPath = path.join(dbDir, 'activitybot.db');
    console.log(`Using current working directory for database: ${dbDir}`);
    
    // Test if we can write to this directory
    const testFile = path.join(dbDir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (error) {
    console.error(`Cannot use current working directory: ${error.message}`);
    console.error('The application will continue with in-memory database, but data will not be persisted');
    
    // Use in-memory database as a last resort
    dbDir = ':memory:';
    dbPath = ':memory:';
  }
}

// Create database connection with better error handling
let db;
try {
  db = new Database(dbPath, { 
    // Only log in development mode
    verbose: process.env.NODE_ENV === 'development' ? console.log : null,
    fileMustExist: false
  });
  console.log('Unified database connection established successfully to:', dbPath);
  
  // Set pragmas for better performance
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');
  db.pragma('mmap_size = 30000000000');
  db.pragma('cache_size = 10000');
} catch (error) {
  console.error('Failed to connect to database:', error);
  console.error('Attempting to use in-memory database as fallback');
  
  try {
    // Use in-memory database as fallback
    db = new Database(':memory:', { 
      verbose: process.env.NODE_ENV === 'development' ? console.log : null 
    });
    console.log('In-memory database connection established successfully');
    console.warn('Using in-memory database - data will not persist after restart!');
  } catch (memoryError) {
    console.error('Failed to create in-memory database:', memoryError);
    console.error('The application cannot function without a database');
    process.exit(1);
  }
}

/**
 * Initialize all database tables
 */
function initializeDatabase() {
  try {
    console.log('Initializing unified database...');
    
    // Create users table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT,
        guild_id TEXT,
        chat_xp INTEGER DEFAULT 0,
        voice_xp INTEGER DEFAULT 0,
        chat_level INTEGER DEFAULT 0,
        voice_level INTEGER DEFAULT 0,
        last_message_time INTEGER,
        last_voice_time INTEGER,
        PRIMARY KEY (user_id, guild_id)
      )
    `);
    
    // Check if users table needs to be updated
    const userColumns = db.prepare("PRAGMA table_info(users)").all();
    const hasUserChatLevel = userColumns.some(col => col.name === 'chat_level');
    const hasUserVoiceLevel = userColumns.some(col => col.name === 'voice_level');
    
    // Add missing columns if they don't exist
    if (!hasUserChatLevel) {
      try {
        db.exec(`ALTER TABLE users ADD COLUMN chat_level INTEGER DEFAULT 0`);
        console.log('Added chat_level column to users table');
      } catch (e) {
        console.warn('Could not add chat_level column:', e.message);
      }
    }
    
    if (!hasUserVoiceLevel) {
      try {
        db.exec(`ALTER TABLE users ADD COLUMN voice_level INTEGER DEFAULT 0`);
        console.log('Added voice_level column to users table');
      } catch (e) {
        console.warn('Could not add voice_level column:', e.message);
      }
    }

    // Create guild_settings table
    db.exec(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        guild_name TEXT,
        min_xp_per_message INTEGER DEFAULT 15,
        max_xp_per_message INTEGER DEFAULT 25,
        min_xp_per_voice_minute INTEGER DEFAULT 10,
        max_xp_per_voice_minute INTEGER DEFAULT 20,
        min_voice_minutes_to_earn INTEGER DEFAULT 1,
        max_voice_minutes_to_earn INTEGER DEFAULT 30,
        message_cooldown INTEGER DEFAULT 60,
        voice_cooldown INTEGER DEFAULT 300,
        xp_multiplier REAL DEFAULT 1.0,
        announcement_channel TEXT,
        enable_announcements INTEGER DEFAULT 1,
        announcement_message TEXT DEFAULT '{user} reached level {currentlevel} in {type}!'
      )
    `);

    // Create role_rewards table
    db.exec(`
      CREATE TABLE IF NOT EXISTS role_rewards (
        guild_id TEXT,
        role_id TEXT,
        role_name TEXT,
        level INTEGER,
        type TEXT CHECK(type IN ('chat', 'voice', 'both')),
        stack INTEGER DEFAULT 1,
        PRIMARY KEY (guild_id, role_id)
      )
    `);

    // Create excluded_channels table
    db.exec(`
      CREATE TABLE IF NOT EXISTS excluded_channels (
        guild_id TEXT,
        channel_id TEXT,
        PRIMARY KEY (guild_id, channel_id)
      )
    `);

    // Create excluded_roles table
    db.exec(`
      CREATE TABLE IF NOT EXISTS excluded_roles (
        guild_id TEXT,
        role_id TEXT,
        PRIMARY KEY (guild_id, role_id)
      )
    `);
    
    // Create xp_history table for tracking XP over time periods
    db.exec(`
      CREATE TABLE IF NOT EXISTS xp_history (
        user_id TEXT,
        guild_id TEXT,
        date TEXT,
        chat_xp INTEGER DEFAULT 0,
        voice_xp INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, guild_id, date)
      )
    `);
    
    // Create invite-related tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS invites (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        inviter_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_fake INTEGER DEFAULT 0,
        is_left INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      )
    `);
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS invite_counts (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        regular INTEGER DEFAULT 0,
        fake INTEGER DEFAULT 0,
        left INTEGER DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      )
    `);
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS guild_invite_settings (
        guild_id TEXT PRIMARY KEY,
        count_fake_invites INTEGER DEFAULT 0,
        count_left_invites INTEGER DEFAULT 0,
        enable_invite_welcome INTEGER DEFAULT 0,
        invite_welcome_channel TEXT,
        invite_welcome_message TEXT DEFAULT 'Hi, {user} Welcome to our server! You were invited by {inviter} who now has {invites} invites.'
      )
    `);
    
    console.log('Unified database initialized successfully');
  } catch (error) {
    console.error('Error initializing unified database:', error);
    console.error('The application will continue, but some features may not work properly');
  }
}

/**
 * Check the database connection and tables
 * @returns {Object} Status information about the database
 */
function checkDatabase() {
  try {
    console.log('Checking unified database...');
    
    // Get database file location
    const dbLocation = db.name || 'In-memory database';
    console.log('Database location:', dbLocation);
    
    // Check if the database is accessible
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all();
    console.log('Database tables:', tables.map(t => t.name).join(', '));
    
    // Check database integrity
    const integrity = db.prepare('PRAGMA integrity_check').get();
    console.log('Database integrity check:', integrity.integrity_check);
    
    // Check if we can write to the database
    let writeTest = 'Failed';
    try {
      // Try to create a test table
      db.prepare(`
        CREATE TABLE IF NOT EXISTS db_test (
          id TEXT PRIMARY KEY,
          timestamp INTEGER
        )
      `).run();
      
      // Insert a test record
      db.prepare(`
        INSERT OR REPLACE INTO db_test (id, timestamp)
        VALUES ('test', ?)
      `).run(Date.now());
      
      // Read the test record
      const testRecord = db.prepare(`
        SELECT * FROM db_test WHERE id = 'test'
      `).get();
      
      writeTest = testRecord ? 'Success' : 'Failed - No record found';
    } catch (writeError) {
      writeTest = `Error: ${writeError.message}`;
    }
    
    return {
      location: dbLocation,
      tables: tables.map(t => t.name),
      integrity: integrity.integrity_check,
      writeTest,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error checking database:', error);
    return {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
  }
}

// Function to get the database path
function getDatabasePath() {
  return dbPath;
}

// Migrate data from old databases if they exist
function migrateFromOldDatabases() {
  try {
    const oldLevelingDbPath = path.join(dbDir, 'leveling.db');
    const oldInviteDbPath = path.join(dbDir, 'invites.db');
    
    // Check if old databases exist
    const levelingDbExists = fs.existsSync(oldLevelingDbPath);
    const inviteDbExists = fs.existsSync(oldInviteDbPath);
    
    if (!levelingDbExists && !inviteDbExists) {
      console.log('No old databases found, skipping migration');
      return;
    }
    
    console.log('Found old databases, attempting to migrate data...');
    
    // Migrate leveling database
    if (levelingDbExists) {
      try {
        const oldLevelingDb = new Database(oldLevelingDbPath, { readonly: true });
        
        // Migrate users table
        const users = oldLevelingDb.prepare('SELECT * FROM users').all();
        if (users.length > 0) {
          const insertUser = db.prepare(`
            INSERT OR REPLACE INTO users 
            (user_id, guild_id, chat_xp, voice_xp, chat_level, voice_level, last_message_time, last_voice_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          for (const user of users) {
            insertUser.run(
              user.user_id,
              user.guild_id,
              user.chat_xp || 0,
              user.voice_xp || 0,
              user.chat_level || 0,
              user.voice_level || 0,
              user.last_message_time || null,
              user.last_voice_time || null
            );
          }
          console.log(`Migrated ${users.length} users from old leveling database`);
        }
        
        // Migrate other tables as needed
        // ... (add more migration code for other tables)
        
        oldLevelingDb.close();
      } catch (error) {
        console.error('Error migrating leveling database:', error);
      }
    }
    
    // Migrate invite database
    if (inviteDbExists) {
      try {
        const oldInviteDb = new Database(oldInviteDbPath, { readonly: true });
        
        // Migrate invites table
        const invites = oldInviteDb.prepare('SELECT * FROM invites').all();
        if (invites.length > 0) {
          const insertInvite = db.prepare(`
            INSERT OR REPLACE INTO invites 
            (guild_id, user_id, inviter_id, created_at, is_fake, is_left)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          
          for (const invite of invites) {
            insertInvite.run(
              invite.guild_id,
              invite.user_id,
              invite.inviter_id,
              invite.created_at,
              invite.is_fake || 0,
              invite.is_left || 0
            );
          }
          console.log(`Migrated ${invites.length} invites from old invite database`);
        }
        
        // Migrate invite_counts table
        const inviteCounts = oldInviteDb.prepare('SELECT * FROM invite_counts').all();
        if (inviteCounts.length > 0) {
          const insertInviteCount = db.prepare(`
            INSERT OR REPLACE INTO invite_counts 
            (guild_id, user_id, regular, fake, left)
            VALUES (?, ?, ?, ?, ?)
          `);
          
          for (const count of inviteCounts) {
            insertInviteCount.run(
              count.guild_id,
              count.user_id,
              count.regular || 0,
              count.fake || 0,
              count.left || 0
            );
          }
          console.log(`Migrated ${inviteCounts.length} invite counts from old invite database`);
        }
        
        // Migrate guild_invite_settings table
        const settings = oldInviteDb.prepare('SELECT * FROM guild_invite_settings').all();
        if (settings.length > 0) {
          const insertSettings = db.prepare(`
            INSERT OR REPLACE INTO guild_invite_settings 
            (guild_id, count_fake_invites, count_left_invites, enable_invite_welcome, invite_welcome_channel, invite_welcome_message)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          
          for (const setting of settings) {
            insertSettings.run(
              setting.guild_id,
              setting.count_fake_invites || 0,
              setting.count_left_invites || 0,
              setting.enable_invite_welcome || 0,
              setting.invite_welcome_channel,
              setting.invite_welcome_message || 'Hi, {user} Welcome to our server! You were invited by {inviter} who now has {invites} invites.'
            );
          }
          console.log(`Migrated ${settings.length} guild invite settings from old invite database`);
        }
        
        oldInviteDb.close();
      } catch (error) {
        console.error('Error migrating invite database:', error);
      }
    }
    
    console.log('Database migration completed');
  } catch (error) {
    console.error('Error during database migration:', error);
  }
}

module.exports = {
  db,
  dbDir,
  dbPath,
  getDatabasePath,
  initializeDatabase,
  checkDatabase,
  migrateFromOldDatabases
};