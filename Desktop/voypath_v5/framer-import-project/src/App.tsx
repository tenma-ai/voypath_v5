import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import PremiumPage from './components/PremiumPage';
import './App.css';
import './styles/responsive.css';
import './styles/scroll-zoom-fixes.css';

function App() {
  useEffect(() => {
    // Check if user is logged in
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          // Redirect to main app if logged in
          window.location.href = 'https://voypath.app';
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      }
    };
    
    checkAuth();
  }, []);

  // Check if this is the premium page
  const isPremiumPage = window.location.pathname === '/premium' || window.location.hash === '#premium';
  
  if (isPremiumPage) {
    return <PremiumPage />;
  }

  return (
    <div className="app">
      {/* Navigation */}
      <nav className="nav-header">
        <div className="nav-content">
          <motion.div 
            className="logo"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{ cursor: 'pointer' }}
            onClick={() => window.location.href = 'https://voypath.app'}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="16" fill="var(--color-accent)" />
              <path d="M10 16L14 20L22 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="logo-text">Voypath</span>
          </motion.div>
          <motion.button 
            className="cta-button nav-cta"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.href = 'https://voypath.app'}
          >
            Get Started
          </motion.button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <motion.div 
          className="hero-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="hero-title">Plan Your Perfect Trip Together</h1>
          <p className="hero-subtitle">
            Collaborate with friends to create optimized travel itineraries. 
            Add places, vote on favorites, and let AI optimize your journey.
          </p>
          <motion.button 
            className="cta-button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.href = 'https://voypath.app'}
          >
            Start Planning Now
          </motion.button>
        </motion.div>
      </section>

      {/* How to Use Section */}
      <section className="features-section">
        <motion.h2 
          className="section-title"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          How to Use Voypath
        </motion.h2>
        <p className="section-subtitle">
          Create amazing trips in 4 simple steps
        </p>
        <div className="features-grid">
          {[
            {
              title: "Create Trip",
              description: "Start by creating a new trip. Set your destination, dates, and invite your travel companions.",
              icon: "1",
              screenshot: "screenshot-create-trip"
            },
            {
              title: "Invite Members",
              description: "Share your trip with friends. Each member can contribute ideas and vote on places.",
              icon: "2",
              screenshot: "screenshot-invite"
            },
            {
              title: "Add Places",
              description: "Everyone adds their must-visit spots. Vote on favorites to prioritize what matters most.",
              icon: "3",
              screenshot: "screenshot-add-places"
            },
            {
              title: "Optimize",
              description: "Let AI create the perfect itinerary based on locations, preferences, and travel times.",
              icon: "4",
              screenshot: "screenshot-optimize"
            }
          ].map((feature, index) => (
            <motion.div 
              key={index}
              className="feature-card"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
            >
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
              <div className="image-placeholder" data-screenshot={feature.screenshot}>
                {/* Screenshot placeholder */}
                <span>Screenshot: {feature.screenshot}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="content-section">
        <motion.div 
          className="content-wrapper"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
        >
          <div className="content-text">
            <h2>Why Choose Voypath?</h2>
            <ul className="feature-list">
              <li>✓ Collaborative trip planning with real-time updates</li>
              <li>✓ Smart itinerary optimization powered by AI</li>
              <li>✓ Vote on places to ensure everyone's happy</li>
              <li>✓ Automatic route planning and time management</li>
              <li>✓ Works on all devices - plan anywhere</li>
            </ul>
            <motion.button 
              className="cta-button secondary"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.location.href = 'https://voypath.app'}
            >
              Try Voypath Free
            </motion.button>
          </div>
          <div className="content-image">
            <div className="image-placeholder" data-screenshot="app-overview">
              <span>Screenshot: Main app interface</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <p>&copy; 2024 Voypath. Plan trips together, travel better.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;