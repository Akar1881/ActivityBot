/**
 * Utility functions for performance optimization
 */
const logger = require('./logger');

/**
 * Wraps a command execution function with performance optimizations
 * @param {Function} executeFn - The original command execute function
 * @returns {Function} - The wrapped function with performance optimizations
 */
function optimizeCommand(executeFn) {
  return async function(interaction, client) {
    // Start performance timer
    const startTime = process.hrtime();
    
    try {
      // Immediately defer reply to prevent timeouts
      if (!interaction.deferred && !interaction.replied) {
        const ephemeral = interaction.options?.getBoolean('ephemeral') || false;
        await interaction.deferReply({ 
          flags: ephemeral ? 64 : 0 // Use flags instead of ephemeral property
        });
      }
      
      // Execute the original function
      const result = await executeFn.call(this, interaction, client);
      
      // Log performance metrics
      const endTime = process.hrtime(startTime);
      const executionTime = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
      
      if (executionTime > 1000) {
        logger.warn(`Command ${interaction.commandName} took ${executionTime}ms to execute - consider optimizing`);
      } else {
        logger.info(`Command ${interaction.commandName} executed in ${executionTime}ms`);
      }
      
      return result;
    } catch (error) {
      // Log performance metrics even on error
      const endTime = process.hrtime(startTime);
      const executionTime = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2);
      
      logger.error(`Error in command ${interaction.commandName || 'unknown'} (${executionTime}ms):`, error);
      logger.error(`Error details:`, error);
      
      // Handle the error response
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(`An error occurred while processing your request: ${error.message}`);
        } else {
          await interaction.reply({ content: `An error occurred while processing your request: ${error.message}`, ephemeral: true });
        }
      } catch (followUpError) {
        logger.error('Error sending error response:', followUpError);
      }
    }
  };
}

/**
 * Creates a cached version of a function that will reuse results for identical inputs
 * @param {Function} fn - The function to cache
 * @param {number} ttl - Time to live for cache entries in milliseconds (default: 60000ms = 1 minute)
 * @returns {Function} - The cached function
 */
function createCachedFunction(fn, ttl = 60000) {
  const cache = new Map();
  
  return function(...args) {
    // Create a cache key from the arguments
    const key = JSON.stringify(args);
    
    // Check if we have a cached result that hasn't expired
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.result;
    }
    
    // Call the original function and cache the result
    const result = fn.apply(this, args);
    
    // Handle promises
    if (result instanceof Promise) {
      return result.then(value => {
        cache.set(key, { result: value, timestamp: Date.now() });
        return value;
      });
    }
    
    // Cache and return the result
    cache.set(key, { result, timestamp: Date.now() });
    return result;
  };
}

module.exports = {
  optimizeCommand,
  createCachedFunction
};