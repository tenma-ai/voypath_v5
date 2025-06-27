// Comprehensive Voypath content replacer
document.addEventListener('DOMContentLoaded', function() {
  // Text replacements mapping
  const textReplacements = {
    // Headlines
    'Connect, Share, and Grow with Appit Social': 'Plan Your Perfect Trip Together',
    'Connect, share, and grow': 'Plan Your Perfect Trip',
    'Join Appit to build authentic connections and share your passions effortlessly.': 'Collaborate with friends to create optimized travel itineraries. Add places, vote on favorites, and let AI optimize your journey.',
    
    // Features section
    'Discover Appit Features': 'How to Use Voypath',
    "Explore Appit's powerful features designed to help you connect, share, and engage with your community effortlessly.": 'Create amazing trips in 4 simple steps',
    
    // Empowering section
    'Empowering authentic connections for a vibrant social experience.': 'Empowering travelers to create perfect journeys together.',
    
    // Stats
    'Shared moments and stories every month': 'Trips planned every month',
    'Community members worldwide': 'Happy travelers worldwide',
    
    // CTA section
    'Ready to transform your social experience?': 'Ready to plan your next adventure?',
    'Join Appit today and start building meaningful connections.': 'Join Voypath today and start planning unforgettable trips with your friends.',
    
    // Buttons
    'Join Waitlist': 'Start Planning',
    'Get Started': 'Start Planning Now',
    
    // Other
    'Appit': 'Voypath',
    'authentic connections': 'perfect trips',
    'social experience': 'travel experience',
  };
  
  // Feature cards content
  const featureCards = [
    {
      title: 'Create Trip',
      description: 'Start by creating a new trip. Set your destination, dates, and invite your travel companions.',
      icon: '🗺️'
    },
    {
      title: 'Invite Members',
      description: 'Share your trip with friends. Each member can contribute ideas and vote on places.',
      icon: '👥'
    },
    {
      title: 'Add Places',
      description: 'Everyone adds their must-visit spots. Vote on favorites to prioritize what matters most.',
      icon: '📍'
    },
    {
      title: 'Optimize',
      description: 'Let AI create the perfect itinerary based on locations, preferences, and travel times.',
      icon: '✨'
    }
  ];
  
  // Function to replace text content
  function replaceTextContent(element) {
    if (element.nodeType === Node.TEXT_NODE) {
      let text = element.textContent;
      Object.keys(textReplacements).forEach(key => {
        if (text.includes(key)) {
          text = text.replace(new RegExp(key, 'g'), textReplacements[key]);
        }
      });
      if (element.textContent !== text) {
        element.textContent = text;
      }
    } else if (element.nodeType === Node.ELEMENT_NODE) {
      // Skip script and style tags
      if (element.tagName !== 'SCRIPT' && element.tagName !== 'STYLE') {
        Array.from(element.childNodes).forEach(child => replaceTextContent(child));
      }
    }
  }
  
  // Replace all text content
  replaceTextContent(document.body);
  
  // Find and update feature cards
  const updateFeatureCards = () => {
    // Find feature section
    const featureSections = document.querySelectorAll('[data-framer-name*="Feature"], [data-framer-name*="feature"]');
    
    // Look for card containers
    const cardContainers = document.querySelectorAll('.framer-1jz67mg, .framer-15zj0l6, .framer-qjwigi, .framer-Jlq9N');
    
    cardContainers.forEach((card, index) => {
      if (featureCards[index]) {
        // Update title
        const titleElements = card.querySelectorAll('h3, [data-framer-name*="Heading"], .framer-text');
        titleElements.forEach(el => {
          if (el.textContent && !el.textContent.includes(featureCards[index].title)) {
            // Check if this is likely a feature title
            const text = el.textContent.trim();
            if (text.length < 50 && text.length > 2) {
              el.textContent = featureCards[index].title;
            }
          }
        });
        
        // Update description
        const descElements = card.querySelectorAll('p, [data-framer-name*="Paragraph"]');
        descElements.forEach(el => {
          if (el.textContent && el.textContent.length > 20) {
            el.textContent = featureCards[index].description;
          }
        });
        
        // Update icon if possible
        const iconElements = card.querySelectorAll('[data-framer-name*="Icon"]');
        iconElements.forEach(el => {
          if (el.textContent) {
            el.textContent = featureCards[index].icon;
          }
        });
      }
    });
  };
  
  // Update feature cards
  updateFeatureCards();
  
  // Update all links to point to Voypath
  const updateLinks = () => {
    const links = document.querySelectorAll('a');
    links.forEach(link => {
      if (link.href && (link.href.includes('waitlist') || link.href.includes('#'))) {
        link.href = 'https://voypath.app';
        link.target = '_self';
      }
    });
  };
  
  updateLinks();
  
  // Observer for dynamic content
  const observer = new MutationObserver(() => {
    replaceTextContent(document.body);
    updateFeatureCards();
    updateLinks();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
  
  // Update page title and meta
  document.title = 'Voypath - Plan Your Perfect Trip Together';
  
  // Update meta description
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.content = 'Voypath empowers you to plan perfect trips together. Collaborate with friends, add places, vote on favorites, and let AI optimize your journey.';
  }
  
  // Update Open Graph meta
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = 'Voypath - Plan Your Perfect Trip Together';
  
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.content = 'Voypath empowers you to plan perfect trips together. Collaborate with friends, add places, vote on favorites, and let AI optimize your journey.';
  
  const twitterTitle = document.querySelector('meta[name="twitter:title"]');
  if (twitterTitle) twitterTitle.content = 'Voypath - Plan Your Perfect Trip Together';
  
  const twitterDesc = document.querySelector('meta[name="twitter:description"]');
  if (twitterDesc) twitterDesc.content = 'Voypath empowers you to plan perfect trips together. Collaborate with friends, add places, vote on favorites, and let AI optimize your journey.';
});