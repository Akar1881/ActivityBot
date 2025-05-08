/**
 * Invite database compatibility module
 * 
 * This file provides backward compatibility for code that imports from '../database/inviteDb'
 * It re-exports the invite-related functionality from the new unifiedDb.js module
 */

// Import all exports from unifiedDb.js
const { db, dbDir, initializeDatabase } = require('./unifiedDb');

// Create an alias for the initialization function
const initializeInviteDatabase = () => {
  // The invite tables are already initialized in unifiedDb.js's initializeDatabase function
  // This is just a no-op function for backward compatibility
  console.log('Invite database initialization handled by unified database');
};

// Export the database connection and functions
module.exports = {
  inviteDb: db, // Alias db as inviteDb for backward compatibility
  dbDir,
  initializeInviteDatabase
};