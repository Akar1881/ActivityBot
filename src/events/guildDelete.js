const { db } = require('../database/db');
const { clearGuildCaches } = require('../handlers/cache');

module.exports = {
  name: 'guildDelete',
  async execute(guild, client) {
    try {
      console.log(`Bot was removed from guild: ${guild.name} (${guild.id})`);
      
      // Delete all data for this guild
      await deleteGuildData(guild.id);
      
      console.log(`Successfully deleted all data for guild: ${guild.name} (${guild.id})`);
    } catch (error) {
      console.error(`Error handling guild deletion for ${guild.id}:`, error);
    }
  },
};

/**
 * Delete all data for a specific guild
 * @param {string} guildId - The guild ID to delete data for
 */
async function deleteGuildData(guildId) {
  try {
    console.log(`Starting data deletion for guild ${guildId}...`);
    
    // Begin a transaction to ensure all deletions succeed or fail together
    db.prepare('BEGIN TRANSACTION').run();
    
    try {
      // Delete guild settings
      const settingsDeleted = db.prepare('DELETE FROM guild_settings WHERE guild_id = ?').run(guildId);
      console.log(`Deleted ${settingsDeleted.changes} guild settings records`);
      
      // Delete user data
      const usersDeleted = db.prepare('DELETE FROM users WHERE guild_id = ?').run(guildId);
      console.log(`Deleted ${usersDeleted.changes} user records`);
      
      // Delete role rewards
      const roleRewardsDeleted = db.prepare('DELETE FROM role_rewards WHERE guild_id = ?').run(guildId);
      console.log(`Deleted ${roleRewardsDeleted.changes} role reward records`);
      
      // Delete excluded channels
      const excludedChannelsDeleted = db.prepare('DELETE FROM excluded_channels WHERE guild_id = ?').run(guildId);
      console.log(`Deleted ${excludedChannelsDeleted.changes} excluded channel records`);
      
      // Delete excluded roles
      const excludedRolesDeleted = db.prepare('DELETE FROM excluded_roles WHERE guild_id = ?').run(guildId);
      console.log(`Deleted ${excludedRolesDeleted.changes} excluded role records`);
      
      // Commit the transaction
      db.prepare('COMMIT').run();
      
      // Clear any caches for this guild
      clearGuildCaches(guildId);
      
      console.log(`Successfully deleted all data for guild ${guildId}`);
      return true;
    } catch (error) {
      // If any error occurs, roll back the transaction
      db.prepare('ROLLBACK').run();
      console.error(`Error deleting data for guild ${guildId}:`, error);
      throw error;
    }
  } catch (error) {
    console.error(`Failed to delete data for guild ${guildId}:`, error);
    return false;
  }
}