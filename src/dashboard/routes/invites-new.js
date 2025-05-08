const express = require('express');
const router = express.Router();
const { inviteDb, checkInviteDatabase } = require('../../database/inviteDb');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
};

// Middleware to check if user has manage guild permission
const hasGuildPermission = (req, res, next) => {
  const guild = req.user.guilds.find(g => g.id === req.params.guildId);
  if (guild && (guild.permissions & 0x20) === 0x20) {
    return next();
  }
  res.status(403).json({ error: 'You do not have permission to manage this server' });
};

// Get bot client from request
const getBot = (req) => {
  return req.app.get('client');
};

// Simple health check endpoint
router.get('/invite-settings-health', (req, res) => {
  try {
    // Check if database is accessible
    const tables = inviteDb.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all();
    
    res.json({
      status: 'ok',
      message: 'Invite settings API is working',
      tables: tables.map(t => t.name),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Invite settings API is not working properly',
      error: error.message
    });
  }
});

// Simple echo endpoint for testing
router.post('/invite-settings-echo', (req, res) => {
  try {
    console.log('Echo request received:', req.body);
    
    // Echo back the request body
    res.json({
      status: 'ok',
      message: 'Echo endpoint is working',
      receivedData: req.body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in echo endpoint:', error);
    res.status(500).json({
      status: 'error',
      message: 'Echo endpoint error',
      error: error.message
    });
  }
});

// Get guild invite settings
router.get('/guild/:guildId/invite-settings', isAuthenticated, hasGuildPermission, async (req, res) => {
    try {
        const { guildId } = req.params;
        
        console.log(`Getting invite settings for guild ${guildId}`);
        
        // Get settings from database
        const result = inviteDb.prepare(`
            SELECT * FROM guild_invite_settings WHERE guild_id = ?
        `).get(guildId);
        
        console.log(`Retrieved invite settings for guild ${guildId}:`, result);
        
        // If no settings exist, return default settings
        if (!result) {
            const defaultSettings = {
                count_fake_invites: false,
                count_left_invites: false,
                enable_invite_welcome: false,
                invite_welcome_channel: null,
                invite_welcome_message: 'Hi, {user} Welcome to our server! You were invited by {inviter} who now has {invites} invites.'
            };
            
            console.log(`No settings found, returning defaults:`, defaultSettings);
            return res.json(defaultSettings);
        }
        
        // Convert SQLite integers to booleans
        const settings = {
            ...result,
            count_fake_invites: result.count_fake_invites === 1,
            count_left_invites: result.count_left_invites === 1,
            enable_invite_welcome: result.enable_invite_welcome === 1
        };
        
        console.log(`Converted settings:`, settings);
        res.json(settings);
    } catch (error) {
        console.error('Error getting invite settings:', error);
        res.status(500).json({ error: 'Failed to get invite settings' });
    }
});

// Test endpoint to check if invite settings API is working
router.get('/guild/:guildId/invite-settings/test', async (req, res) => {
    console.log('==== INVITE SETTINGS TEST REQUEST ====');
    console.log('Test request received at:', new Date().toISOString());
    console.log('Guild ID:', req.params.guildId);
    
    try {
        const { guildId } = req.params;
        
        // Check database status
        const dbCheck = checkInviteDatabase();
        console.log('Database check results:', dbCheck);
        
        // Check if the guild settings exist
        let settingsStatus = 'Unknown';
        let settings = null;
        try {
            settings = inviteDb.prepare(`
                SELECT * FROM guild_invite_settings WHERE guild_id = ?
            `).get(guildId);
            
            settingsStatus = settings ? 'Found' : 'Not found';
            console.log('Guild settings:', settings);
        } catch (settingsError) {
            settingsStatus = `Error: ${settingsError.message}`;
            console.error('Settings retrieval error:', settingsError);
        }
        
        // Try to insert test data
        let testInsertStatus = 'Not attempted';
        try {
            // Check if test record exists
            const testRecord = inviteDb.prepare(`
                SELECT * FROM guild_invite_settings WHERE guild_id = 'test-record'
            `).get();
            
            if (!testRecord) {
                // Insert test record
                inviteDb.prepare(`
                    INSERT INTO guild_invite_settings (
                        guild_id, 
                        count_fake_invites, 
                        count_left_invites, 
                        enable_invite_welcome,
                        invite_welcome_message
                    ) VALUES (?, 1, 1, 1, ?)
                `).run('test-record', 'Test message');
                
                testInsertStatus = 'Inserted new test record';
            } else {
                // Update test record
                inviteDb.prepare(`
                    UPDATE guild_invite_settings 
                    SET count_fake_invites = 1
                    WHERE guild_id = 'test-record'
                `).run();
                
                testInsertStatus = 'Updated existing test record';
            }
            
            // Verify test record
            const verifyRecord = inviteDb.prepare(`
                SELECT * FROM guild_invite_settings WHERE guild_id = 'test-record'
            `).get();
            
            console.log('Test record verification:', verifyRecord);
        } catch (testError) {
            testInsertStatus = `Error: ${testError.message}`;
            console.error('Test insert error:', testError);
        }
        
        console.log('Sending test response');
        res.json({
            status: 'API is working',
            guildId,
            database: dbCheck,
            settings: {
                status: settingsStatus,
                data: settings
            },
            testInsert: testInsertStatus,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('==== ERROR IN TEST ENDPOINT ====');
        console.error('Error:', error);
        console.error('Error stack:', error.stack);
        
        res.status(500).json({ 
            error: 'Test failed',
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
    
    console.log('==== END OF INVITE SETTINGS TEST REQUEST ====');
});

// Update guild invite settings - simplified version
router.post('/guild/:guildId/invite-settings', isAuthenticated, hasGuildPermission, async (req, res) => {
    try {
        const { guildId } = req.params;
        
        // Extract settings from request body
        const {
            count_fake_invites,
            count_left_invites,
            enable_invite_welcome,
            invite_welcome_channel,
            invite_welcome_message
        } = req.body;
        
        console.log('Saving invite settings for guild:', guildId);
        console.log('Settings to save:', req.body);
        
        // Convert boolean values to integers for SQLite
        const countFakeInvites = count_fake_invites === true || count_fake_invites === 'true' ? 1 : 0;
        const countLeftInvites = count_left_invites === true || count_left_invites === 'true' ? 1 : 0;
        const enableInviteWelcome = enable_invite_welcome === true || enable_invite_welcome === 'true' ? 1 : 0;
        const welcomeMessage = invite_welcome_message || 'Hi, {user} Welcome to our server! You were invited by {inviter} who now has {invites} invites.';
        
        // Use a transaction to ensure data integrity
        const transaction = inviteDb.transaction(() => {
            // Use INSERT OR REPLACE to handle both new and existing settings
            inviteDb.prepare(`
                INSERT OR REPLACE INTO guild_invite_settings (
                    guild_id,
                    count_fake_invites,
                    count_left_invites,
                    enable_invite_welcome,
                    invite_welcome_channel,
                    invite_welcome_message
                )
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                guildId,
                countFakeInvites,
                countLeftInvites,
                enableInviteWelcome,
                invite_welcome_channel || null,
                welcomeMessage
            );
        });
        
        // Execute the transaction
        transaction();
        
        // Verify the settings were saved
        const savedSettings = inviteDb.prepare(`
            SELECT * FROM guild_invite_settings WHERE guild_id = ?
        `).get(guildId);
        
        if (!savedSettings) {
            throw new Error('Settings were not saved to the database');
        }
        
        console.log('Settings saved successfully:', savedSettings);
        
        // Return success response
        res.json({
            success: true,
            message: 'Invite settings saved successfully',
            settings: {
                count_fake_invites: savedSettings.count_fake_invites === 1,
                count_left_invites: savedSettings.count_left_invites === 1,
                enable_invite_welcome: savedSettings.enable_invite_welcome === 1,
                invite_welcome_channel: savedSettings.invite_welcome_channel,
                invite_welcome_message: savedSettings.invite_welcome_message
            }
        });
    } catch (error) {
        console.error('Error saving invite settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save invite settings',
            message: error.message
        });
    }
});

// Reset guild invites
router.post('/guild/:guildId/reset-invites', isAuthenticated, hasGuildPermission, async (req, res) => {
    try {
        const { guildId } = req.params;
        const bot = getBot(req);
        
        // Delete all invites for the guild
        inviteDb.prepare(`
            DELETE FROM invites WHERE guild_id = ?
        `).run(guildId);
        
        // Reset all invite counts for the guild
        inviteDb.prepare(`
            DELETE FROM invite_counts WHERE guild_id = ?
        `).run(guildId);
        
        // Fetch new invites from Discord if bot is available
        if (bot) {
            try {
                const guild = bot.guilds.cache.get(guildId);
                if (guild) {
                    // Fetch new invites
                    const invites = await guild.invites.fetch();
                    console.log(`Fetched ${invites.size} invites for guild ${guildId}`);
                }
            } catch (botError) {
                console.error(`Error fetching invites from Discord: ${botError.message}`);
            }
        }
        
        res.json({ success: true, message: 'All invites have been reset' });
    } catch (error) {
        console.error('Error resetting invites:', error);
        res.status(500).json({ error: 'Failed to reset invites' });
    }
});

module.exports = router;