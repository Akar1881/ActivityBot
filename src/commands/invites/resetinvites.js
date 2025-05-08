const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { optimizeCommand } = require('../../utils/performance');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resetinvites')
        .setDescription('Reset invites for a user or the entire server')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to reset invites for (leave empty to reset all invites)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('The type of invites to reset')
                .setRequired(false)
                .addChoices(
                    { name: 'All Invites', value: 'all' },
                    { name: 'Regular Invites', value: 'regular' },
                    { name: 'Fake Invites', value: 'fake' },
                    { name: 'Left Invites', value: 'left' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    category: 'invites',
    
    // Use the optimized command wrapper
    execute: optimizeCommand(async function(interaction, client) {
        const { guild } = interaction;
        const targetUser = interaction.options.getUser('user');
        const type = interaction.options.getString('type') || 'all';
        
        // Check if invite tracker is initialized
        if (!client.inviteTracker) {
            return await interaction.editReply('❌ Invite tracking is not enabled on this server!');
        }
        
        // Reset invites
        const success = await client.inviteTracker.resetInvites(
            guild.id, 
            targetUser ? targetUser.id : null, 
            type
        );
        
        if (success) {
            if (targetUser) {
                return await interaction.editReply(`✅ Successfully reset ${type} invites for ${targetUser.tag}.`);
            } else {
                return await interaction.editReply(`✅ Successfully reset all invites for the entire server.`);
            }
        } else {
            return await interaction.editReply('❌ Failed to reset invites. Please try again later.');
        }
    })
};