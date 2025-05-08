const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { optimizeCommand } = require('../../utils/performance');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invites')
        .setDescription('View your or another user\'s invite counts')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to check invites for')
                .setRequired(false)),
    category: 'invites',
    
    // Use the optimized command wrapper
    execute: optimizeCommand(async function(interaction, client) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;
        
        // Check if invite tracker is available
        if (!client.inviteTracker) {
            return await interaction.editReply('Invite tracking is currently unavailable. Please try again later.');
        }
        
        // Get the guild settings and invite counts in parallel
        const [settings, inviteCounts] = await Promise.all([
            client.inviteTracker.getGuildSettings(guildId),
            client.inviteTracker.getInviteCounts(guildId, targetUser.id)
        ]);
        
        // Create the embed
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`Invite Tracker - ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Regular', value: inviteCounts.regular.toString(), inline: true },
                { name: 'Fake', value: `${inviteCounts.fake} ${settings.count_fake_invites ? '(Counted ✅)' : '(Not counted ❌)'}`, inline: true },
                { name: 'Left', value: `${inviteCounts.left} ${settings.count_left_invites ? '(Counted ✅)' : '(Not counted ❌)'}`, inline: true },
                { name: 'Total', value: inviteCounts.total.toString(), inline: false }
            )
            .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    })
};