// VOYPATH ULTIMATE TRANSFORMATION - COMPLETE LANDING PAGE
(function() {
  'use strict';
  
  // Authentication check - redirect logged in users
  const token = localStorage.getItem('token');
  const supabaseAuth = localStorage.getItem('supabase.auth.token');
  if (token || supabaseAuth) {
    window.location.href = 'https://voypath.app';
    return;
  }
  
  // Wait for DOM
  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }
  
  ready(function() {
    // COMPLETE CONTENT TRANSFORMATION
    const contentMap = {
      // Hero Section
      'Connect, Share, and Grow with Appit Social': '<span style="background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 50%, #3b82f6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Plan Your Perfect Trip Together</span>',
      'Join Appit to build authentic connections and share your passions effortlessly.': 'Collaborate with friends to create AI-optimized travel itineraries. Add places, vote on favorites, and explore together.',
      'Trusted by 3+ million users': 'Trusted by 10,000+ travelers',
      'Join Waitlist': 'Start Planning Now',
      'App Available For': 'Available on',
      
      // Empowering Section
      'Empowering authentic connections for a vibrant social experience.': 'Empowering travelers to create unforgettable journeys through collaborative planning.',
      '450k+': '50k+',
      'Shared moments and stories every month': 'Trips planned successfully',
      '150k+': '100k+',
      'Community members worldwide': 'Happy travelers worldwide',
      
      // Features Section
      'Discover Appit Features': 'How Voypath Works',
      "Explore Appit's powerful features designed to help you connect, share, and engage with your community effortlessly.": 'Four simple steps to plan your perfect trip with friends',
      
      // CTA Section
      'Ready to transform your social experience?': 'Ready to Start Your Next Adventure?',
      'Join Appit today and start building meaningful connections.': 'Join thousands of travelers who plan smarter, travel better.',
      'Get Started': 'Launch Voypath App',
      'Upgrade to Premium': 'Upgrade to Premium',
      
      // Footer
      'Trusted by 1000+ businesses across the world': 'Used by travelers in 50+ countries'
    };
    
    // Feature cards data
    const featureCards = [
      {
        title: '1. Create Your Trip',
        description: 'Start a new trip, set your destination and dates. Invite friends with a simple link.',
        icon: '🗺️'
      },
      {
        title: '2. Invite Travel Buddies',
        description: 'Share your trip code with friends. Everyone can join and contribute their ideas.',
        icon: '👥'
      },
      {
        title: '3. Add & Vote on Places',
        description: 'Everyone adds must-see spots. Vote on favorites to prioritize what matters most.',
        icon: '📍'
      },
      {
        title: '4. Optimize Your Route',
        description: 'AI analyzes all places and creates the perfect itinerary based on location and preferences.',
        icon: '✨'
      }
    ];
    
    // Replace all text content
    function transformContent() {
      // Use TreeWalker for efficient text node traversal
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            if (node.parentElement && 
                (node.parentElement.tagName === 'SCRIPT' || 
                 node.parentElement.tagName === 'STYLE')) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );
      
      let node;
      while (node = walker.nextNode()) {
        let text = node.textContent;
        let changed = false;
        
        Object.keys(contentMap).forEach(key => {
          if (text.includes(key)) {
            text = text.replace(new RegExp(key, 'g'), contentMap[key]);
            changed = true;
          }
        });
        
        if (changed && node.parentElement) {
          // If it's a heading, use innerHTML for gradient support
          if (['H1', 'H2', 'H3'].includes(node.parentElement.tagName)) {
            node.parentElement.innerHTML = text;
          } else {
            node.textContent = text;
          }
        }
      }
    }
    
    // Update feature cards
    function updateFeatureCards() {
      const cards = document.querySelectorAll('[data-framer-name*="Feature Card"], .framer-1jz67mg, .framer-15zj0l6, .framer-qjwigi, .framer-Jlq9N');
      
      cards.forEach((card, index) => {
        if (featureCards[index]) {
          // Find and update title
          const titles = card.querySelectorAll('h3, [data-framer-component-type="RichTextContainer"] p');
          titles.forEach(el => {
            const text = el.textContent.trim();
            if (text && text.length < 50 && text !== featureCards[index].title) {
              el.textContent = featureCards[index].title;
              if (el.tagName === 'H3' || el.style.fontSize > '20px') {
                el.style.color = '#0ea5e9';
                el.style.fontWeight = '700';
              }
            }
          });
          
          // Find and update description
          const descriptions = card.querySelectorAll('p');
          descriptions.forEach(el => {
            const text = el.textContent.trim();
            if (text && text.length > 30 && text !== featureCards[index].description && !text.includes('.')) {
              el.textContent = featureCards[index].description;
            }
          });
          
          // Add icon if there's an icon container
          const iconContainers = card.querySelectorAll('[data-framer-name*="Icon"]');
          iconContainers.forEach(container => {
            container.style.fontSize = '48px';
            container.textContent = featureCards[index].icon;
          });
        }
      });
    }
    
    // Make all buttons functional
    function updateButtons() {
      const buttons = document.querySelectorAll('a[data-framer-name*="Button"], a[href*="waitlist"], .framer-1yvmtw8, .framer-1xd6uv3, .framer-1ehmbyi');
      
      buttons.forEach(button => {
        const buttonText = button.textContent?.trim().toLowerCase();
        
        // Set appropriate URL based on button text
        if (buttonText?.includes('premium')) {
          button.href = '#premium';
        } else {
          button.href = 'https://voypath.app';
        }
        
        button.target = '_self';
        button.style.cursor = 'pointer';
        
        // Add hover effect
        button.addEventListener('mouseenter', function() {
          this.style.transform = 'translateY(-2px)';
        });
        
        button.addEventListener('mouseleave', function() {
          this.style.transform = 'translateY(0)';
        });
      });
    }
    
    // Add Voypath logo with click functionality
    function addVoypathLogo() {
      // Create SVG logo
      const logoSVG = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#0ea5e9"/>
        <path d="M10 16L14 20L22 12" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
      
      // Find logo containers
      const logoContainers = document.querySelectorAll('[data-framer-name="Logo"], [data-framer-name="Appit"]');
      logoContainers.forEach(container => {
        container.innerHTML = logoSVG + '<span style="margin-left: 8px; font-size: 24px; font-weight: 700; color: #0ea5e9;">Voypath</span>';
        
        // Make logo clickable
        container.style.cursor = 'pointer';
        container.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        container.addEventListener('click', function() {
          window.location.href = 'https://voypath.app';
        });
        
        // Add hover effects
        container.addEventListener('mouseenter', function() {
          this.style.transform = 'scale(1.05)';
          this.style.opacity = '0.8';
        });
        
        container.addEventListener('mouseleave', function() {
          this.style.transform = 'scale(1)';
          this.style.opacity = '1';
        });
      });
    }
    
    // Update meta tags
    function updateMetaTags() {
      document.title = 'Voypath - Plan Your Perfect Trip Together';
      
      // Update or create meta tags
      const metaTags = {
        'description': 'Voypath helps you plan perfect trips with friends. Collaborate, vote on places, and let AI optimize your travel itinerary.',
        'og:title': 'Voypath - Plan Your Perfect Trip Together',
        'og:description': 'Collaborate with friends to create AI-optimized travel itineraries.',
        'twitter:title': 'Voypath - Plan Your Perfect Trip Together',
        'twitter:description': 'Collaborate with friends to create AI-optimized travel itineraries.'
      };
      
      Object.keys(metaTags).forEach(key => {
        let meta = document.querySelector(`meta[name="${key}"], meta[property="${key}"]`);
        if (!meta) {
          meta = document.createElement('meta');
          if (key.startsWith('og:')) {
            meta.setAttribute('property', key);
          } else {
            meta.setAttribute('name', key);
          }
          document.head.appendChild(meta);
        }
        meta.content = metaTags[key];
      });
      
      // Remove generator meta
      const generator = document.querySelector('meta[name="generator"]');
      if (generator) generator.remove();
    }
    
    // Remove Framer branding
    function removeFramerBranding() {
      // Remove Framer badges and references
      const framers = document.querySelectorAll('[id*="framer"], [class*="framer-badge"], [href*="framer.com"], [content*="Framer"], [title*="Praha"]');
      framers.forEach(el => {
        if (el.id && el.id.includes('framer-badge')) {
          el.remove();
        }
      });
      
      // Clean comments
      const comments = [];
      const iterator = document.createNodeIterator(
        document.body,
        NodeFilter.SHOW_COMMENT
      );
      let comment;
      while (comment = iterator.nextNode()) {
        comments.push(comment);
      }
      comments.forEach(c => c.remove());
    }
    
    // Add navigation
    function addNavigation() {
      const nav = document.createElement('nav');
      nav.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid rgba(14, 165, 233, 0.2);
        z-index: 1000;
        padding: 16px 0;
      `;
      
      nav.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; padding: 0 20px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="16" fill="#0ea5e9"/>
              <path d="M10 16L14 20L22 12" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span style="font-size: 24px; font-weight: 700; color: #0ea5e9;">Voypath</span>
          </div>
          <a href="https://voypath.app" style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 10px 24px; border-radius: 8px; font-weight: 600; text-decoration: none;">
            Launch App
          </a>
        </div>
      `;
      
      document.body.insertBefore(nav, document.body.firstChild);
      
      // Add padding to body for fixed nav
      document.body.style.paddingTop = '80px';
    }
    
    // Execute all transformations
    transformContent();
    updateFeatureCards();
    updateButtons();
    addVoypathLogo();
    updateMetaTags();
    removeFramerBranding();
    addNavigation();
    
    // Monitor for dynamic changes
    const observer = new MutationObserver(() => {
      transformContent();
      updateButtons();
      removeFramerBranding();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    
    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
    
    // Add CSS link
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'voypath-ultimate.css';
    document.head.appendChild(style);
  });
})();