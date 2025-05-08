const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { config } = require('dotenv');
const path = require('path');
const { initializeDatabase, migrateFromOldDatabases } = require('./database/unifiedDb');
const { initVoiceTimer } = require('./handlers/voiceTimer');
const { initializeXpHistory } = require('./handlers/xpHistory');
const { initScheduler } = require('./handlers/scheduler');
const InviteTracker = require('./modules/inviteTrackerUnified');
const fs = require('fs');

// Load environment variables
try {
  config();
  if (!process.env.DISCORD_TOKEN) {
    console.error('DISCORD_TOKEN is missing in .env file');
    process.exit(1);
  }
} catch (error) {
  console.error('Error loading environment variables:', error);
  process.exit(1);
}

// Create Discord client with proper error handling
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMembers
  ],
  failIfNotExists: false,
  retryLimit: 5
});

// Initialize collections
client.commands = new Collection();
client.buttons = new Collection();
client.selectMenus = new Collection();
client.modals = new Collection();

// Global error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // Don't exit the process, just log the error
});

// Create database directory if it doesn't exist
try {
  const fs = require('fs');
  const path = require('path');
  const dbDir = path.join(process.cwd(), 'database');
  
  if (!fs.existsSync(dbDir)) {
    console.log(`Creating database directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('Database directory created successfully');
  }
} catch (error) {
  console.error('Failed to create database directory:', error);
  console.warn('Database operations may fail if no writable directory is available');
}

// Initialize unified database
try {
  // Initialize the database
  initializeDatabase();
  console.log('Unified database initialized successfully');
  
  // Migrate data from old databases if they exist
  migrateFromOldDatabases();
} catch (error) {
  console.error('Failed to initialize unified database:', error);
  console.warn('Continuing without full database initialization. Some features may not work properly.');
  // Don't exit, try to continue with limited functionality
}

// Load handlers
try {
  require('./handlers/commands')(client);
  require('./handlers/events')(client);
  require('./handlers/components')(client);
} catch (error) {
  console.error('Error loading handlers:', error);
  process.exit(1);
}

// Client error handling
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

client.on('shardError', (error) => {
  console.error('WebSocket connection error:', error);
});

// Initialize systems when the bot is ready
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  // Initialize XP history for existing users
  initializeXpHistory();
  
  // Initialize voice XP timer after the bot is fully ready
  initVoiceTimer(client);
  
  // Initialize scheduler for leaderboard resets
  initScheduler();
  
  // Initialize invite tracker
  try {
    // Now initialize the invite tracker
    client.inviteTracker = new InviteTracker(client);
    console.log('Invite tracker initialized');
  } catch (error) {
    console.error('Failed to initialize invite tracker:', error);
    // Continue without invite tracker functionality
  }
});

// Login bot with retry mechanism
function loginWithRetry(retries = 5, delay = 5000) {
  client.login(process.env.DISCORD_TOKEN)
    .catch(error => {
      console.error('Failed to login:', error);
      if (retries > 0) {
        console.log(`Retrying login in ${delay/1000} seconds... (${retries} attempts left)`);
        setTimeout(() => loginWithRetry(retries - 1, delay), delay);
      } else {
        console.error('Maximum login attempts reached. Exiting...');
        process.exit(1);
      }
    });
}

loginWithRetry();