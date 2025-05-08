/**
 * Cache utility for the bot
 * Provides functions to clear caches when settings are updated
 */

// These maps will be empty here, but they're defined to document what caches exist
// The actual cache instances are in the event handlers
const settingsCache = new Map();
const excludedChannelsCache = new Map();
const excludedRolesCache = new Map();

/**
 * Clear all caches for a specific guild
 * @param {string} guildId - The guild ID to clear caches for
 */
function clearGuildCaches(guildId) {
  try {
    // Try to access caches from messageCreate.js
    const messageCreateModule = require('../events/messageCreate');
    if (messageCreateModule.settingsCache) {
      messageCreateModule.settingsCache.delete(guildId);
    }
    if (messageCreateModule.excludedChannelsCache) {
      messageCreateModule.excludedChannelsCache.delete(guildId);
    }
    if (messageCreateModule.excludedRolesCache) {
      messageCreateModule.excludedRolesCache.delete(guildId);
    }
  } catch (error) {
    // Ignore errors if the module doesn't export its caches
  }
  
  try {
    // Try to access caches from voiceStateUpdate.js
    const voiceStateModule = require('../events/voiceStateUpdate');
    if (voiceStateModule.settingsCache) {
      voiceStateModule.settingsCache.delete(guildId);
    }
    if (voiceStateModule.excludedChannelsCache) {
      voiceStateModule.excludedChannelsCache.delete(guildId);
    }
    if (voiceStateModule.excludedRolesCache) {
      voiceStateModule.excludedRolesCache.delete(guildId);
    }
  } catch (error) {
    // Ignore errors if the module doesn't export its caches
  }
  
  // Clear local cache instances (these are empty but included for completeness)
  settingsCache.delete(guildId);
  excludedChannelsCache.delete(guildId);
  excludedRolesCache.delete(guildId);
  
  console.log(`Cleared caches for guild ${guildId}`);
}

/**
 * Clear settings cache for a specific guild
 * @param {string} guildId - The guild ID to clear settings cache for
 */
function clearSettingsCache(guildId) {
  try {
    const messageCreateModule = require('../events/messageCreate');
    if (messageCreateModule.settingsCache) {
      messageCreateModule.settingsCache.delete(guildId);
    }
  } catch (error) {
    // Ignore errors
  }
  
  try {
    const voiceStateModule = require('../events/voiceStateUpdate');
    if (voiceStateModule.settingsCache) {
      voiceStateModule.settingsCache.delete(guildId);
    }
  } catch (error) {
    // Ignore errors
  }
  
  settingsCache.delete(guildId);
  console.log(`Cleared settings cache for guild ${guildId}`);
}

/**
 * Clear excluded channels cache for a specific guild
 * @param {string} guildId - The guild ID to clear excluded channels cache for
 */
function clearExcludedChannelsCache(guildId) {
  try {
    const messageCreateModule = require('../events/messageCreate');
    if (messageCreateModule.excludedChannelsCache) {
      messageCreateModule.excludedChannelsCache.delete(guildId);
    }
  } catch (error) {
    // Ignore errors
  }
  
  try {
    const voiceStateModule = require('../events/voiceStateUpdate');
    if (voiceStateModule.excludedChannelsCache) {
      voiceStateModule.excludedChannelsCache.delete(guildId);
    }
  } catch (error) {
    // Ignore errors
  }
  
  excludedChannelsCache.delete(guildId);
  console.log(`Cleared excluded channels cache for guild ${guildId}`);
}

/**
 * Clear excluded roles cache for a specific guild
 * @param {string} guildId - The guild ID to clear excluded roles cache for
 */
function clearExcludedRolesCache(guildId) {
  try {
    const messageCreateModule = require('../events/messageCreate');
    if (messageCreateModule.excludedRolesCache) {
      messageCreateModule.excludedRolesCache.delete(guildId);
    }
  } catch (error) {
    // Ignore errors
  }
  
  try {
    const voiceStateModule = require('../events/voiceStateUpdate');
    if (voiceStateModule.excludedRolesCache) {
      voiceStateModule.excludedRolesCache.delete(guildId);
    }
  } catch (error) {
    // Ignore errors
  }
  
  excludedRolesCache.delete(guildId);
  console.log(`Cleared excluded roles cache for guild ${guildId}`);
}

module.exports = {
  clearGuildCaches,
  clearSettingsCache,
  clearExcludedChannelsCache,
  clearExcludedRolesCache
};