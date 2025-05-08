const fs = require('fs');
const path = require('path');

module.exports = (client) => {
  // Load buttons
  const buttonFolders = path.join(__dirname, '../components/buttons');
  if (fs.existsSync(buttonFolders)) {
    const buttonFiles = fs.readdirSync(buttonFolders).filter(file => file.endsWith('.js'));
    
    for (const file of buttonFiles) {
      const button = require(`../components/buttons/${file}`);
      client.buttons.set(button.customId, button);
      console.log(`Loaded button: ${button.customId}`);
    }
  }
  
  // Load select menus
  const selectMenuFolders = path.join(__dirname, '../components/selectMenus');
  if (fs.existsSync(selectMenuFolders)) {
    const selectMenuFiles = fs.readdirSync(selectMenuFolders).filter(file => file.endsWith('.js'));
    
    for (const file of selectMenuFiles) {
      const selectMenu = require(`../components/selectMenus/${file}`);
      client.selectMenus.set(selectMenu.customId, selectMenu);
      console.log(`Loaded select menu: ${selectMenu.customId}`);
    }
  }
  
  // Load modals
  const modalFolders = path.join(__dirname, '../components/modals');
  if (fs.existsSync(modalFolders)) {
    const modalFiles = fs.readdirSync(modalFolders).filter(file => file.endsWith('.js'));
    
    for (const file of modalFiles) {
      const modal = require(`../components/modals/${file}`);
      client.modals.set(modal.customId, modal);
      console.log(`Loaded modal: ${modal.customId}`);
    }
  }
  
  console.log('All components loaded successfully');
};