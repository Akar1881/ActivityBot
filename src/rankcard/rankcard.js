const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const { calculateProgress, calculateXpForLevel } = require('../handlers/xp');

async function createRankCard(user, chatXp, voiceXp, chatLevel, voiceLevel) {
  // Create a more compact canvas (500x200 instead of 800x250)
  const canvas = createCanvas(500, 200);
  const ctx = canvas.getContext('2d');

  // Set background with a gradient
  const bgGradient = ctx.createLinearGradient(0, 0, 500, 0);
  bgGradient.addColorStop(0, '#1a1a1a');
  bgGradient.addColorStop(1, '#2c2c2c');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add a subtle glow effect at the top
  const glowGradient = ctx.createRadialGradient(250, 0, 50, 250, 0, 250);
  glowGradient.addColorStop(0, 'rgba(45, 45, 65, 0.6)');
  glowGradient.addColorStop(1, 'rgba(45, 45, 65, 0)');
  ctx.fillStyle = glowGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add a subtle pattern/texture
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < canvas.width; i += 20) {
    for (let j = 0; j < canvas.height; j += 20) {
      if ((i + j) % 40 === 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(i, j, 10, 10);
      }
    }
  }
  ctx.globalAlpha = 1;

  // Load assets
  const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 128 }));
  const chatIcon = await loadImage(path.join(__dirname, 'icons/chat.png'));
  const voiceIcon = await loadImage(path.join(__dirname, 'icons/voice.png'));

  // Draw avatar with circular mask (smaller and positioned at top-left)
  ctx.save();
  ctx.beginPath();
  ctx.arc(50, 50, 35, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatar, 15, 15, 70, 70);
  ctx.restore();
  
  // Add avatar border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(50, 50, 35, 0, Math.PI * 2);
  ctx.stroke();

  // Draw username (next to avatar)
  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  
  // Truncate username if too long
  let displayName = user.username;
  if (displayName.length > 15) {
    displayName = displayName.substring(0, 12) + '...';
  }
  ctx.fillText(displayName, 100, 45);

  // Calculate XP requirements
  const chatNextLevelXp = Math.ceil(calculateXpForLevel(chatLevel + 1));
  const voiceNextLevelXp = Math.ceil(calculateXpForLevel(voiceLevel + 1));
  
  // Draw level badges
  // Chat level badge
  ctx.fillStyle = '#3498db';
  ctx.beginPath();
  ctx.arc(140, 70, 15, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(chatLevel, 140, 75);
  
  // Voice level badge
  ctx.fillStyle = '#9b59b6';
  ctx.beginPath();
  ctx.arc(180, 70, 15, 0, Math.PI * 2);
  ctx.fill();
  
  // Make sure the text color is set to white and font is bold
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(voiceLevel.toString(), 180, 75);
  
  // Add small labels for the badges
  ctx.font = '12px Arial';
  ctx.fillStyle = '#8a8a8a';
  ctx.fillText('CHAT', 140, 99);
  ctx.fillText('VOICE', 180, 99);

  // Progress section (bottom half of card)
  const progressY = 110;
  const barWidth = 400;
  const barHeight = 12;
  const barSpacing = 35;
  
  // Chat Experience Section
  // Draw background circle for chat icon
  ctx.fillStyle = '#2980b9';
  ctx.beginPath();
  ctx.arc(35, progressY + 5, 15, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw chat icon
  ctx.drawImage(chatIcon, 25, progressY - 5, 20, 20);
  
  // Chat progress bar background
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.roundRect(55, progressY, barWidth, barHeight, 6);
  ctx.fill();

  // Chat progress bar fill
  const chatProgress = calculateProgress(chatXp);
  const chatGradient = ctx.createLinearGradient(55, 0, 55 + barWidth, 0);
  chatGradient.addColorStop(0, '#3498db');
  chatGradient.addColorStop(1, '#2980b9');
  ctx.fillStyle = chatGradient;
  ctx.beginPath();
  ctx.roundRect(55, progressY, barWidth * chatProgress, barHeight, 6);
  ctx.fill();
  
  // Add shine effect to chat progress bar
  if (chatProgress > 0.05) {
    ctx.globalAlpha = 0.2;
    const shineWidth = barWidth * chatProgress - 10;
    if (shineWidth > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(55, progressY, shineWidth, barHeight/2, 3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  
  // Chat XP text
  ctx.font = 'bold 12px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  const chatXpText = `${chatXp}/${chatNextLevelXp} XP`;
  ctx.fillText(chatXpText, 455, progressY - 5);
  
  // Voice Experience Section
  // Draw background circle for voice icon
  ctx.fillStyle = '#8e44ad';
  ctx.beginPath();
  ctx.arc(35, progressY + barSpacing + 5, 15, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw voice icon
  ctx.drawImage(voiceIcon, 25, progressY + barSpacing - 5, 20, 20);
  
  // Voice progress bar background
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.roundRect(55, progressY + barSpacing, barWidth, barHeight, 6);
  ctx.fill();

  // Voice progress bar fill
  const voiceProgress = calculateProgress(voiceXp);
  const voiceGradient = ctx.createLinearGradient(55, 0, 55 + barWidth, 0);
  voiceGradient.addColorStop(0, '#9b59b6');
  voiceGradient.addColorStop(1, '#8e44ad');
  ctx.fillStyle = voiceGradient;
  ctx.beginPath();
  ctx.roundRect(55, progressY + barSpacing, barWidth * voiceProgress, barHeight, 6);
  ctx.fill();
  
  // Add shine effect to voice progress bar
  if (voiceProgress > 0.05) {
    ctx.globalAlpha = 0.2;
    const shineWidth = barWidth * voiceProgress - 10;
    if (shineWidth > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(55, progressY + barSpacing, shineWidth, barHeight/2, 3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  
  // Voice XP text
  ctx.font = 'bold 12px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  const voiceXpText = `${voiceXp}/${voiceNextLevelXp} XP`;
  ctx.fillText(voiceXpText, 455, progressY + barSpacing - 5);
  
  // Add percentage indicators on the progress bars
  ctx.font = 'bold 10px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  
  // Only show percentage if there's enough space in the progress bar
  if (chatProgress > 0.1) {
    const chatPercentage = Math.round(chatProgress * 100);
    const chatTextX = 55 + (barWidth * chatProgress / 2);
    ctx.fillText(`${chatPercentage}%`, chatTextX, progressY + 9);
  }
  
  if (voiceProgress > 0.1) {
    const voicePercentage = Math.round(voiceProgress * 100);
    const voiceTextX = 55 + (barWidth * voiceProgress / 2);
    ctx.fillText(`${voicePercentage}%`, voiceTextX, progressY + barSpacing + 9);
  }
  
  // Add a subtle border to the entire card
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  return canvas.toBuffer();
}

module.exports = { createRankCard };