document.addEventListener('DOMContentLoaded', () => {
  // Animate stats counting up
  const stats = document.querySelectorAll('.stat-number');
  stats.forEach(stat => {
    const target = parseInt(stat.getAttribute('data-value'));
    let current = 0;
    const increment = target / 50;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        clearInterval(timer);
        current = target;
      }
      stat.textContent = Math.floor(current).toLocaleString();
    }, 30);
  });

  // Animate features on scroll
  const features = document.querySelectorAll('.feature-card');
  const observerOptions = {
    threshold: 0.2,
    rootMargin: '0px'
  };

  const featureObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);

  features.forEach(feature => {
    feature.style.opacity = '0';
    feature.style.transform = 'translateY(20px)';
    feature.style.transition = 'all 0.6s ease-out';
    featureObserver.observe(feature);
  });

  // Parallax effect for hero section
  const hero = document.querySelector('.hero');
  if (hero) {
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;
      hero.style.backgroundPositionY = -(scrolled * 0.5) + 'px';
    });
  }

  // Smooth hover effects for buttons
  const buttons = document.querySelectorAll('.btn, .invite-button, .login-button');
  buttons.forEach(button => {
    button.addEventListener('mouseover', () => {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 5px 15px rgba(88, 101, 242, 0.4)';
    });

    button.addEventListener('mouseout', () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = 'none';
    });
  });

  // 3D card effect
  const cards = document.querySelectorAll('.server-card, .feature-card, .stat-card');
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const angleX = (y - centerY) / 20;
      const angleY = (centerX - x) / 20;
      
      card.style.transform = `perspective(1000px) rotateX(${angleX}deg) rotateY(${angleY}deg) scale3d(1.02, 1.02, 1.02)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
    });
  });
});