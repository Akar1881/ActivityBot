const express = require('express');
const router = express.Router();
const { db } = require('../../database/db');
const { inviteDb } = require('../../database/inviteDb');
const { getGuildLeaderboard } = require('../../handlers/xpHistory');

/**
 * Get the top guilds by total XP with time filtering
 * @param {number} limit - Maximum number of guilds to return
 * @param {string} timeFilter - Time period filter (all-time, monthly, weekly, daily)
 * @returns {Promise<Array>} - Array of guild XP data
 */
async function getTopGuilds(limit = 3, timeFilter = 'all-time') {
  try {
    // Convert dashboard time filter format to XP history format
    let period = 'all';
    if (timeFilter === 'daily') period = 'day';
    if (timeFilter === 'weekly') period = 'week';
    if (timeFilter === 'monthly') period = 'month';
    
    // Use the new XP history system to get guild leaderboard
    return getGuildLeaderboard(period, limit);
  } catch (error) {
    console.error('Error fetching top guilds:', error);
    return [];
  }
}

/**
 * Get the top guilds by total invites (only counting regular invites)
 * @param {number} limit - Maximum number of guilds to return
 * @returns {Promise<Array>} - Array of guild invite data
 */
async function getTopGuildsByInvites(limit = 100) {
  try {
    // Get all guilds with invite data
    const guildsWithInvites = inviteDb.prepare(`
      SELECT DISTINCT guild_id FROM invite_counts
    `).all();
    
    // For each guild, get the total invites (only regular invites)
    const guildInviteData = [];
    
    for (const { guild_id } of guildsWithInvites) {
      // Build the query to get only regular invites
      let query = `
        SELECT SUM(regular) as regular_sum, 
               SUM(fake) as fake_sum, 
               SUM(left) as left_sum,
               COUNT(*) as inviter_count
        FROM invite_counts
        WHERE guild_id = ?
      `;
      
      const counts = inviteDb.prepare(query).get(guild_id);
      
      if (counts) {
        // Only use regular invites for the leaderboard
        const totalInvites = counts.regular_sum || 0;
        
        guildInviteData.push({
          guild_id,
          total_invites: totalInvites,
          regular_invites: counts.regular_sum || 0,
          fake_invites: counts.fake_sum || 0,
          left_invites: counts.left_sum || 0,
          inviter_count: counts.inviter_count || 0
        });
      }
    }
    
    // Sort by total invites (which are now only regular invites)
    guildInviteData.sort((a, b) => b.total_invites - a.total_invites);
    
    // Return limited results
    return guildInviteData.slice(0, limit);
  } catch (error) {
    console.error('Error fetching top guilds by invites:', error);
    return [];
  }
}

// Main leaderboard route
router.get('/', async (req, res) => {
  const client = req.app.get('client');
  const timeFilter = req.query.timeFilter || 'all-time';
  const leaderboardType = req.query.type || 'xp'; // Default to XP leaderboard
  
  try {
    let guilds = [];
    let topGuilds = [];
    
    if (leaderboardType === 'invites') {
      // Get top 100 guilds by invites
      const guildInviteData = await getTopGuildsByInvites(100);
      
      // Format guild data with additional info from Discord client
      guilds = guildInviteData.map(guildData => {
        const guild = client.guilds.cache.get(guildData.guild_id);
        
        return {
          id: guildData.guild_id,
          name: guild?.name || 'Unknown Server',
          totalInvites: guildData.total_invites,
          regularInvites: guildData.regular_invites,
          fakeInvites: guildData.fake_invites,
          leftInvites: guildData.left_invites,
          inviterCount: guildData.inviter_count,
          iconURL: guild?.iconURL({ dynamic: true, size: 128 }) || '/img/default-guild.png',
          memberCount: guild?.memberCount || 0
        };
      }).filter(guild => guild.totalInvites > 0);
      
      // Get top 3 guilds for podium display
      topGuilds = guilds.slice(0, 3);
    } else {
      // Get top 100 guilds by XP with time filter
      const guildXpData = await getTopGuilds(100, timeFilter);
      
      // Format guild data with additional info from Discord client
      guilds = guildXpData.map(guildData => {
        const guild = client.guilds.cache.get(guildData.guild_id);
        
        return {
          id: guildData.guild_id,
          name: guild?.name || guildData.guild_name || 'Unknown Server',
          totalXP: parseInt(guildData.total_xp) || 0,
          iconURL: guild?.iconURL({ dynamic: true, size: 128 }) || '/img/default-guild.png',
          memberCount: guild?.memberCount || guildData.active_users || 0,
          activityScore: guildData.active_users ? 
            (guildData.total_xp / guildData.active_users) : 0
        };
      }).filter(guild => guild.totalXP > 0);

      // Get top 3 guilds for podium display
      topGuilds = guilds.slice(0, 3);
    }

    res.render('leaderboard', { 
      user: req.user,
      guilds: guilds,
      topGuilds: topGuilds,
      path: '/leaderboard',
      timeFilter: timeFilter,
      leaderboardType: leaderboardType
    });
  } catch (error) {
    console.error('Error in leaderboard route:', error);
    res.status(500).render('error', { 
      error: 'Failed to load leaderboard',
      user: req.user,
      path: '/leaderboard'
    });
  }
});

// API endpoint for guild data with filtering
router.get('/api/guilds', async (req, res) => {
  try {
    const client = req.app.get('client');
    const { timeFilter = 'all-time', page = 1, limit = 10, search = '', type = 'xp' } = req.query;
    
    let guilds = [];
    
    if (type === 'invites') {
      // Fetch guilds based on invites
      const guildInviteData = await getTopGuildsByInvites(100);
      
      // Format guild data with additional info from Discord client
      guilds = guildInviteData.map(guildData => {
        const guild = client.guilds.cache.get(guildData.guild_id);
        
        return {
          id: guildData.guild_id,
          name: guild?.name || 'Unknown Server',
          totalInvites: guildData.total_invites,
          regularInvites: guildData.regular_invites,
          fakeInvites: guildData.fake_invites,
          leftInvites: guildData.left_invites,
          inviterCount: guildData.inviter_count,
          iconURL: guild?.iconURL({ dynamic: true, size: 128 }) || '/img/default-guild.png',
          memberCount: guild?.memberCount || 0
        };
      }).filter(guild => guild.totalInvites > 0);
    } else {
      // Fetch guilds based on time filter
      const guildXpData = await getTopGuilds(100, timeFilter);
      
      // Format guild data with additional info from Discord client
      guilds = guildXpData.map(guildData => {
        const guild = client.guilds.cache.get(guildData.guild_id);
        
        return {
          id: guildData.guild_id,
          name: guild?.name || guildData.guild_name || 'Unknown Server',
          totalXP: parseInt(guildData.total_xp) || 0,
          iconURL: guild?.iconURL({ dynamic: true, size: 128 }) || '/img/default-guild.png',
          memberCount: guild?.memberCount || guildData.active_users || 0,
          activityScore: guildData.active_users ? 
            (guildData.total_xp / guildData.active_users) : 0
        };
      }).filter(guild => guild.totalXP > 0);
    }
    
    // Apply search filter if provided
    if (search) {
      guilds = guilds.filter(guild => 
        guild.name.toLowerCase().includes(search.toLowerCase()) ||
        guild.id.includes(search)
      );
    }
    
    // Calculate pagination
    const totalGuilds = guilds.length;
    const totalPages = Math.ceil(totalGuilds / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalGuilds);
    
    // Return paginated results
    res.json({
      guilds: guilds.slice(startIndex, endIndex),
      pagination: {
        total: totalGuilds,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit)
      },
      leaderboardType: type
    });
  } catch (error) {
    console.error('Error fetching guild data:', error);
    res.status(500).json({ error: 'Failed to fetch guild data' });
  }
});

module.exports = router;