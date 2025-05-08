/**
 * Database compatibility module
 * 
 * This file provides backward compatibility for code that imports from '../database/db'
 * It re-exports all functionality from the new unifiedDb.js module
 */

// Import all exports from unifiedDb.js
const unifiedDb = require('./unifiedDb');

// Re-export everything from unifiedDb
module.exports = unifiedDb;