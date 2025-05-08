const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = (client) => {
  const commands = [];
  client.commandCategories = new Map();

  // Function to load commands from a directory
  const loadCommands = (dir, category = null) => {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        // If it's a directory, it's a category
        const categoryName = file;
        client.commandCategories.set(categoryName, []);
        loadCommands(filePath, categoryName);
      } else if (file.endsWith('.js')) {
        try {
          const command = require(filePath);
          
          // Add category to command object
          if (category) {
            command.category = category;
            client.commandCategories.get(category).push(command.data.name);
          }
          
          commands.push(command.data.toJSON());
          client.commands.set(command.data.name, command);
          console.log(`Loaded command: ${command.data.name}${category ? ` (Category: ${category})` : ''}`);
        } catch (error) {
          console.error(`Error loading command from ${filePath}:`, error);
        }
      }
    }
  };

  // First, check for root-level commands (for backward compatibility)
  const commandsDir = path.join(__dirname, '../commands');
  const rootFiles = fs.readdirSync(commandsDir)
    .filter(file => file.endsWith('.js'));
  
  // Load root-level commands
  for (const file of rootFiles) {
    try {
      const filePath = path.join(commandsDir, file);
      const command = require(filePath);
      commands.push(command.data.toJSON());
      client.commands.set(command.data.name, command);
      console.log(`Loaded command: ${command.data.name}`);
    } catch (error) {
      console.error(`Error loading command from ${path.join(commandsDir, file)}:`, error);
    }
  }

  // Then load category commands
  const categories = fs.readdirSync(commandsDir)
    .filter(item => {
      const itemPath = path.join(commandsDir, item);
      return fs.statSync(itemPath).isDirectory();
    });

  for (const category of categories) {
    const categoryPath = path.join(commandsDir, category);
    client.commandCategories.set(category, []);
    loadCommands(categoryPath, category);
  }

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  (async () => {
    try {
      console.log('Started refreshing application (/) commands.');

      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );

      console.log('Successfully reloaded application (/) commands.');
      console.log('Command categories:', Array.from(client.commandCategories.keys()));
    } catch (error) {
      console.error('Error refreshing application commands:', error);
    }
  })();
};