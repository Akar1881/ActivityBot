const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  customId: 'help_back_button',
  
  async execute(interaction, params, client) {
    try {
      // Create the main help embed
      const helpEmbed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('ActivityBot Help')
        .setDescription('Select a category from the dropdown menu below to see available commands.')
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          { name: 'About', value: 'ActivityBot tracks user activity through messages and voice chat, awarding XP and levels. It also tracks server invites.' },
          { name: 'Categories', value: Array.from(client.commandCategories.keys()).join(', ') }
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      // Create a select menu for categories
      const selectRow = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('help_category_select')
            .setPlaceholder('Select a category')
            .addOptions(
              Array.from(client.commandCategories.keys()).map(category => ({
                label: category.charAt(0).toUpperCase() + category.slice(1),
                description: `View ${category} commands`,
                value: category,
              }))
            )
        );

      // Create buttons for website and support using environment variables
      const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
      const supportServerUrl = process.env.SUPPORT_SERVER_URL || 'https://discord.gg/yoursupportserver';
      
      const buttonRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('Dashboard')
            .setStyle(ButtonStyle.Link)
            .setURL(dashboardUrl)
            .setEmoji('🌐'),
          new ButtonBuilder()
            .setLabel('Support Server')
            .setStyle(ButtonStyle.Link)
            .setURL(supportServerUrl)
            .setEmoji('🛠️')
        );

      await interaction.update({
        embeds: [helpEmbed],
        components: [selectRow, buttonRow]
      });
    } catch (error) {
      console.error('Error in help_back_button handler:', error);
      
      // Check if the error is an Unknown Interaction error
      if (error.code === 10062) {
        console.log('Interaction expired, this is normal after some time has passed');
        return;
      }
      
      // Try to respond to the interaction if possible
      try {
        if (!interaction.replied) {
          await interaction.update({ 
            content: 'An error occurred while processing your selection.', 
            embeds: [], 
            components: [] 
          });
        }
      } catch (followUpError) {
        console.error('Error sending error response:', followUpError);
      }
    }
  }
};