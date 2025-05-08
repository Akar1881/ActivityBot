const express = require('express');
const router = express.Router();
const { db } = require('../../database/db');

// Function to get the top guilds by total XP
async function getTopGuilds(limit = 3) {
  try {
    // Get the sum of chat_xp and voice_xp for each guild
    const guildXpData = db.prepare(`
      SELECT guild_id, SUM(chat_xp + voice_xp) as total_xp
      FROM users
      GROUP BY guild_id
      ORDER BY total_xp DESC
      LIMIT ?
    `).all(limit);
    
    // Return empty array if no data
    if (!guildXpData || guildXpData.length === 0) {
      return [];
    }
    
    return guildXpData;
  } catch (error) {
    console.error('Error fetching top guilds:', error);
    return [];
  }
}

router.get('/', async (req, res) => {
  const client = req.app.get('client');
  
  // Calculate total members across all guilds
  const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
  
  // Get total number of guilds
  const totalGuilds = client.guilds.cache.size;

  // Get top 3 guilds by XP
  const topGuildsData = await getTopGuilds(3);
  
  // Format guild data with additional info from Discord client
  const topGuilds = topGuildsData.map(guildData => {
    const guild = client.guilds.cache.get(guildData.guild_id);
    
    if (!guild) {
      return {
        id: guildData.guild_id,
        name: 'Unknown Server',
        totalXP: guildData.total_xp,
        iconURL: '/img/default-guild.png'
      };
    }
    
    return {
      id: guild.id,
      name: guild.name,
      totalXP: guildData.total_xp,
      iconURL: guild.iconURL({ dynamic: true, size: 128 }) || '/img/default-guild.png',
      memberCount: guild.memberCount
    };
  });

  res.render('index', { 
    user: req.user,
    isAuthenticated: req.isAuthenticated(),
    stats: {
      guilds: totalGuilds,
      members: totalMembers
    },
    topGuilds: topGuilds,
    path: '/'
  });
});

module.exports = router;