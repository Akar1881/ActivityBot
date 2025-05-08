const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { db } = require('../../database/unifiedDb');
const { calculateLevel } = require('../../handlers/xp');
const { createRankCard } = require('../../rankcard/rankcard');
const { optimizeCommand } = require('../../utils/performance');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Shows your current rank and level'),
  category: 'leveling',

  // Use the optimized command wrapper
  execute: optimizeCommand(async function(interaction, client) {
    // Get user data from database
    const user = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?')
      .get(interaction.user.id, interaction.guild.id);

    if (!user) {
      return interaction.editReply('You haven\'t earned any XP yet!');
    }

    const chatLevel = calculateLevel(user.chat_xp);
    const voiceLevel = calculateLevel(user.voice_xp);

    // Generate rank card
    const rankCardBuffer = await createRankCard(
      interaction.user,
      user.chat_xp,
      user.voice_xp,
      chatLevel,
      voiceLevel
    );

    const attachment = new AttachmentBuilder(rankCardBuffer, { name: 'rankcard.png' });
    await interaction.editReply({ files: [attachment] });
  })
};