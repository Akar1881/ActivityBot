/**
 * Simple logger utility
 */
const logger = {
    info: (message) => {
        console.log(`[INFO] ${message}`);
    },
    
    warn: (message) => {
        console.warn(`[WARN] ${message}`);
    },
    
    error: (message, error) => {
        console.error(`[ERROR] ${message}`, error || '');
    },
    
    debug: (message) => {
        if (process.env.DEBUG) {
            console.log(`[DEBUG] ${message}`);
        }
    }
};

module.exports = logger;