require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const passport = require('passport');
const { Strategy } = require('passport-discord');
const path = require('path');
const cookieParser = require('cookie-parser');
const { db, dbDir, initializeDatabase } = require('../database/db');
const { inviteDb, initializeInviteDatabase } = require('../database/inviteDb');

// Create database directory if it doesn't exist
try {
  const fs = require('fs');
  const path = require('path');
  const dbDir = path.join(process.cwd(), 'database');
  
  if (!fs.existsSync(dbDir)) {
    console.log(`Creating database directory for dashboard: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('Database directory created successfully for dashboard');
  }
} catch (error) {
  console.error('Failed to create database directory for dashboard:', error);
  console.warn('Database operations may fail if no writable directory is available');
}

// Initialize database tables
try {
  initializeDatabase();
  console.log('Main database initialized for dashboard');
} catch (error) {
  console.error('Error initializing main database for dashboard:', error);
}

// Initialize invite database tables
try {
  initializeInviteDatabase();
  console.log('Invite database initialized for dashboard');
} catch (error) {
  console.error('Error initializing invite database for dashboard:', error);
}
const { Client, GatewayIntentBits } = require('discord.js');
const { translate, availableLanguages, defaultLanguage } = require('../utils/language');

const app = express();

// Create Discord client for bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
});

// Make client available to routes
app.set('client', client);

// Setup view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Make site configuration available to all templates
app.use((req, res, next) => {
  // Get language from cookie, query parameter, or default
  const lang = req.query.lang || req.cookies?.lang || defaultLanguage;
  
  // Set language cookie if it doesn't exist or was changed
  if (!req.cookies?.lang || req.query.lang) {
    res.cookie('lang', lang, { maxAge: 365 * 24 * 60 * 60 * 1000 }); // 1 year
  }
  
  // Make language utilities available to templates
  res.locals.lang = lang;
  res.locals.t = (key) => translate(key, lang);
  res.locals.availableLanguages = availableLanguages;
  
  // Site configuration
  res.locals.siteName = process.env.SITE_NAME || 'Discord Leveling Bot';
  res.locals.siteDescription = process.env.SITE_DESCRIPTION || 'Track chat and voice activity, reward your community!';
  next();
});

// Session middleware
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: dbDir
  }),
  secret: process.env.SESSION_SECRET || 'default_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 86400000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Passport config
passport.use(new Strategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: process.env.REDIRECT_URI,
  scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Serve logo from src/logo directory
app.get('/logo', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'logo', 'logo.png'));
});

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/leaderboard', require('./routes/leaderboard'));
app.use('/', require('./routes/invites-new'));

// Error handling
app.use((err, req, res, next) => {
  console.error('Express error:', err.stack);
  
  // Check if the request expects JSON
  const isJsonRequest = req.headers['content-type']?.includes('application/json') || 
                        req.headers['accept']?.includes('application/json');
  
  if (isJsonRequest) {
    // Return JSON error for API requests
    return res.status(500).json({ 
      error: 'Server error',
      message: err.message
    });
  }
  
  // Otherwise render the error page
  res.status(500).render('error', { error: err });
});

// Initialize bot and start server
async function startServer() {
  try {
    await client.login(process.env.DISCORD_TOKEN);
    console.log(`Bot logged in as ${client.user.tag}`);
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Dashboard running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();