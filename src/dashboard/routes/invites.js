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
        if (tables.some(t => t.name === 'guild_invite_settings')) {
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

// Update guild invite settings
router.post('/guild/:guildId/invite-settings', isAuthenticated, hasGuildPermission, async (req, res) => {
    console.log('==== INVITE SETTINGS UPDATE REQUEST ====');
    console.log('Request received at:', new Date().toISOString());
    console.log('Request URL:', req.originalUrl);
    console.log('Request method:', req.method);
    console.log('Request headers:', req.headers);
    console.log('Request params:', req.params);
    console.log('Request query:', req.query);
    console.log('Request body:', req.body);
    console.log('User:', req.user ? req.user.id : 'Not authenticated');
    
    // Check database status before processing
    console.log('Checking database before processing request:');
    const dbCheckBefore = checkInviteDatabase();
    console.log('Database check results:', dbCheckBefore);
    
    try {
        const { guildId } = req.params;
        
        // Check if request body is valid
        if (!req.body || typeof req.body !== 'object') {
            console.error('Invalid request body:', req.body);
            return res.status(400).json({ error: 'Invalid request body' });
        }
        
        const {
            count_fake_invites,
            count_left_invites,
            enable_invite_welcome,
            invite_welcome_channel,
            invite_welcome_message
        } = req.body;
        
        console.log('Processing invite settings update:');
        console.log('Guild ID:', guildId);
        console.log('Request body parsed:', {
            count_fake_invites,
            count_left_invites,
            enable_invite_welcome,
            invite_welcome_channel,
            invite_welcome_message
        });
        
        // Convert booleans to integers for SQLite
        const countFakeInvites = count_fake_invites === true || count_fake_invites === 'true' ? 1 : 0;
        const countLeftInvites = count_left_invites === true || count_left_invites === 'true' ? 1 : 0;
        const enableInviteWelcome = enable_invite_welcome === true || enable_invite_welcome === 'true' ? 1 : 0;
        const welcomeMessage = invite_welcome_message || 'Hi, {user} Welcome to our server! You were invited by {inviter} who now has {invites} invites.';
        
        // Check if settings exist
        const existingSettings = inviteDb.prepare(`
            SELECT * FROM guild_invite_settings WHERE guild_id = ?
        `).get(guildId);
        
        console.log('Existing settings:', existingSettings);
        console.log('Values to save:');
        console.log('countFakeInvites:', countFakeInvites);
        console.log('countLeftInvites:', countLeftInvites);
        console.log('enableInviteWelcome:', enableInviteWelcome);
        console.log('invite_welcome_channel:', invite_welcome_channel);
        console.log('welcomeMessage:', welcomeMessage);
        
        if (existingSettings) {
            // Update existing settings
            console.log('Updating existing settings...');
            inviteDb.prepare(`
                UPDATE guild_invite_settings
                SET count_fake_invites = ?,
                    count_left_invites = ?,
                    enable_invite_welcome = ?,
                    invite_welcome_channel = ?,
                    invite_welcome_message = ?
                WHERE guild_id = ?
            `).run(
                countFakeInvites,
                countLeftInvites,
                enableInviteWelcome,
                invite_welcome_channel || null,
                welcomeMessage,
                guildId
            );
            console.log('Settings updated successfully');
        } else {
            // Insert new settings
            console.log('Inserting new settings...');
            inviteDb.prepare(`
                INSERT INTO guild_invite_settings (
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
            console.log('Settings inserted successfully');
        }
        
        // Check database status after saving
        console.log('Checking database after saving:');
        const dbCheckAfter = checkInviteDatabase();
        console.log('Database check results after saving:', dbCheckAfter);
        
        // Verify the settings were saved correctly
        try {
            const savedSettings = inviteDb.prepare(`
                SELECT * FROM guild_invite_settings WHERE guild_id = ?
            `).get(guildId);
            
            console.log('Saved settings retrieved from database:', savedSettings);
            
            // Log database file location
            console.log('Database file location:', inviteDb.name);
            
            // Check if settings match what was requested
            if (savedSettings) {
                console.log('Settings verification:');
                console.log('count_fake_invites:', savedSettings.count_fake_invites === countFakeInvites ? 'MATCH' : 'MISMATCH');
                console.log('count_left_invites:', savedSettings.count_left_invites === countLeftInvites ? 'MATCH' : 'MISMATCH');
                console.log('enable_invite_welcome:', savedSettings.enable_invite_welcome === enableInviteWelcome ? 'MATCH' : 'MISMATCH');
            } else {
                console.error('CRITICAL ERROR: Settings were not saved to database!');
                
                // Try to force insert again
                try {
                    console.log('Attempting forced insert...');
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
                    
                    console.log('Forced insert completed');
                    
                    // Check if it worked
                    const forcedSettings = inviteDb.prepare(`
                        SELECT * FROM guild_invite_settings WHERE guild_id = ?
                    `).get(guildId);
                    
                    console.log('Settings after forced insert:', forcedSettings);
                } catch (forceError) {
                    console.error('Forced insert failed:', forceError);
                }
            }
            
            console.log('Sending success response to client');
            res.json({ 
                success: true,
                settings: savedSettings,
                dbCheck: dbCheckAfter,
                timestamp: new Date().toISOString()
            });
        } catch (dbError) {
            console.error('Error retrieving saved settings:', dbError);
            console.error('Error stack:', dbError.stack);
            
            // Still return success since we attempted to save
            console.log('Sending partial success response to client');
            res.json({ 
                success: true,
                message: 'Settings saved but could not verify',
                error: dbError.message,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('==== ERROR UPDATING INVITE SETTINGS ====');
        console.error('Error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error occurred at:', new Date().toISOString());
        
        // Try to get database status
        try {
            const dbStatus = inviteDb.prepare('PRAGMA integrity_check').get();
            console.log('Database integrity check:', dbStatus);
        } catch (dbError) {
            console.error('Could not check database integrity:', dbError);
        }
        
        // Make sure we return a proper JSON response even in case of error
        console.log('Sending error response to client');
        res.status(500).json({ 
            error: 'Failed to update invite settings',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
    
    console.log('==== END OF INVITE SETTINGS UPDATE REQUEST ====');
});

// Reset all invites for a guild
router.post('/guild/:guildId/reset-invites', isAuthenticated, hasGuildPermission, async (req, res) => {
    try {
        const { guildId } = req.params;
        const bot = getBot(req);
        
        if (!bot || !bot.inviteTracker) {
            console.error('Bot or invite tracker not available');
            
            // If the invite tracker is not available, try to reset invites directly in the database
            try {
                // Delete all invites for the guild
                inviteDb.prepare('DELETE FROM invites WHERE guild_id = ?').run(guildId);
                
                // Delete all invite counts for the guild
                inviteDb.prepare('DELETE FROM invite_counts WHERE guild_id = ?').run(guildId);
                
                console.log(`Manually reset invites for guild ${guildId}`);
                return res.json({ success: true });
            } catch (dbError) {
                console.error('Error manually resetting invites:', dbError);
                return res.status(500).json({ error: 'Failed to reset invites: Database error' });
            }
        }
        
        // Reset all invites for the guild using the invite tracker
        const success = await bot.inviteTracker.resetInvites(guildId);
        
        if (success) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: 'Failed to reset invites' });
        }
    } catch (error) {
        console.error('Error resetting invites:', error);
        res.status(500).json({ error: 'Failed to reset invites' });
    }
});

module.exports = router;