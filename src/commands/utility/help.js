const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows a list of all available commands')
    .addStringOption(option => 
      option.setName('category')
        .setDescription('Get help for a specific category')
        .setRequired(false)),
  category: 'utility',

  async execute(interaction, client) {
    try {
      const { options } = interaction;
      const category = options.getString('category');
      
      // If a category is specified, show commands for that category
      if (category) {
        return showCategoryCommands(interaction, client, category);
      }
      
      // Otherwise show the main help menu
      await showMainHelpMenu(interaction, client);
    } catch (error) {
      console.error('Error executing help command:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('An error occurred while processing your request.');
      } else {
        await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
      }
    }
  },
};

/**
 * Shows the main help menu with categories
 */
async function showMainHelpMenu(interaction, client) {
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

  const response = await interaction.reply({
    embeds: [helpEmbed],
    components: [selectRow, buttonRow],
    ephemeral: true
  });

  // Create a collector for the select menu
  const collector = response.createMessageComponentCollector({ 
    time: 60000 // 1 minute timeout
  });

  collector.on('collect', async i => {
    if (i.customId === 'help_category_select') {
      const selectedCategory = i.values[0];
      await showCategoryCommands(i, client, selectedCategory, true);
    }
  });

  collector.on('end', async () => {
    // Disable the select menu when the collector ends
    selectRow.components[0].setDisabled(true);
    await interaction.editReply({
      embeds: [helpEmbed],
      components: [selectRow, buttonRow]
    }).catch(console.error);
  });
}

/**
 * Shows commands for a specific category
 */
async function showCategoryCommands(interaction, client, category, isSelectMenu = false) {
  // Check if the category exists
  if (!client.commandCategories.has(category)) {
    const content = `Category "${category}" not found. Available categories: ${Array.from(client.commandCategories.keys()).join(', ')}`;
    
    if (isSelectMenu) {
      return interaction.update({ content, embeds: [], components: [] });
    } else {
      return interaction.reply({ content, ephemeral: true });
    }
  }

  // Get commands for this category
  const categoryCommands = [];
  
  client.commands.forEach(cmd => {
    if (cmd.category === category) {
      categoryCommands.push(cmd);
    }
  });

  // Create an embed for the category
  const categoryEmbed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle(`${category.charAt(0).toUpperCase() + category.slice(1)} Commands`)
    .setDescription(`Here are all the commands in the ${category} category:`)
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

  // Create a select menu for categories
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
            default: cat === category
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

  if (isSelectMenu) {
    await interaction.update({ embeds: [categoryEmbed], components: [selectRow, buttonRow] });
  } else {
    const response = await interaction.reply({
      embeds: [categoryEmbed],
      components: [selectRow, buttonRow],
      ephemeral: true
    });

    // Create a collector for the select menu and buttons
    const collector = response.createMessageComponentCollector({ 
      time: 60000 // 1 minute timeout
    });

    collector.on('collect', async i => {
      if (i.customId === 'help_category_select') {
        const selectedCategory = i.values[0];
        await showCategoryCommands(i, client, selectedCategory, true);
      } else if (i.customId === 'help_back_button') {
        await showMainHelpMenu(i, client);
      }
    });

    collector.on('end', async () => {
      // Disable the components when the collector ends
      selectRow.components[0].setDisabled(true);
      buttonRow.components[0].setDisabled(true);
      await interaction.editReply({
        embeds: [categoryEmbed],
        components: [selectRow, buttonRow]
      }).catch(console.error);
    });
  }
}