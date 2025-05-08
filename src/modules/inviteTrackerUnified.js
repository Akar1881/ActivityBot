/**
 * Invite tracking system using the unified database
 */
const { Client, Collection, Events } = require('discord.js');
const logger = require('../utils/logger');
const { db } = require('../database/unifiedDb');
const { createCachedFunction } = require('../utils/performance');

/**
 * Invite tracker class
 */
class InviteTracker {
    /**
     * Create a new invite tracker
     * @param {Client} client - The Discord.js client
     */
    constructor(client) {
        this.client = client;
        this.inviteCache = new Collection();
        this.ready = false;
        
        // Create cached versions of frequently used methods
        this.getGuildSettings = createCachedFunction(this.getGuildSettings.bind(this), 30000); // 30 second cache
        this.getInviteCounts = createCachedFunction(this.getInviteCounts.bind(this), 15000);  // 15 second cache
        
        // Prepare statements for better performance
        this.prepareStatements();
        
        // Initialize the invite tracker
        this.init();
    }
    
    /**
     * Prepare SQL statements for better performance
     */
    prepareStatements() {
        // Guild settings statements
        this.getGuildSettingsStmt = db.prepare(`
            SELECT * FROM guild_invite_settings WHERE guild_id = ?
        `);
        
        this.insertGuildSettingsStmt = db.prepare(`
            INSERT INTO guild_invite_settings (
                guild_id, 
                count_fake_invites, 
                count_left_invites, 
                enable_invite_welcome,
                invite_welcome_channel,
                invite_welcome_message
            )
            VALUES (?, 0, 0, 0, NULL, 'Hi, {user} Welcome to our server! You were invited by {inviter} who now has {invites} invites.')
        `);
        
        // Invite counts statements
        this.getInviteCountsStmt = db.prepare(`
            SELECT regular, fake, left FROM invite_counts
            WHERE guild_id = ? AND user_id = ?
        `);
        
        // Invite statements
        this.getInviteStmt = db.prepare(`
            SELECT * FROM invites
            WHERE guild_id = ? AND user_id = ?
        `);
        
        this.updateInviteStmt = db.prepare(`
            UPDATE invites
            SET inviter_id = ?, is_fake = ?, is_left = 0
            WHERE guild_id = ? AND user_id = ?
        `);
        
        this.insertInviteStmt = db.prepare(`
            INSERT INTO invites (guild_id, user_id, inviter_id, is_fake, is_left)
            VALUES (?, ?, ?, ?, 0)
        `);
        
        this.markInviteLeftStmt = db.prepare(`
            UPDATE invites
            SET is_left = 1
            WHERE guild_id = ? AND user_id = ?
        `);
        
        // Invite counts update statements
        this.countInvitesStmt = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_fake = 0 AND is_left = 0 THEN 1 ELSE 0 END) as regular,
                SUM(CASE WHEN is_fake = 1 THEN 1 ELSE 0 END) as fake,
                SUM(CASE WHEN is_left = 1 THEN 1 ELSE 0 END) as left
            FROM invites
            WHERE guild_id = ? AND inviter_id = ?
        `);
        
        this.updateInviteCountsStmt = db.prepare(`
            INSERT OR REPLACE INTO invite_counts (guild_id, user_id, regular, fake, left)
            VALUES (?, ?, ?, ?, ?)
        `);
    }
    
    /**
     * Initialize the invite tracker
     */
    async init() {
        try {
            logger.info('Initializing invite tracker...');
            
            // Wait for the client to be ready
            if (!this.client.isReady()) {
                logger.info('Client not ready, waiting for ready event');
                this.client.once(Events.ClientReady, () => this.init());
                return;
            }
            
            // Cache all guild invites
            await this.cacheAllGuildInvites();
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.ready = true;
            logger.info('Invite tracker initialized successfully');
        } catch (error) {
            logger.error('Error initializing invite tracker:', error);
            this.ready = false;
        }
    }
    
    /**
     * Cache all guild invites
     */
    async cacheAllGuildInvites() {
        try {
            logger.info('Caching all guild invites...');
            
            // Get all guilds
            const guilds = this.client.guilds.cache;
            
            // Cache invites for each guild
            for (const [guildId, guild] of guilds) {
                try {
                    // Check if the bot has permission to view invites
                    const botMember = await guild.members.fetchMe();
                    if (!botMember.permissions.has('ManageGuild')) {
                        logger.warn(`Missing 'Manage Guild' permission in guild ${guild.name} (${guildId}), skipping invite caching`);
                        continue;
                    }
                    
                    // Fetch and cache invites
                    const invites = await guild.invites.fetch();
                    
                    // Store in cache
                    this.inviteCache.set(guildId, new Collection());
                    
                    // Cache each invite
                    invites.forEach(invite => {
                        this.inviteCache.get(guildId).set(invite.code, {
                            code: invite.code,
                            uses: invite.uses,
                            inviter: invite.inviter ? invite.inviter.id : null
                        });
                    });
                    
                    logger.info(`Cached ${invites.size} invites for guild ${guild.name} (${guildId})`);
                } catch (error) {
                    logger.error(`Error caching invites for guild ${guild.name} (${guildId}):`, error);
                }
            }
            
            logger.info('Finished caching all guild invites');
        } catch (error) {
            logger.error('Error caching all guild invites:', error);
        }
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Listen for new invites
        this.client.on(Events.InviteCreate, invite => this.handleInviteCreate(invite));
        
        // Listen for deleted invites
        this.client.on(Events.InviteDelete, invite => this.handleInviteDelete(invite));
        
        // Listen for guild member add
        this.client.on(Events.GuildMemberAdd, member => this.handleGuildMemberAdd(member));
        
        // Listen for guild member remove
        this.client.on(Events.GuildMemberRemove, member => this.handleGuildMemberRemove(member));
        
        // Listen for guild create (bot joins a new guild)
        this.client.on(Events.GuildCreate, guild => this.handleGuildCreate(guild));
        
        logger.info('Invite tracker event listeners set up');
    }
    
    /**
     * Handle invite create event
     * @param {Invite} invite - The created invite
     */
    handleInviteCreate(invite) {
        try {
            const { guild, code } = invite;
            
            // Initialize guild cache if it doesn't exist
            if (!this.inviteCache.has(guild.id)) {
                this.inviteCache.set(guild.id, new Collection());
            }
            
            // Cache the new invite
            this.inviteCache.get(guild.id).set(code, {
                code,
                uses: invite.uses,
                inviter: invite.inviter ? invite.inviter.id : null
            });
            
            logger.info(`Cached new invite ${code} for guild ${guild.name} (${guild.id})`);
        } catch (error) {
            logger.error('Error handling invite create:', error);
        }
    }
    
    /**
     * Handle invite delete event
     * @param {Invite} invite - The deleted invite
     */
    handleInviteDelete(invite) {
        try {
            const { guild, code } = invite;
            
            // Remove from cache if it exists
            if (this.inviteCache.has(guild.id)) {
                this.inviteCache.get(guild.id).delete(code);
                logger.info(`Removed invite ${code} from cache for guild ${guild.name} (${guild.id})`);
            }
        } catch (error) {
            logger.error('Error handling invite delete:', error);
        }
    }
    
    /**
     * Handle guild create event (bot joins a new guild)
     * @param {Guild} guild - The guild that was created
     */
    async handleGuildCreate(guild) {
        try {
            logger.info(`Bot joined guild ${guild.name} (${guild.id}), caching invites`);
            
            // Check if the bot has permission to view invites
            const botMember = await guild.members.fetchMe();
            if (!botMember.permissions.has('ManageGuild')) {
                logger.warn(`Missing 'Manage Guild' permission in guild ${guild.name} (${guild.id}), skipping invite caching`);
                return;
            }
            
            // Fetch and cache invites
            const invites = await guild.invites.fetch();
            
            // Store in cache
            this.inviteCache.set(guild.id, new Collection());
            
            // Cache each invite
            invites.forEach(invite => {
                this.inviteCache.get(guild.id).set(invite.code, {
                    code: invite.code,
                    uses: invite.uses,
                    inviter: invite.inviter ? invite.inviter.id : null
                });
            });
            
            logger.info(`Cached ${invites.size} invites for guild ${guild.name} (${guild.id})`);
        } catch (error) {
            logger.error(`Error handling guild create for guild ${guild.name} (${guild.id}):`, error);
        }
    }
    
    /**
     * Handle guild member add event
     * @param {GuildMember} member - The member that joined
     */
    async handleGuildMemberAdd(member) {
        try {
            const { guild, user } = member;
            
            // Skip bots
            if (user.bot) {
                logger.info(`Bot ${user.tag} (${user.id}) joined guild ${guild.name} (${guild.id}), skipping invite tracking`);
                return;
            }
            
            logger.info(`User ${user.tag} (${user.id}) joined guild ${guild.name} (${guild.id}), tracking invite`);
            
            // Check if the bot has permission to view invites
            const botMember = await guild.members.fetchMe();
            if (!botMember.permissions.has('ManageGuild')) {
                logger.warn(`Missing 'Manage Guild' permission in guild ${guild.name} (${guild.id}), cannot track invites`);
                return;
            }
            
            // Get the old invite cache
            const oldInvites = this.inviteCache.get(guild.id) || new Collection();
            
            // Fetch new invites
            const newInvites = await guild.invites.fetch();
            
            // Find the used invite
            let usedInvite = null;
            
            newInvites.forEach(invite => {
                // Get the old invite
                const oldInvite = oldInvites.get(invite.code);
                
                // If the invite is new or has more uses, it was used
                if (!oldInvite || invite.uses > oldInvite.uses) {
                    usedInvite = invite;
                }
            });
            
            // Update the cache
            this.inviteCache.set(guild.id, new Collection());
            newInvites.forEach(invite => {
                this.inviteCache.get(guild.id).set(invite.code, {
                    code: invite.code,
                    uses: invite.uses,
                    inviter: invite.inviter ? invite.inviter.id : null
                });
            });
            
            // If no invite was found, check for vanity URL
            if (!usedInvite && guild.vanityURLCode) {
                try {
                    const vanityData = await guild.fetchVanityData();
                    if (vanityData.uses > 0) {
                        logger.info(`User ${user.tag} (${user.id}) joined using vanity URL ${guild.vanityURLCode}`);
                        // Handle vanity URL invite
                        return;
                    }
                } catch (error) {
                    logger.error(`Error fetching vanity data for guild ${guild.name} (${guild.id}):`, error);
                }
            }
            
            // If no invite was found, the user might have joined through other means
            if (!usedInvite) {
                logger.info(`Could not determine how user ${user.tag} (${user.id}) joined guild ${guild.name} (${guild.id})`);
                return;
            }
            
            // Get the inviter
            const inviter = usedInvite.inviter;
            
            if (!inviter) {
                logger.info(`User ${user.tag} (${user.id}) joined guild ${guild.name} (${guild.id}) using an invite with no inviter`);
                return;
            }
            
            logger.info(`User ${user.tag} (${user.id}) joined guild ${guild.name} (${guild.id}) using invite code ${usedInvite.code} created by ${inviter.tag} (${inviter.id})`);
            
            // Check if the user is a fake (account created less than a day ago)
            const isFake = Date.now() - user.createdTimestamp < 24 * 60 * 60 * 1000;
            
            // Store the invite in the database
            this.storeInvite(guild.id, user.id, inviter.id, isFake);
            
            // Get guild settings
            const settings = await this.getGuildSettings(guild.id);
            
            // Send welcome message if enabled
            if (settings.enable_invite_welcome && settings.invite_welcome_channel) {
                this.sendWelcomeMessage(member, inviter, settings);
            }
        } catch (error) {
            logger.error(`Error handling guild member add for user ${member.user.tag} (${member.user.id}) in guild ${member.guild.name} (${member.guild.id}):`, error);
        }
    }
    
    /**
     * Handle guild member remove event
     * @param {GuildMember} member - The member that left
     */
    async handleGuildMemberRemove(member) {
        try {
            const { guild, user } = member;
            
            // Skip bots
            if (user.bot) {
                logger.info(`Bot ${user.tag} (${user.id}) left guild ${guild.name} (${guild.id}), skipping invite tracking`);
                return;
            }
            
            logger.info(`User ${user.tag} (${user.id}) left guild ${guild.name} (${guild.id}), updating invite tracking`);
            
            // Check if the user was invited by someone
            const invite = this.getInviteStmt.get(guild.id, user.id);
            
            if (!invite) {
                logger.info(`No invite record found for user ${user.tag} (${user.id}) in guild ${guild.name} (${guild.id})`);
                return;
            }
            
            // Mark the invite as left
            this.markInviteLeftStmt.run(guild.id, user.id);
            
            logger.info(`Marked invite for user ${user.tag} (${user.id}) as left in guild ${guild.name} (${guild.id})`);
            
            // Update the inviter's counts
            this.updateInviterCounts(guild.id, invite.inviter_id);
        } catch (error) {
            logger.error(`Error handling guild member remove for user ${member.user.tag} (${member.user.id}) in guild ${member.guild.name} (${member.guild.id}):`, error);
        }
    }
    
    /**
     * Store an invite in the database
     * @param {string} guildId - The guild ID
     * @param {string} userId - The user ID
     * @param {string} inviterId - The inviter ID
     * @param {boolean} isFake - Whether the user is a fake
     */
    storeInvite(guildId, userId, inviterId, isFake = false) {
        try {
            // Check if the user already has an invite record
            const existingInvite = this.getInviteStmt.get(guildId, userId);
            
            if (existingInvite) {
                // Update the existing invite
                this.updateInviteStmt.run(inviterId, isFake ? 1 : 0, guildId, userId);
                logger.info(`Updated invite record for user ${userId} in guild ${guildId}`);
            } else {
                // Insert a new invite
                this.insertInviteStmt.run(guildId, userId, inviterId, isFake ? 1 : 0);
                logger.info(`Created new invite record for user ${userId} in guild ${guildId}`);
            }
            
            // Update the inviter's counts
            this.updateInviterCounts(guildId, inviterId);
        } catch (error) {
            logger.error(`Error storing invite for user ${userId} in guild ${guildId}:`, error);
        }
    }
    
    /**
     * Update an inviter's invite counts
     * @param {string} guildId - The guild ID
     * @param {string} inviterId - The inviter ID
     */
    updateInviterCounts(guildId, inviterId) {
        try {
            // Count the inviter's invites using prepared statement
            const counts = this.countInvitesStmt.get(guildId, inviterId);
            
            // Update or insert the counts using prepared statement
            this.updateInviteCountsStmt.run(
                guildId,
                inviterId,
                counts.regular || 0,
                counts.fake || 0,
                counts.left || 0
            );
            
            // Clear the cache for this user's invite counts
            // This is important to ensure the updated counts are reflected immediately
            const cacheKey = JSON.stringify([guildId, inviterId]);
            if (this._getInviteCountsCache) {
                this._getInviteCountsCache.delete(cacheKey);
            }
            
            logger.info(`Updated invite counts for user ${inviterId} in guild ${guildId}: regular=${counts.regular}, fake=${counts.fake}, left=${counts.left}`);
        } catch (error) {
            logger.error(`Error updating invite counts for user ${inviterId} in guild ${guildId}:`, error);
        }
    }
    
    /**
     * Get invite counts for a user
     * @param {string} guildId - The guild ID
     * @param {string} userId - The user ID
     * @returns {Object} The invite counts
     */
    async getInviteCounts(guildId, userId) {
        try {
            // Get the invite counts from the database using prepared statement
            const result = this.getInviteCountsStmt.get(guildId, userId);

            if (!result) {
                return { regular: 0, fake: 0, left: 0, total: 0 };
            }

            const { regular, fake, left } = result;
            
            // Get guild settings to determine which invites to count
            const settings = await this.getGuildSettings(guildId);
            
            // Calculate total based on settings
            let total = regular;
            if (settings.count_fake_invites) {
                total += fake;
            }
            if (settings.count_left_invites) {
                total += left;
            }

            return { regular, fake, left, total };
        } catch (error) {
            logger.error(`Error getting invite counts for user ${userId} in guild ${guildId}:`, error);
            return { regular: 0, fake: 0, left: 0, total: 0 };
        }
    }
    
    /**
     * Get guild invite settings
     * @param {string} guildId - The guild ID
     * @returns {Object} The guild settings
     */
    async getGuildSettings(guildId) {
        try {
            // Check if settings exist using prepared statement
            const result = this.getGuildSettingsStmt.get(guildId);
            
            // If settings don't exist, create default settings
            if (!result) {
                // Define default settings
                const defaultSettings = {
                    count_fake_invites: false,
                    count_left_invites: false,
                    enable_invite_welcome: false,
                    invite_welcome_channel: null,
                    invite_welcome_message: 'Hi, {user} Welcome to our server! You were invited by {inviter} who now has {invites} invites.'
                };
                
                // Insert default settings in the background without awaiting
                setTimeout(() => {
                    try {
                        this.insertGuildSettingsStmt.run(guildId);
                    } catch (insertError) {
                        logger.error(`Error inserting default guild settings for guild ${guildId}:`, insertError);
                    }
                }, 0);
                
                return defaultSettings;
            }

            // Convert SQLite integers to booleans
            return {
                ...result,
                count_fake_invites: result.count_fake_invites === 1,
                count_left_invites: result.count_left_invites === 1,
                enable_invite_welcome: result.enable_invite_welcome === 1
            };
        } catch (error) {
            logger.error(`Error getting guild settings for guild ${guildId}:`, error);
            return {
                count_fake_invites: false,
                count_left_invites: false,
                enable_invite_welcome: false,
                invite_welcome_channel: null,
                invite_welcome_message: 'Hi, {user} Welcome to our server! You were invited by {inviter} who now has {invites} invites.'
            };
        }
    }
    
    /**
     * Send welcome message when a user joins
     * @param {GuildMember} member - The member who joined
     * @param {User} inviter - The user who invited them
     * @param {Object} settings - The guild settings
     */
    async sendWelcomeMessage(member, inviter, settings) {
        try {
            logger.info(`Attempting to send welcome message for member ${member.user.tag} (${member.id}) in guild ${member.guild.name} (${member.guild.id})`);
            
            if (!settings.invite_welcome_channel) {
                logger.warn(`No welcome channel set for guild ${member.guild.id}`);
                return;
            }
            
            // Get the welcome channel
            const channel = await member.guild.channels.fetch(settings.invite_welcome_channel)
                .catch(() => null);
            
            if (!channel) {
                logger.warn(`Welcome channel ${settings.invite_welcome_channel} not found in guild ${member.guild.id}`);
                return;
            }
            
            // Get the inviter's invite counts
            const inviteCounts = await this.getInviteCounts(member.guild.id, inviter.id);
            
            // Format the welcome message
            let message = settings.invite_welcome_message;
            
            // Replace placeholders
            message = message.replace(/{user}/g, member.toString());
            message = message.replace(/{username}/g, member.user.username);
            message = message.replace(/{tag}/g, member.user.tag);
            message = message.replace(/{inviter}/g, inviter.toString());
            message = message.replace(/{inviter.username}/g, inviter.username);
            message = message.replace(/{inviter.tag}/g, inviter.tag);
            message = message.replace(/{invites}/g, inviteCounts.total);
            message = message.replace(/{guild}/g, member.guild.name);
            
            // Send the message
            await channel.send(message);
            logger.info(`Sent welcome message for member ${member.user.tag} (${member.id}) in guild ${member.guild.name} (${member.guild.id})`);
        } catch (error) {
            logger.error(`Error sending welcome message for member ${member.user.tag} (${member.id}) in guild ${member.guild.name} (${member.guild.id}):`, error);
        }
    }
    
    /**
     * Update guild invite settings
     * @param {string} guildId - The guild ID
     * @param {Object} settings - The new settings
     * @returns {boolean} Whether the update was successful
     */
    async updateGuildSettings(guildId, settings) {
        try {
            logger.info(`Updating guild settings for guild ${guildId}: ${JSON.stringify(settings)}`);
            
            // Convert boolean values to integers
            const countFakeInvites = settings.count_fake_invites ? 1 : 0;
            const countLeftInvites = settings.count_left_invites ? 1 : 0;
            const enableInviteWelcome = settings.enable_invite_welcome ? 1 : 0;
            
            // Update the settings
            db.prepare(`
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
                settings.invite_welcome_channel,
                settings.invite_welcome_message
            );
            
            logger.info(`Updated guild settings for guild ${guildId}`);
            return true;
        } catch (error) {
            logger.error(`Error updating guild settings for guild ${guildId}:`, error);
            return false;
        }
    }
    
    /**
     * Reset invites for a user or guild
     * @param {string} guildId - The guild ID
     * @param {string} userId - The user ID (null to reset all)
     * @param {string} type - The type of invites to reset (all, regular, fake, left)
     * @returns {boolean} Whether the reset was successful
     */
    async resetInvites(guildId, userId, type = 'all') {
        try {
            logger.info(`Resetting ${type} invites for ${userId ? `user ${userId}` : 'all users'} in guild ${guildId}`);
            
            if (userId) {
                // Reset invites for a specific user
                if (type === 'all') {
                    // Delete all invites for this user
                    db.prepare(`
                        DELETE FROM invites
                        WHERE guild_id = ? AND inviter_id = ?
                    `).run(guildId, userId);
                    
                    // Reset invite counts
                    db.prepare(`
                        DELETE FROM invite_counts
                        WHERE guild_id = ? AND user_id = ?
                    `).run(guildId, userId);
                } else if (type === 'regular') {
                    // Mark all regular invites as fake
                    db.prepare(`
                        UPDATE invites
                        SET is_fake = 1
                        WHERE guild_id = ? AND inviter_id = ? AND is_fake = 0 AND is_left = 0
                    `).run(guildId, userId);
                } else if (type === 'fake') {
                    // Delete all fake invites
                    db.prepare(`
                        DELETE FROM invites
                        WHERE guild_id = ? AND inviter_id = ? AND is_fake = 1
                    `).run(guildId, userId);
                } else if (type === 'left') {
                    // Delete all left invites
                    db.prepare(`
                        DELETE FROM invites
                        WHERE guild_id = ? AND inviter_id = ? AND is_left = 1
                    `).run(guildId, userId);
                }
                
                // Update the user's invite counts
                this.updateInviterCounts(guildId, userId);
            } else {
                // Reset invites for the entire guild
                if (type === 'all') {
                    // Delete all invites
                    db.prepare(`
                        DELETE FROM invites
                        WHERE guild_id = ?
                    `).run(guildId);
                    
                    // Reset all invite counts
                    db.prepare(`
                        DELETE FROM invite_counts
                        WHERE guild_id = ?
                    `).run(guildId);
                } else if (type === 'regular') {
                    // Mark all regular invites as fake
                    db.prepare(`
                        UPDATE invites
                        SET is_fake = 1
                        WHERE guild_id = ? AND is_fake = 0 AND is_left = 0
                    `).run(guildId);
                    
                    // Update all invite counts
                    const users = db.prepare(`
                        SELECT DISTINCT inviter_id FROM invites
                        WHERE guild_id = ?
                    `).all(guildId);
                    
                    for (const user of users) {
                        this.updateInviterCounts(guildId, user.inviter_id);
                    }
                } else if (type === 'fake') {
                    // Delete all fake invites
                    db.prepare(`
                        DELETE FROM invites
                        WHERE guild_id = ? AND is_fake = 1
                    `).run(guildId);
                    
                    // Update all invite counts
                    const users = db.prepare(`
                        SELECT DISTINCT inviter_id FROM invites
                        WHERE guild_id = ?
                    `).all(guildId);
                    
                    for (const user of users) {
                        this.updateInviterCounts(guildId, user.inviter_id);
                    }
                } else if (type === 'left') {
                    // Delete all left invites
                    db.prepare(`
                        DELETE FROM invites
                        WHERE guild_id = ? AND is_left = 1
                    `).run(guildId);
                    
                    // Update all invite counts
                    const users = db.prepare(`
                        SELECT DISTINCT inviter_id FROM invites
                        WHERE guild_id = ?
                    `).all(guildId);
                    
                    for (const user of users) {
                        this.updateInviterCounts(guildId, user.inviter_id);
                    }
                }
            }
            
            logger.info(`Reset ${type} invites for ${userId ? `user ${userId}` : 'all users'} in guild ${guildId}`);
            return true;
        } catch (error) {
            logger.error(`Error resetting invites for ${userId ? `user ${userId}` : 'all users'} in guild ${guildId}:`, error);
            return false;
        }
    }
    
    /**
     * Get the leaderboard for a guild
     * @param {string} guildId - The guild ID
     * @param {number} limit - The number of users to return
     * @returns {Array} The leaderboard
     */
    async getLeaderboard(guildId, limit = 10) {
        try {
            logger.info(`Getting invite leaderboard for guild ${guildId} with limit ${limit}`);
            
            // Get guild settings
            const settings = await this.getGuildSettings(guildId);
            
            // Build the SQL query based on settings
            let query = `
                SELECT 
                    user_id,
                    regular,
                    fake,
                    left,
                    regular`;
            
            if (settings.count_fake_invites) {
                query += ` + fake`;
            }
            
            if (settings.count_left_invites) {
                query += ` + left`;
            }
            
            query += ` as total
                FROM invite_counts
                WHERE guild_id = ?
                ORDER BY total DESC
                LIMIT ?`;
            
            // Get the leaderboard
            const leaderboard = db.prepare(query).all(guildId, limit);
            
            logger.info(`Got invite leaderboard for guild ${guildId}: ${leaderboard.length} users`);
            return leaderboard;
        } catch (error) {
            logger.error(`Error getting invite leaderboard for guild ${guildId}:`, error);
            return [];
        }
    }
}

module.exports = InviteTracker;