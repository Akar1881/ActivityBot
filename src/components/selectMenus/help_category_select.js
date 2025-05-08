const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  customId: 'help_category_select',
  
  async execute(interaction, params, client) {
    try {
      const selectedCategory = interaction.values[0];
      
      // Check if the category exists
      if (!client.commandCategories.has(selectedCategory)) {
        return interaction.update({ 
          content: `Category "${selectedCategory}" not found. Available categories: ${Array.from(client.commandCategories.keys()).join(', ')}`,
          embeds: [], 
          components: [] 
        });
      }
      
      // Get commands for this category
      const categoryCommands = [];
      
      client.commands.forEach(cmd => {
        if (cmd.category === selectedCategory) {
          categoryCommands.push(cmd);
        }
      });
      
      // Create an embed for the category
      const categoryEmbed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Commands`)
        .setDescription(`Here are all the commands in the ${selectedCategory} category:`)
        .setThumbnail(client.user.displayAvatarURL())
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();
      
      // Add each command to the embed
      categoryCommands.forEach(cmd => {
        categoryEmbed.addFields({
          name: `/${cmd.data.name}`,
          value: cmd.data.description || 'No description provided'
        });
      });
      
      // Create a select menu to switch categories
      const selectRow = new ActionRowBuilder()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('help_category_select')
            .setPlaceholder('Select a category')
            .addOptions(
              Array.from(client.commandCategories.keys()).map(cat => ({
                label: cat.charAt(0).toUpperCase() + cat.slice(1),
                description: `View ${cat} commands`,
                value: cat,
                default: cat === selectedCategory
              }))
            )
        );
      
      // Create a button to go back to the main menu
      const buttonRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('help_back_button')
            .setLabel('Back to Main Menu')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⬅️')
        );
      
      await interaction.update({ embeds: [categoryEmbed], components: [selectRow, buttonRow] });
    } catch (error) {
      console.error('Error in help_category_select menu handler:', error);
      
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