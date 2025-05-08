const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../database/unifiedDb');
const { calculateLevel } = require('../../handlers/xp');
const { getLeaderboard } = require('../../handlers/xpHistory');
const { optimizeCommand } = require('../../utils/performance');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Shows the server leaderboard with detailed stats')
    .addIntegerOption(option => 
      option.setName('limit')
        .setDescription('Number of users to show (1-1000)')
        .setMinValue(1)
        .setMaxValue(1000)
        .setRequired(false))
    .addStringOption(option =>
      option.setName('period')
        .setDescription('Time period for the leaderboard')
        .setRequired(false)
        .addChoices(
          { name: 'All Time', value: 'all' },
          { name: 'Day', value: 'day' },
          { name: 'Week', value: 'week' },
          { name: 'Month', value: 'month' }
        )),
  category: 'leveling',

  // Use the optimized command wrapper
  execute: optimizeCommand(async function(interaction, client) {
      const limit = interaction.options.getInteger('limit') || 5;
      const period = interaction.options.getString('period') || 'all';
      
      // Get the requesting user's ID
      const requesterId = interaction.user.id;
      
      // Get chat leaderboard using the new XP history system
      const chatUsers = getLeaderboard(
        interaction.guild.id, 
        period, 
        limit > 5 ? limit + 50 : 100, 
        'chat'
      );
      
      // Get voice leaderboard using the new XP history system
      const voiceUsers = getLeaderboard(
        interaction.guild.id, 
        period, 
        limit > 5 ? limit + 50 : 100, 
        'voice'
      );
      
      // Find requester's rank in chat
      let requesterChatRank = -1;
      let requesterChatXp = 0;
      
      for (let i = 0; i < chatUsers.length; i++) {
        if (chatUsers[i].user_id === requesterId) {
          requesterChatRank = i + 1;
          requesterChatXp = chatUsers[i].chat_xp || chatUsers[i].xp || 0;
          break;
        }
      }
      
      // Find requester's rank in voice
      let requesterVoiceRank = -1;
      let requesterVoiceXp = 0;
      
      for (let i = 0; i < voiceUsers.length; i++) {
        if (voiceUsers[i].user_id === requesterId) {
          requesterVoiceRank = i + 1;
          requesterVoiceXp = voiceUsers[i].voice_xp || voiceUsers[i].xp || 0;
          break;
        }
      }
      
      // Format chat leaderboard
      const chatLeaderboard = [];
      
      // Determine if we're showing top 5 or custom limit
      const displayLimit = limit === 5 ? 5 : limit;
      const headerText = limit === 5 ? '**TOP 5 TEXT**' : `**TOP ${displayLimit} TEXT**`;
      chatLeaderboard.push(headerText);
      
      // Get users to display in chat leaderboard
      const chatLimit = Math.min(displayLimit, chatUsers.length);
      
      // Fetch members in bulk to improve performance
      const chatUserIds = chatUsers.slice(0, chatLimit).map(user => user.user_id);
      if (requesterChatRank > chatLimit && requesterChatRank !== -1) {
        chatUserIds.push(requesterId);
      }
      
      const chatMembers = await interaction.guild.members.fetch({ user: chatUserIds })
        .catch(() => new Map());
      
      // Add top users to chat leaderboard
      for (let i = 0; i < chatLimit; i++) {
        if (i >= chatUsers.length) break;
        
        const user = chatUsers[i];
        const member = chatMembers.get(user.user_id);
        
        // Get the XP value - handle both old and new data formats
        const xpValue = user.chat_xp || user.xp || 0;
        const levelValue = user.chat_level || calculateLevel(xpValue);
        
        if (member) {
          chatLeaderboard.push(`#${i + 1} ${member}: ${xpValue.toLocaleString()} XP (Level ${levelValue})`);
        } else {
          chatLeaderboard.push(`#${i + 1} Unknown User: ${xpValue.toLocaleString()} XP (Level ${levelValue})`);
        }
      }
      
      // Add requester to chat leaderboard if not in top displayed users
      if (requesterChatRank > chatLimit && requesterChatRank !== -1) {
        const member = chatMembers.get(requesterId);
        if (member) {
          // Get user's chat level
          const userChatLevel = db.prepare('SELECT chat_level FROM users WHERE user_id = ? AND guild_id = ?')
            .get(requesterId, interaction.guild.id)?.chat_level || calculateLevel(requesterChatXp);
            
          chatLeaderboard.push(`#${requesterChatRank} ${member}: ${requesterChatXp.toLocaleString()} XP (Level ${userChatLevel})`);
        }
      }
      
      // Format voice leaderboard
      const voiceLeaderboard = [];
      
      // Determine voice header
      const voiceHeaderText = limit === 5 ? '\n**TOP 5 VOICE CHAT**' : `\n**TOP ${displayLimit} VOICE CHAT**`;
      voiceLeaderboard.push(voiceHeaderText);
      
      // Get users to display in voice leaderboard
      const voiceLimit = Math.min(displayLimit, voiceUsers.length);
      
      // Fetch members in bulk for voice leaderboard
      const voiceUserIds = voiceUsers.slice(0, voiceLimit).map(user => user.user_id);
      if (requesterVoiceRank > voiceLimit && requesterVoiceRank !== -1) {
        voiceUserIds.push(requesterId);
      }
      
      const voiceMembers = await interaction.guild.members.fetch({ user: voiceUserIds })
        .catch(() => new Map());
      
      // Add top users to voice leaderboard
      for (let i = 0; i < voiceLimit; i++) {
        if (i >= voiceUsers.length) break;
        
        const user = voiceUsers[i];
        const member = voiceMembers.get(user.user_id);
        
        // Get the XP value - handle both old and new data formats
        const xpValue = user.voice_xp || user.xp || 0;
        const levelValue = user.voice_level || calculateLevel(xpValue);
        
        if (member) {
          voiceLeaderboard.push(`#${i + 1} ${member}: ${xpValue.toLocaleString()} XP (Level ${levelValue})`);
        } else {
          voiceLeaderboard.push(`#${i + 1} Unknown User: ${xpValue.toLocaleString()} XP (Level ${levelValue})`);
        }
      }
      
      // Add requester to voice leaderboard if not in top displayed users
      if (requesterVoiceRank > voiceLimit && requesterVoiceRank !== -1) {
        const member = voiceMembers.get(requesterId);
        if (member) {
          // Get user's voice level
          const userVoiceLevel = db.prepare('SELECT voice_level FROM users WHERE user_id = ? AND guild_id = ?')
            .get(requesterId, interaction.guild.id)?.voice_level || calculateLevel(requesterVoiceXp);
            
          voiceLeaderboard.push(`#${requesterVoiceRank} ${member}: ${requesterVoiceXp.toLocaleString()} XP (Level ${userVoiceLevel})`);
        }
      }
      
      // Check if we have any data to display
      if (chatUsers.length === 0 && voiceUsers.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0x0099FF)
          .setTitle('Guild Score Leaderboard')
          .setDescription('No XP data found for this time period.')
          .setTimestamp();
          
        await interaction.editReply({ embeds: [embed] });
        return;
      }
      
      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Guild Score Leaderboard')
        .setDescription([...chatLeaderboard, ...voiceLeaderboard].join('\n'))
        .setTimestamp();
      
      // Add footer based on period
      let footerText = 'All time stats';
      if (period === 'day') {
        footerText = 'Stats for the last 24 hours';
      } else if (period === 'week') {
        footerText = 'Stats for the last 7 days';
      } else if (period === 'month') {
        footerText = 'Stats for the last 30 days';
      }
      
      embed.setFooter({ text: footerText });
      
      await interaction.editReply({ embeds: [embed] });
  }),
};