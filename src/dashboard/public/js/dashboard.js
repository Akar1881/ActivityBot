document.addEventListener('DOMContentLoaded', () => {
  // Add smooth hover effects for server cards
  const serverCards = document.querySelectorAll('.server-card');
  
  serverCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-5px)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
    });
  });
});