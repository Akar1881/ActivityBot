const logger = require('../utils/logger');

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    try {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        
        if (!command) {
          logger.warn(`Command not found: ${interaction.commandName}`);
          return interaction.reply({ 
            content: 'This command is not available or has been removed.', 
            flags: 64 // Use flags instead of ephemeral property (64 = EPHEMERAL)
          });
        }
        
        try {
          await command.execute(interaction, client);
        } catch (error) {
          logger.error(`Error executing command ${interaction.commandName}:`, error);
          
          const errorMessage = 'There was an error while executing this command!';
          
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ 
              content: errorMessage, 
              flags: 64 // Use flags instead of ephemeral property (64 = EPHEMERAL)
            });
          } else {
            await interaction.reply({ 
              content: errorMessage, 
              flags: 64 // Use flags instead of ephemeral property (64 = EPHEMERAL)
            });
          }
        }
      }
      
      // Handle button interactions
      else if (interaction.isButton()) {
        // Extract the custom ID and any parameters
        const [buttonId, ...params] = interaction.customId.split(':');
        
        // Find a button handler if it exists
        const buttonHandler = client.buttons?.get(buttonId);
        
        if (!buttonHandler) {
          logger.warn(`Button handler not found: ${buttonId}`);
          return interaction.reply({ 
            content: 'This button is no longer available.', 
            flags: 64 // Use flags instead of ephemeral property (64 = EPHEMERAL)
          });
        }
        
        try {
          await buttonHandler.execute(interaction, params, client);
        } catch (error) {
          logger.error(`Error executing button handler ${buttonId}:`, error);
          
          // Check if the error is an Unknown Interaction error
          if (error.code === 10062) {
            logger.info('Interaction expired, this is normal after some time has passed');
            return;
          }
          
          try {
            if (interaction.replied || interaction.deferred) {
              await interaction.followUp({ 
                content: 'There was an error processing this button!', 
                flags: 64 // Use flags instead of ephemeral property (64 = EPHEMERAL)
              });
            } else {
              await interaction.reply({ 
                content: 'There was an error processing this button!', 
                flags: 64 // Use flags instead of ephemeral property (64 = EPHEMERAL)
              });
            }
          } catch (followUpError) {
            logger.error('Error sending error response:', followUpError);
          }
        }
      }
      
      // Handle select menus
      else if (interaction.isStringSelectMenu()) {
        // Extract the custom ID and any parameters
        const [menuId, ...params] = interaction.customId.split(':');
        
        // Find a select menu handler if it exists
        const menuHandler = client.selectMenus?.get(menuId);
        
        if (!menuHandler) {
          logger.warn(`Select menu handler not found: ${menuId}`);
          return interaction.reply({ 
            content: 'This menu is no longer available.', 
            flags: 64 // Use flags instead of ephemeral property (64 = EPHEMERAL)
          });
        }
        
        try {
          await menuHandler.execute(interaction, params, client);
        } catch (error) {
          logger.error(`Error executing select menu handler ${menuId}:`, error);
          
          // Check if the error is an Unknown Interaction error
          if (error.code === 10062) {
            logger.info('Interaction expired, this is normal after some time has passed');
            return;
          }
          
          try {
            if (interaction.replied || interaction.deferred) {
              await interaction.followUp({ 
                content: 'There was an error processing this menu!', 
                flags: 64 // Use flags instead of ephemeral property (64 = EPHEMERAL)
              });
            } else {
              await interaction.reply({ 
                content: 'There was an error processing this menu!', 
                flags: 64 // Use flags instead of ephemeral property (64 = EPHEMERAL)
              });
            }
          } catch (followUpError) {
            logger.error('Error sending error response:', followUpError);
          }
        }
      }
      
      // Handle modals
      else if (interaction.isModalSubmit()) {
        // Extract the custom ID and any parameters
        const [modalId, ...params] = interaction.customId.split(':');
        
        // Find a modal handler if it exists
        const modalHandler = client.modals?.get(modalId);
        
        if (!modalHandler) {
          logger.warn(`Modal handler not found: ${modalId}`);
          return interaction.reply({ 
            content: 'This form is no longer available.', 
            flags: 64 // Use flags instead of ephemeral property (64 = EPHEMERAL)
          });
        }
        
        try {
          await modalHandler.execute(interaction, params, client);
        } catch (error) {
          logger.error(`Error executing modal handler ${modalId}:`, error);
          
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ 
              content: 'There was an error processing your submission!', 
              flags: 64 // Use flags instead of ephemeral property (64 = EPHEMERAL)
            });
          } else {
            await interaction.reply({ 
              content: 'There was an error processing your submission!', 
              flags: 64 // Use flags instead of ephemeral property (64 = EPHEMERAL)
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error in interactionCreate event:', error);
      
      // Check if the error is an Unknown Interaction error
      if (error.code === 10062) {
        logger.info('Interaction expired, this is normal after some time has passed');
        return;
      }
      
      // For other errors, try to respond if possible
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ 
            content: 'An unexpected error occurred.', 
            flags: 64 // Use flags instead of ephemeral property (64 = EPHEMERAL)
          });
        } else {
          await interaction.reply({ 
            content: 'An unexpected error occurred.', 
            flags: 64 // Use flags instead of ephemeral property (64 = EPHEMERAL)
          });
        }
      } catch (followUpError) {
        logger.error('Error sending error response:', followUpError);
      }
    }
  },
};