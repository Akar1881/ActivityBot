const express = require('express');
const router = express.Router();
const { db } = require('../../database/db');
const { inviteDb } = require('../../database/inviteDb');
const { clearGuildCaches, clearSettingsCache, clearExcludedChannelsCache, clearExcludedRolesCache } = require('../../handlers/cache');

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

router.get('/', isAuthenticated, async (req, res) => {
  try {
    console.log('Dashboard route accessed');
    
    // Check if client is available
    const client = req.app.get('client');
    if (!client) {
      console.error('Discord client is not available');
      return res.status(500).send('Internal server error: Discord client not available');
    }
    
    console.log('User data:', req.user ? 'User authenticated' : 'User not authenticated');
    
    // Check if user has guilds
    if (!req.user || !req.user.guilds || !Array.isArray(req.user.guilds)) {
      console.error('User guilds not available:', req.user);
      return res.status(400).send('User guild data not available. Try logging out and back in.');
    }
    
    console.log(`User has ${req.user.guilds.length} guilds`);
    
    // Filter guilds where user has manage server permission AND bot is present
    const guilds = req.user.guilds.filter(guild => {
      const hasPermission = (guild.permissions & 0x20) === 0x20;
      const botPresent = client.guilds.cache.has(guild.id);
      return hasPermission && botPresent;
    });
    
    console.log(`Filtered to ${guilds.length} guilds where user has permission and bot is present`);
    
    // Initialize settings for guilds if they don't exist
    try {
      guilds.forEach(guild => {
        const settings = db.prepare('SELECT 1 FROM guild_settings WHERE guild_id = ?').get(guild.id);
        if (!settings) {
          db.prepare(`
            INSERT INTO guild_settings (
              guild_id,
              guild_name,
              min_xp_per_message,
              max_xp_per_message,
              min_xp_per_voice_minute,
              max_xp_per_voice_minute,
              message_cooldown,
              voice_cooldown,
              enable_announcements,
              announcement_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            guild.id,
            guild.name,
            15, // default min_xp_per_message
            25, // default max_xp_per_message
            10, // default min_xp_per_voice_minute
            20, // default max_xp_per_voice_minute
            60, // default message_cooldown
            300, // default voice_cooldown
            1, // default enable_announcements
            '{user} reached level {currentlevel} in {type}!' // default announcement_message
          );
        }
      });
    } catch (dbError) {
      console.error('Database error while initializing guild settings:', dbError);
      // Continue execution even if DB operations fail
    }
    
    console.log('Rendering dashboard template');
    
    // Render the dashboard template
    res.render('dashboard', { 
      user: req.user,
      guilds: guilds,
      path: '/dashboard'
    });
    
    console.log('Dashboard rendered successfully');
  } catch (error) {
    console.error('Error in dashboard route:', error);
    res.status(500).send('Internal server error: ' + error.message);
  }
});

router.get('/guild/:guildId', isAuthenticated, hasGuildPermission, async (req, res) => {
  try {
    console.log(`Guild settings route accessed for guild ID: ${req.params.guildId}`);
    
    const { guildId } = req.params;
    
    // Get guild settings with error handling
    let settings;
    try {
        settings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
        console.log(`Guild settings retrieved: ${settings ? 'Yes' : 'No'}`);
    } catch (error) {
        console.error(`Error getting guild settings: ${error.message}`);
        // Create default settings if table doesn't exist
        settings = {
            guild_id: guildId,
            guild_name: guild?.name || 'Unknown Server',
            min_xp_per_message: 15,
            max_xp_per_message: 25,
            min_xp_per_voice_minute: 10,
            max_xp_per_voice_minute: 20,
            min_voice_minutes_to_earn: 1,
            max_voice_minutes_to_earn: 30,
            message_cooldown: 60,
            voice_cooldown: 300,
            xp_multiplier: 1.0,
            announcement_channel: null,
            enable_announcements: true,
            announcement_message: '{user} reached level {currentlevel} in {type}!'
        };
    }
    
    // Get invite settings with error handling
    let inviteSettings;
    try {
        inviteSettings = inviteDb.prepare('SELECT * FROM guild_invite_settings WHERE guild_id = ?').get(guildId);
        console.log(`Invite settings retrieved: ${inviteSettings ? 'Yes' : 'No'}`);
    } catch (error) {
        console.error(`Error getting invite settings: ${error.message}`);
        inviteSettings = null;
    }
    
    // Default invite settings if none exist
    const defaultInviteSettings = {
        count_fake_invites: false,
        count_left_invites: false,
        enable_invite_welcome: false,
        invite_welcome_channel: null,
        invite_welcome_message: 'Hi, {user} Welcome to our server! You were invited by {inviter} who now has {invites} invites.'
    };
    
    // Process invite settings with proper boolean conversion
    const processedInviteSettings = inviteSettings ? {
        ...inviteSettings,
        count_fake_invites: inviteSettings.count_fake_invites === 1,
        count_left_invites: inviteSettings.count_left_invites === 1,
        enable_invite_welcome: inviteSettings.enable_invite_welcome === 1
    } : defaultInviteSettings;
    
    console.log('Processed invite settings:', processedInviteSettings);
    
    // Merge all settings
    const mergedSettings = { ...settings, ...processedInviteSettings };
    
    // Get role rewards with error handling
    let roleRewards = [];
    try {
        roleRewards = db.prepare('SELECT * FROM role_rewards WHERE guild_id = ?').all(guildId);
        console.log(`Role rewards retrieved: ${roleRewards.length}`);
    } catch (error) {
        console.error(`Error getting role rewards: ${error.message}`);
    }
    
    // Get excluded channels with error handling
    let excludedChannelsData = [];
    try {
        excludedChannelsData = db.prepare('SELECT * FROM excluded_channels WHERE guild_id = ?').all(guildId);
        console.log(`Excluded channels retrieved: ${excludedChannelsData.length}`);
    } catch (error) {
        console.error(`Error getting excluded channels: ${error.message}`);
    }
    
    // Get excluded roles with error handling
    let excludedRolesData = [];
    try {
        excludedRolesData = db.prepare('SELECT * FROM excluded_roles WHERE guild_id = ?').all(guildId);
        console.log(`Excluded roles retrieved: ${excludedRolesData.length}`);
    } catch (error) {
        console.error(`Error getting excluded roles: ${error.message}`);
    }
    
    // Get all channels from the guild
    const client = req.app.get('client');
    const guild = client.guilds.cache.get(guildId);
    
    if (!guild) {
      console.error(`Guild with ID ${guildId} not found in bot's cache`);
    }
    
    const channels = guild?.channels.cache
      .filter(channel => channel.type === 0 || channel.type === 2) // Text channels (0) and voice channels (2)
      .map(channel => ({
        id: channel.id,
        name: channel.name,
        type: channel.type === 0 ? 'text' : 'voice'
      })) || [];
    
    console.log(`Channels retrieved: ${channels.length}`);
    
    // Get guild roles
    const roles = guild?.roles.cache
      .filter(role => !role.managed && role.name !== '@everyone') // Filter out bot roles and @everyone
      .sort((a, b) => b.position - a.position) // Sort by position (highest first)
      .map(role => ({
        id: role.id,
        name: role.name,
        color: role.hexColor || '#99AAB5',
        position: role.position
      })) || [];
    
    console.log(`Roles retrieved: ${roles.length}`);
    
    // Enrich excluded channels and roles with names
    const excludedChannels = excludedChannelsData.map(item => {
      const channelInfo = channels.find(c => c.id === item.channel_id) || {};
      return {
        ...item,
        name: channelInfo.name || 'Unknown Channel'
      };
    });
    
    const excludedRoles = excludedRolesData.map(item => {
      const roleInfo = roles.find(r => r.id === item.role_id) || {};
      return {
        ...item,
        name: roleInfo.name || 'Unknown Role',
        color: roleInfo.color || '#99AAB5'
      };
    });
    
    console.log('Rendering guild-settings template');
    
    res.render('guild-settings', {
      user: req.user,
      guildId,
      settings: mergedSettings,
      roleRewards,
      channels,
      roles,
      excludedChannels,
      excludedRoles,
      path: '/dashboard'
    });
    
    console.log('Guild settings rendered successfully');
  } catch (error) {
    console.error(`Error in guild settings route for guild ID ${req.params.guildId}:`, error);
    res.status(500).send('Internal server error: ' + error.message);
  }
});

// Update guild settings
router.post('/guild/:guildId/settings', isAuthenticated, hasGuildPermission, async (req, res) => {
  const { guildId } = req.params;
  const {
    min_xp_per_message,
    max_xp_per_message,
    min_xp_per_voice_minute,
    max_xp_per_voice_minute,
    min_voice_minutes_to_earn,
    max_voice_minutes_to_earn,
    message_cooldown,
    voice_cooldown,
    xp_multiplier,
    enable_announcements,
    announcement_channel,
    announcement_message
  } = req.body;

  try {
    console.log('Updating settings for guild:', guildId);
    console.log('Request body:', req.body);
    
    // Check if settings exist
    const existingSettings = db.prepare('SELECT 1 FROM guild_settings WHERE guild_id = ?').get(guildId);

    // Check if the guild_settings table has the required columns
    let tableInfo;
    try {
      tableInfo = db.prepare("PRAGMA table_info(guild_settings)").all();
      console.log('Guild settings table columns:', tableInfo.map(col => col.name));
      
      // Add missing columns if needed
      const columns = tableInfo.map(col => col.name);
      
      if (!columns.includes('min_voice_minutes_to_earn')) {
        console.log('Adding min_voice_minutes_to_earn column');
        db.prepare('ALTER TABLE guild_settings ADD COLUMN min_voice_minutes_to_earn INTEGER DEFAULT 1').run();
      }
      
      if (!columns.includes('max_voice_minutes_to_earn')) {
        console.log('Adding max_voice_minutes_to_earn column');
        db.prepare('ALTER TABLE guild_settings ADD COLUMN max_voice_minutes_to_earn INTEGER DEFAULT 30').run();
      }
      
      if (!columns.includes('xp_multiplier')) {
        console.log('Adding xp_multiplier column');
        db.prepare('ALTER TABLE guild_settings ADD COLUMN xp_multiplier REAL DEFAULT 1.0').run();
      }
    } catch (schemaError) {
      console.error('Error checking schema:', schemaError);
    }

    if (existingSettings) {
      // Update existing settings
      db.prepare(`
        UPDATE guild_settings 
        SET 
          min_xp_per_message = ?,
          max_xp_per_message = ?,
          min_xp_per_voice_minute = ?,
          max_xp_per_voice_minute = ?,
          min_voice_minutes_to_earn = ?,
          max_voice_minutes_to_earn = ?,
          message_cooldown = ?,
          voice_cooldown = ?,
          xp_multiplier = ?,
          enable_announcements = ?,
          announcement_channel = ?,
          announcement_message = ?
        WHERE guild_id = ?
      `).run(
        min_xp_per_message,
        max_xp_per_message,
        min_xp_per_voice_minute,
        max_xp_per_voice_minute,
        min_voice_minutes_to_earn || 1,
        max_voice_minutes_to_earn || 30,
        message_cooldown,
        voice_cooldown,
        xp_multiplier || 1.0,
        enable_announcements === 'true' || enable_announcements === true || enable_announcements === 'on' ? 1 : 0,
        announcement_channel,
        announcement_message,
        guildId
      );
      
      console.log('Settings updated successfully');
    } else {
      // Insert new settings
      db.prepare(`
        INSERT INTO guild_settings (
          guild_id,
          min_xp_per_message,
          max_xp_per_message,
          min_xp_per_voice_minute,
          max_xp_per_voice_minute,
          min_voice_minutes_to_earn,
          max_voice_minutes_to_earn,
          message_cooldown,
          voice_cooldown,
          xp_multiplier,
          enable_announcements,
          announcement_channel,
          announcement_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        guildId,
        min_xp_per_message,
        max_xp_per_message,
        min_xp_per_voice_minute,
        max_xp_per_voice_minute,
        min_voice_minutes_to_earn || 1,
        max_voice_minutes_to_earn || 30,
        message_cooldown,
        voice_cooldown,
        xp_multiplier || 1.0,
        enable_announcements === 'true' || enable_announcements === true || enable_announcements === 'on' ? 1 : 0,
        announcement_channel,
        announcement_message
      );
      
      console.log('New settings inserted successfully');
    }

    // Clear settings cache for this guild to ensure changes take effect immediately
    try {
      clearSettingsCache(guildId);
      console.log(`Cleared settings cache for guild ${guildId}`);
    } catch (cacheError) {
      console.error('Error clearing settings cache:', cacheError);
      // Continue even if cache clearing fails
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings: ' + error.message });
  }
});

// Add role reward
router.post('/guild/:guildId/role-rewards', isAuthenticated, hasGuildPermission, async (req, res) => {
  const { guildId } = req.params;
  const { role_id, role_name, level, type, stack } = req.body;

  try {
    console.log('Adding role reward for guild:', guildId);
    console.log('Request body:', req.body);
    
    // Check if role_rewards table exists and has the required columns
    try {
      const tableInfo = db.prepare("PRAGMA table_info(role_rewards)").all();
      console.log('Role rewards table columns:', tableInfo.map(col => col.name));
      
      // Add missing columns if needed
      const columns = tableInfo.map(col => col.name);
      
      if (!columns.includes('role_name')) {
        console.log('Adding role_name column to role_rewards table');
        db.prepare('ALTER TABLE role_rewards ADD COLUMN role_name TEXT').run();
      }
      
      if (!columns.includes('stack')) {
        console.log('Adding stack column to role_rewards table');
        db.prepare('ALTER TABLE role_rewards ADD COLUMN stack INTEGER DEFAULT 0').run();
      }
    } catch (schemaError) {
      console.error('Error checking role_rewards schema:', schemaError);
    }
    
    // Generate a random role ID if not provided
    const roleIdToUse = role_id || `temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    // Generate a default role name if not provided
    const roleNameToUse = role_name || `Level ${level} ${type} Reward`;
    
    console.log(`Using role_id: ${roleIdToUse}, role_name: ${roleNameToUse}`);
    
    // Log the SQL statement we're about to execute
    const insertSQL = `INSERT INTO role_rewards (guild_id, role_id, role_name, level, type, stack) VALUES (?, ?, ?, ?, ?, ?)`;
    console.log('SQL to execute:', insertSQL);
    console.log('Parameters:', [guildId, roleIdToUse, roleNameToUse, level, type, stack === 'true' || stack === true ? 1 : 0]);
    
    // Check if a role reward with the same level and type already exists
    const existingReward = db.prepare(
      'SELECT * FROM role_rewards WHERE guild_id = ? AND level = ? AND type = ?'
    ).get(guildId, level, type);
    
    if (existingReward) {
      console.log('Role reward already exists with this level and type, updating it');
      db.prepare(`
        UPDATE role_rewards 
        SET role_id = ?, role_name = ?, stack = ?
        WHERE guild_id = ? AND level = ? AND type = ?
      `).run(
        roleIdToUse, 
        roleNameToUse, 
        stack === 'true' || stack === true ? 1 : 0,
        guildId,
        level,
        type
      );
    } else {
      console.log('Inserting new role reward');
      db.prepare(`
        INSERT INTO role_rewards (guild_id, role_id, role_name, level, type, stack)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        guildId, 
        roleIdToUse, 
        roleNameToUse, 
        level, 
        type, 
        stack === 'true' || stack === true ? 1 : 0
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding role reward:', error);
    res.status(500).json({ error: 'Failed to add role reward: ' + error.message });
  }
});

// Delete role reward
router.delete('/guild/:guildId/role-rewards/:roleId', isAuthenticated, hasGuildPermission, async (req, res) => {
  const { guildId, roleId } = req.params;

  try {
    db.prepare('DELETE FROM role_rewards WHERE guild_id = ? AND role_id = ?')
      .run(guildId, roleId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting role reward:', error);
    res.status(500).json({ error: 'Failed to delete role reward' });
  }
});

// Add excluded channel
router.post('/guild/:guildId/excluded-channels', isAuthenticated, hasGuildPermission, async (req, res) => {
  const { guildId } = req.params;
  const { channel_id } = req.body;

  try {
    console.log('Adding excluded channel for guild:', guildId);
    console.log('Request body:', req.body);
    
    if (!channel_id) {
      return res.status(400).json({ error: 'Channel ID is required' });
    }
    
    // Check if channel is already excluded
    const existingChannel = db.prepare(
      'SELECT 1 FROM excluded_channels WHERE guild_id = ? AND channel_id = ?'
    ).get(guildId, channel_id);
    
    if (existingChannel) {
      return res.status(400).json({ error: 'Channel is already excluded' });
    }
    
    // Add channel to excluded_channels table
    db.prepare(`
      INSERT INTO excluded_channels (guild_id, channel_id)
      VALUES (?, ?)
    `).run(guildId, channel_id);
    
    // Clear excluded channels cache for this guild
    try {
      clearExcludedChannelsCache(guildId);
      console.log(`Cleared excluded channels cache for guild ${guildId}`);
    } catch (cacheError) {
      console.error('Error clearing excluded channels cache:', cacheError);
      // Continue even if cache clearing fails
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding excluded channel:', error);
    res.status(500).json({ error: 'Failed to add excluded channel: ' + error.message });
  }
});

// Delete excluded channel
router.delete('/guild/:guildId/excluded-channels/:channelId', isAuthenticated, hasGuildPermission, async (req, res) => {
  const { guildId, channelId } = req.params;

  try {
    console.log(`Deleting excluded channel for guild: ${guildId}, channel: ${channelId}`);
    
    db.prepare('DELETE FROM excluded_channels WHERE guild_id = ? AND channel_id = ?').run(guildId, channelId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting excluded channel:', error);
    res.status(500).json({ error: 'Failed to delete excluded channel: ' + error.message });
  }
});

// Add excluded role
router.post('/guild/:guildId/excluded-roles', isAuthenticated, hasGuildPermission, async (req, res) => {
  const { guildId } = req.params;
  const { role_id } = req.body;

  try {
    console.log('Adding excluded role for guild:', guildId);
    console.log('Request body:', req.body);
    
    if (!role_id) {
      return res.status(400).json({ error: 'Role ID is required' });
    }
    
    // Check if role is already excluded
    const existingRole = db.prepare(
      'SELECT 1 FROM excluded_roles WHERE guild_id = ? AND role_id = ?'
    ).get(guildId, role_id);
    
    if (existingRole) {
      return res.status(400).json({ error: 'Role is already excluded' });
    }
    
    // Add role to excluded_roles table
    db.prepare(`
      INSERT INTO excluded_roles (guild_id, role_id)
      VALUES (?, ?)
    `).run(guildId, role_id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding excluded role:', error);
    res.status(500).json({ error: 'Failed to add excluded role: ' + error.message });
  }
});

// Delete excluded role
router.delete('/guild/:guildId/excluded-roles/:roleId', isAuthenticated, hasGuildPermission, async (req, res) => {
  const { guildId, roleId } = req.params;

  try {
    console.log(`Deleting excluded role for guild: ${guildId}, role: ${roleId}`);
    
    db.prepare('DELETE FROM excluded_roles WHERE guild_id = ? AND role_id = ?').run(guildId, roleId);
    
    // Clear excluded roles cache
    try {
      clearExcludedRolesCache(guildId);
    } catch (cacheError) {
      console.error('Error clearing excluded roles cache:', cacheError);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting excluded role:', error);
    res.status(500).json({ error: 'Failed to delete excluded role: ' + error.message });
  }
});

// Reset guild data
router.post('/guild/:guildId/reset', isAuthenticated, hasGuildPermission, async (req, res) => {
  const { guildId } = req.params;
  const { resetType } = req.body;

  try {
    console.log(`Resetting guild data for: ${guildId}, type: ${resetType}`);
    
    if (resetType === 'all') {
      // Begin a transaction
      db.prepare('BEGIN TRANSACTION').run();
      
      try {
        // Save the current guild name before deleting settings
        const guildSettings = db.prepare('SELECT guild_name FROM guild_settings WHERE guild_id = ?').get(guildId);
        const guildName = guildSettings?.guild_name || 'Unknown Server';
        
        // Delete all data except guild settings
        db.prepare('DELETE FROM users WHERE guild_id = ?').run(guildId);
        db.prepare('DELETE FROM role_rewards WHERE guild_id = ?').run(guildId);
        db.prepare('DELETE FROM excluded_channels WHERE guild_id = ?').run(guildId);
        db.prepare('DELETE FROM excluded_roles WHERE guild_id = ?').run(guildId);
        
        // Reset guild settings to defaults
        db.prepare(`
          UPDATE guild_settings 
          SET 
            min_xp_per_message = 15,
            max_xp_per_message = 25,
            min_xp_per_voice_minute = 10,
            max_xp_per_voice_minute = 20,
            min_voice_minutes_to_earn = 1,
            max_voice_minutes_to_earn = 30,
            message_cooldown = 60,
            voice_cooldown = 300,
            xp_multiplier = 1.0,
            enable_announcements = true,
            announcement_message = '{user} reached level {currentlevel} in {type}!',
            announcement_channel = NULL
          WHERE guild_id = ?
        `).run(guildId);
        
        // Commit the transaction
        db.prepare('COMMIT').run();
        
        console.log(`Reset all data for guild ${guildId}`);
      } catch (error) {
        // Roll back on error
        db.prepare('ROLLBACK').run();
        console.error(`Error resetting all data for guild ${guildId}:`, error);
        throw error;
      }
    } else if (resetType === 'levels') {
      // Delete only user data
      db.prepare('DELETE FROM users WHERE guild_id = ?').run(guildId);
      console.log(`Reset user levels for guild ${guildId}`);
    } else {
      return res.status(400).json({ error: 'Invalid reset type' });
    }
    
    // Clear all caches for this guild
    clearGuildCaches(guildId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting guild data:', error);
    res.status(500).json({ error: 'Failed to reset guild data: ' + error.message });
  }
});

module.exports = router;