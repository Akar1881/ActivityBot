/**
 * Compatibility module for inviteTracker
 * 
 * This file provides backward compatibility for code that imports the old InviteTracker class
 * It re-exports the new InviteTracker class from inviteTrackerUnified.js
 */

// Import the new unified InviteTracker class
const UnifiedInviteTracker = require('./inviteTrackerUnified');
const logger = require('../utils/logger');
const { Collection } = require('discord.js');

// Log that we're using the compatibility layer
logger.info('Using inviteTracker compatibility layer - redirecting to inviteTrackerUnified');

/**
 * Invite Tracker module for tracking invites in guilds
 * This is a compatibility wrapper around the new InviteTracker class
 */
class InviteTracker {
    /**
     * @param {Client} client - Discord.js client
     */
    constructor(client) {
        logger.info('Creating InviteTracker instance via compatibility layer');
        
        // Create an instance of the new tracker
        this.unified = new UnifiedInviteTracker(client);
        
        // Store client reference
        this.client = client;
    }
    
    /**
     * Get guild settings
     * @param {string} guildId - Guild ID
     * @returns {Object} Guild settings
     */
    async getGuildSettings(guildId) {
        return this.unified.getGuildSettings(guildId);
    }
    
    /**
     * Get invite counts for a user
     * @param {string} guildId - Guild ID
     * @param {string} userId - User ID
     * @returns {Object} Invite counts
     */
    async getInviteCounts(guildId, userId) {
        return this.unified.getInviteCounts(guildId, userId);
    }
    
    /**
     * Update guild settings
     * @param {string} guildId - Guild ID
     * @param {Object} settings - New settings
     * @returns {Object} Updated settings
     */
    async updateGuildSettings(guildId, settings) {
        return this.unified.updateGuildSettings(guildId, settings);
    }
    
    /**
     * Reset invites for a user
     * @param {string} guildId - Guild ID
     * @param {string} userId - User ID
     * @returns {boolean} Success
     */
    async resetInvites(guildId, userId) {
        return this.unified.resetInvites(guildId, userId);
    }
    
    /**
     * Add bonus invites to a user
     * @param {string} guildId - Guild ID
     * @param {string} userId - User ID
     * @param {number} amount - Amount to add
     * @returns {Object} Updated invite counts
     */
    async addBonusInvites(guildId, userId, amount) {
        return this.unified.addBonusInvites(guildId, userId, amount);
    }

}

// Export the compatibility class
module.exports = InviteTracker;
        try {
            logger.info(`Starting to cache invites for ${this.client.guilds.cache.size} guilds`);
            
            let successCount = 0;
            let errorCount = 0;
            
            for (const guild of this.client.guilds.cache.values()) {
                try {
                    await this.cacheGuildInvites(guild);
                    successCount++;
                } catch (error) {
                    errorCount++;
                    logger.error(`Failed to cache invites for guild ${guild.id}:`, error);
                }
            }
            
            logger.info(`Cached invites for ${successCount} guilds successfully (${errorCount} failed)`);
        } catch (error) {
            logger.error('Error in cacheAllGuildInvites:', error);
        }
    }

    /**
     * Cache invites for a specific guild
     * @param {Guild} guild - The guild to cache invites for
     */
    async cacheGuildInvites(guild) {
        try {
            if (!guild.available) {
                logger.warn(`Guild ${guild.id} is not available, skipping invite caching`);
                return;
            }
            
            // Check if bot has permission to view invites
            if (!guild.members.me.permissions.has('ManageGuild')) {
                logger.warn(`Bot doesn't have ManageGuild permission in guild ${guild.id}, skipping invite caching`);
                return;
            }
            
            logger.info(`Fetching invites for guild ${guild.name} (${guild.id})`);
            
            const invites = await guild.invites.fetch().catch(error => {
                logger.error(`Error fetching invites for guild ${guild.id}:`, error);
                return null;
            });
            
            if (!invites) {
                logger.warn(`Could not fetch invites for guild ${guild.id}`);
                return;
            }
            
            logger.info(`Fetched ${invites.size} invites for guild ${guild.id}`);
            
            // Create a new collection with the invite data
            const inviteCollection = new Collection(
                invites.map(invite => [invite.code, {
                    code: invite.code,
                    uses: invite.uses,
                    inviter: invite.inviter ? invite.inviter.id : null,
                    createdAt: invite.createdTimestamp
                }])
            );
            
            // Store in cache
            this.inviteCache.set(guild.id, inviteCollection);
            
            logger.info(`Successfully cached ${inviteCollection.size} invites for guild ${guild.id}`);
            
            // Return the cached invites for convenience
            return inviteCollection;
        } catch (error) {
            logger.error(`Error caching invites for guild ${guild.id}:`, error);
            throw error; // Re-throw to allow proper handling by caller
        }
    }

    /**
     * Track when a member joins and determine which invite was used
     * @param {GuildMember} member - The member who joined
     */
    async trackJoin(member) {
        try {
            const { guild } = member;
            
            logger.info(`Member ${member.user.tag} (${member.id}) joined guild ${guild.name} (${guild.id})`);
            
            // Skip if guild is unavailable or bot doesn't have permission
            if (!guild.available) {
                logger.warn(`Guild ${guild.id} is unavailable, skipping invite tracking`);
                return;
            }
            
            if (!guild.members.me.permissions.has('ManageGuild')) {
                logger.warn(`Bot doesn't have ManageGuild permission in guild ${guild.id}, skipping invite tracking`);
                return;
            }

            // Get cached invites before the user joined
            let cachedInvites = this.inviteCache.get(guild.id);
            
            // If we don't have cached invites, try to cache them now
            if (!cachedInvites || cachedInvites.size === 0) {
                logger.warn(`No cached invites for guild ${guild.id}, attempting to cache now...`);
                try {
                    // Try to cache invites now
                    cachedInvites = await this.cacheGuildInvites(guild);
                    
                    if (!cachedInvites || cachedInvites.size === 0) {
                        logger.warn(`Still no cached invites for guild ${guild.id} after caching attempt`);
                        
                        // Since we don't have previous invites to compare, we'll have to use a fallback method
                        logger.info(`Using fallback method to track invites for guild ${guild.id}`);
                        await this.trackJoinFallback(member);
                        return;
                    }
                    
                    logger.info(`Successfully cached ${cachedInvites.size} invites for guild ${guild.id}`);
                } catch (cacheError) {
                    logger.error(`Error caching invites for guild ${guild.id}:`, cacheError);
                    
                    // Use fallback method
                    logger.info(`Using fallback method to track invites for guild ${guild.id}`);
                    await this.trackJoinFallback(member);
                    return;
                }
            }

            logger.info(`Found ${cachedInvites.size} cached invites for guild ${guild.id}`);

            // Fetch new invites
            const newInvites = await guild.invites.fetch().catch(error => {
                logger.error(`Error fetching new invites for guild ${guild.id}:`, error);
                return null;
            });
            
            if (!newInvites) {
                logger.warn(`Could not fetch new invites for guild ${guild.id}, using fallback method`);
                await this.trackJoinFallback(member);
                return;
            }
            
            logger.info(`Fetched ${newInvites.size} new invites for guild ${guild.id}`);
            
            // Find the used invite by comparing uses
            let usedInvite = null;
            let usedInviteCode = null;
            
            for (const [code, invite] of newInvites) {
                const cachedInvite = cachedInvites.get(code);
                if (cachedInvite && invite.uses > cachedInvite.uses) {
                    usedInvite = invite;
                    usedInviteCode = code;
                    logger.info(`Found used invite: ${code} by ${invite.inviter ? invite.inviter.tag : 'Unknown'}`);
                    break;
                }
            }

            // Update the cache with new invites
            this.inviteCache.set(guild.id, new Collection(
                newInvites.map(invite => [invite.code, {
                    code: invite.code,
                    uses: invite.uses,
                    inviter: invite.inviter ? invite.inviter.id : null,
                    createdAt: invite.createdTimestamp
                }])
            ));

            // If we couldn't find the used invite, use fallback method
            if (!usedInvite) {
                logger.warn(`Could not determine which invite was used for member ${member.id} in guild ${guild.id}, using fallback method`);
                await this.trackJoinFallback(member);
                return;
            }
            
            if (!usedInvite.inviter) {
                logger.warn(`Invite ${usedInviteCode} has no inviter, using fallback method`);
                await this.trackJoinFallback(member);
                return;
            }

            // Check if the account is less than 30 days old (fake invite)
            const accountAge = Date.now() - member.user.createdTimestamp;
            const isFake = accountAge < (30 * 24 * 60 * 60 * 1000);
            logger.info(`Member ${member.id} account age: ${Math.floor(accountAge / (24 * 60 * 60 * 1000))} days, isFake: ${isFake}`);
            
            // Get guild settings
            logger.info(`Getting guild settings for guild ${guild.id}`);
            const settings = await this.getGuildSettings(guild.id);
            logger.info(`Guild settings: ${JSON.stringify(settings)}`);
            
            // Store the invite in the database
            logger.info(`Storing invite for member ${member.id} invited by ${usedInvite.inviter.id} in guild ${guild.id}`);
            await this.storeInvite(guild.id, member.id, usedInvite.inviter.id, isFake);
            
            // Send welcome message if enabled
            if (settings.enable_invite_welcome) {
                if (settings.invite_welcome_channel) {
                    logger.info(`Sending welcome message to channel ${settings.invite_welcome_channel}`);
                    await this.sendWelcomeMessage(member, usedInvite.inviter, settings);
                } else {
                    logger.warn(`Welcome messages are enabled but no channel is set for guild ${guild.id}`);
                }
            } else {
                logger.info(`Welcome messages are disabled for guild ${guild.id}`);
            }
        } catch (error) {
            logger.error(`Error tracking join for member ${member.id} in guild ${member.guild.id}:`, error);
        }
    }
    
    /**
     * Fallback method for tracking joins when we can't determine the invite used
     * This method uses the most recent invite with the most uses
     * @param {GuildMember} member - The member who joined
     */
    async trackJoinFallback(member) {
        try {
            const { guild } = member;
            
            logger.info(`Using fallback method to track join for member ${member.id} in guild ${guild.id}`);
            
            // Fetch all invites
            const invites = await guild.invites.fetch().catch(error => {
                logger.error(`Error fetching invites in fallback method:`, error);
                return null;
            });
            
            if (!invites || invites.size === 0) {
                logger.warn(`No invites found in fallback method for guild ${guild.id}`);
                return;
            }
            
            // Find the invite with the most uses as a best guess
            let bestInvite = null;
            let maxUses = -1;
            
            for (const invite of invites.values()) {
                if (invite.uses > maxUses && invite.inviter) {
                    bestInvite = invite;
                    maxUses = invite.uses;
                }
            }
            
            if (!bestInvite || !bestInvite.inviter) {
                logger.warn(`Could not find a suitable invite in fallback method for guild ${guild.id}`);
                return;
            }
            
            logger.info(`Fallback method selected invite ${bestInvite.code} by ${bestInvite.inviter.tag} with ${bestInvite.uses} uses`);
            
            // Check if the account is less than 30 days old (fake invite)
            const accountAge = Date.now() - member.user.createdTimestamp;
            const isFake = accountAge < (30 * 24 * 60 * 60 * 1000);
            
            // Get guild settings
            const settings = await this.getGuildSettings(guild.id);
            
            // Store the invite in the database
            await this.storeInvite(guild.id, member.id, bestInvite.inviter.id, isFake);
            
            // Send welcome message if enabled
            if (settings.enable_invite_welcome && settings.invite_welcome_channel) {
                await this.sendWelcomeMessage(member, bestInvite.inviter, settings);
            }
            
            // Update the cache with current invites
            this.inviteCache.set(guild.id, new Collection(
                invites.map(invite => [invite.code, {
                    code: invite.code,
                    uses: invite.uses,
                    inviter: invite.inviter ? invite.inviter.id : null,
                    createdAt: invite.createdTimestamp
                }])
            ));
            
            logger.info(`Fallback tracking completed for member ${member.id} in guild ${guild.id}`);
        } catch (error) {
            logger.error(`Error in trackJoinFallback for member ${member.id} in guild ${member.guild.id}:`, error);
        }
    }

    /**
     * Track when a member leaves
     * @param {GuildMember} member - The member who left
     */
    async trackLeave(member) {
        try {
            // Mark the invite as left in the database
            inviteDb.prepare(`
                UPDATE invites
                SET is_left = 1
                WHERE guild_id = ? AND user_id = ?
            `).run(member.guild.id, member.id);

            // Update the invite counts
            await this.updateInviteCounts(member.guild.id, null);
        } catch (error) {
            logger.error(`Error tracking leave for member ${member.id} in guild ${member.guild.id}:`, error);
        }
    }

    /**
     * Store an invite in the database
     * @param {string} guildId - The guild ID
     * @param {string} userId - The user ID who joined
     * @param {string} inviterId - The inviter ID
     * @param {boolean} isFake - Whether the invite is considered fake
     */
    async storeInvite(guildId, userId, inviterId, isFake = false) {
        try {
            // Check if the invite record exists
            const existingInvite = inviteDb.prepare(`
                SELECT * FROM invites WHERE guild_id = ? AND user_id = ?
            `).get(guildId, userId);
            
            if (existingInvite) {
                // Update existing record
                inviteDb.prepare(`
                    UPDATE invites 
                    SET inviter_id = ?, is_fake = ?, is_left = 0
                    WHERE guild_id = ? AND user_id = ?
                `).run(inviterId, isFake ? 1 : 0, guildId, userId);
            } else {
                // Insert new record
                inviteDb.prepare(`
                    INSERT INTO invites (guild_id, user_id, inviter_id, is_fake, is_left)
                    VALUES (?, ?, ?, ?, 0)
                `).run(guildId, userId, inviterId, isFake ? 1 : 0);
            }

            // Update the invite counts
            await this.updateInviteCounts(guildId, inviterId);
        } catch (error) {
            logger.error(`Error storing invite in guild ${guildId}:`, error);
        }
    }

    /**
     * Update invite counts for a user
     * @param {string} guildId - The guild ID
     * @param {string} inviterId - The inviter ID (if null, update all users in the guild)
     */
    async updateInviteCounts(guildId, inviterId) {
        try {
            if (inviterId) {
                // Update counts for a specific inviter
                await this.updateUserInviteCounts(guildId, inviterId);
            } else {
                // Update counts for all inviters in the guild
                const inviters = inviteDb.prepare(`
                    SELECT DISTINCT inviter_id FROM invites WHERE guild_id = ?
                `).all(guildId);
                
                for (const row of inviters) {
                    await this.updateUserInviteCounts(guildId, row.inviter_id);
                }
            }
        } catch (error) {
            logger.error(`Error updating invite counts in guild ${guildId}:`, error);
        }
    }

    /**
     * Update invite counts for a specific user
     * @param {string} guildId - The guild ID
     * @param {string} userId - The user ID
     */
    async updateUserInviteCounts(guildId, userId) {
        try {
            // Count regular invites (not fake and not left)
            const regularCount = inviteDb.prepare(`
                SELECT COUNT(*) as count FROM invites
                WHERE guild_id = ? AND inviter_id = ? AND is_fake = 0 AND is_left = 0
            `).get(guildId, userId).count;
            
            // Count fake invites (including those who left)
            const fakeCount = inviteDb.prepare(`
                SELECT COUNT(*) as count FROM invites
                WHERE guild_id = ? AND inviter_id = ? AND is_fake = 1
            `).get(guildId, userId).count;
            
            // Count left invites (excluding fake ones to avoid double counting)
            const leftCount = inviteDb.prepare(`
                SELECT COUNT(*) as count FROM invites
                WHERE guild_id = ? AND inviter_id = ? AND is_left = 1 AND is_fake = 0
            `).get(guildId, userId).count;

            // Check if record exists
            const existingRecord = inviteDb.prepare(`
                SELECT * FROM invite_counts WHERE guild_id = ? AND user_id = ?
            `).get(guildId, userId);
            
            if (existingRecord) {
                // Update existing record
                inviteDb.prepare(`
                    UPDATE invite_counts 
                    SET regular = ?, fake = ?, left = ?
                    WHERE guild_id = ? AND user_id = ?
                `).run(regularCount, fakeCount, leftCount, guildId, userId);
            } else {
                // Insert new record
                inviteDb.prepare(`
                    INSERT INTO invite_counts (guild_id, user_id, regular, fake, left)
                    VALUES (?, ?, ?, ?, ?)
                `).run(guildId, userId, regularCount, fakeCount, leftCount);
            }
        } catch (error) {
            logger.error(`Error updating invite counts for user ${userId} in guild ${guildId}:`, error);
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
            // Get the invite counts from the database
            const result = inviteDb.prepare(`
                SELECT regular, fake, left FROM invite_counts
                WHERE guild_id = ? AND user_id = ?
            `).get(guildId, userId);

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
            // Check if settings exist - use a more efficient query
            const result = inviteDb.prepare(`
                SELECT * FROM guild_invite_settings WHERE guild_id = ?
            `).get(guildId);
            
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
                        inviteDb.prepare(`
                            INSERT INTO guild_invite_settings (
                                guild_id, 
                                count_fake_invites, 
                                count_left_invites, 
                                enable_invite_welcome,
                                invite_welcome_channel,
                                invite_welcome_message
                            )
                            VALUES (?, 0, 0, 0, NULL, 'Hi, {user} Welcome to our server! You were invited by {inviter} who now has {invites} invites.')
                        `).run(guildId);
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
            
            logger.info(`Fetching channel ${settings.invite_welcome_channel} in guild ${member.guild.id}`);
            const channel = await member.guild.channels.fetch(settings.invite_welcome_channel)
                .catch((error) => {
                    logger.error(`Error fetching channel ${settings.invite_welcome_channel}: ${error.message}`);
                    return null;
                });
            
            if (!channel) {
                logger.warn(`Channel ${settings.invite_welcome_channel} not found in guild ${member.guild.id}`);
                return;
            }
            
            if (!channel.isTextBased()) {
                logger.warn(`Channel ${settings.invite_welcome_channel} is not a text channel in guild ${member.guild.id}`);
                return;
            }
            
            logger.info(`Getting invite counts for inviter ${inviter.tag} (${inviter.id}) in guild ${member.guild.id}`);
            // Get inviter's invite counts
            const inviteCounts = await this.getInviteCounts(member.guild.id, inviter.id);
            logger.info(`Invite counts for ${inviter.id}: ${JSON.stringify(inviteCounts)}`);
            
            // Format the welcome message
            let message = settings.invite_welcome_message || 
                'Hi, {user} Welcome to our server! You were invited by {inviter} who now has {invites} invites.';
            
            logger.info(`Original welcome message template: ${message}`);
            
            message = message
                .replace(/{user}/g, `<@${member.id}>`)
                .replace(/{inviter}/g, `<@${inviter.id}>`)
                .replace(/{invites}/g, inviteCounts.total.toString());
            
            logger.info(`Formatted welcome message: ${message}`);
            logger.info(`Sending welcome message to channel ${channel.name} (${channel.id})`);
            
            await channel.send(message);
            logger.info(`Welcome message sent successfully`);
        } catch (error) {
            logger.error(`Error sending welcome message in guild ${member.guild.id}:`, error);
        }
    }

    /**
     * Reset invites for a user
     * @param {string} guildId - The guild ID
     * @param {string} userId - The user ID (if null, reset all invites in the guild)
     * @param {string} type - The type of invites to reset ('regular', 'fake', 'left', 'all')
     * @returns {boolean} Whether the operation was successful
     */
    async resetInvites(guildId, userId = null, type = 'all') {
        try {
            if (userId) {
                // Reset invites for a specific user
                if (type === 'all') {
                    // Delete all invites for the user
                    inviteDb.prepare(`
                        DELETE FROM invites 
                        WHERE guild_id = ? AND inviter_id = ?
                    `).run(guildId, userId);
                } else if (type === 'fake') {
                    // Update fake invites to regular
                    inviteDb.prepare(`
                        UPDATE invites 
                        SET is_fake = 0 
                        WHERE guild_id = ? AND inviter_id = ? AND is_fake = 1
                    `).run(guildId, userId);
                } else if (type === 'left') {
                    // Update left invites to not left
                    inviteDb.prepare(`
                        UPDATE invites 
                        SET is_left = 0 
                        WHERE guild_id = ? AND inviter_id = ? AND is_left = 1
                    `).run(guildId, userId);
                } else {
                    // Invalid type
                    return false;
                }
                
                // Update the invite counts for this user
                await this.updateInviteCounts(guildId, userId);
            } else {
                // Reset all invites in the guild
                inviteDb.prepare(`
                    DELETE FROM invites 
                    WHERE guild_id = ?
                `).run(guildId);
                
                // Delete all invite counts for the guild
                inviteDb.prepare(`
                    DELETE FROM invite_counts 
                    WHERE guild_id = ?
                `).run(guildId);
            }

            return true;
        } catch (error) {
            logger.error(`Error resetting invites in guild ${guildId}:`, error);
            return false;
        }
    }
}

module.exports = InviteTracker;