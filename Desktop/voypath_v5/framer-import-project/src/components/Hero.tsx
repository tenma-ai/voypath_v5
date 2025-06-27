import React from 'react';
import { motion } from 'framer-motion';
import { CheckIcon, AppStoreIcon, GooglePlayIcon } from './icons';

const Hero: React.FC = () => {
  return (
    <section className="hero-section">
      <div className="hero-background">
        <div className="gradient-orb gradient-orb-1" />
        <div className="gradient-orb gradient-orb-2" />
      </div>
      
      <div className="hero-container">
        {/* Trust Badge */}
        <motion.div 
          className="trust-badge"
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="trust-avatars">
            <div className="avatar avatar-1" />
            <div className="avatar avatar-2" />
            <div className="avatar avatar-3" />
          </div>
          <span>Trusted by 10,000+ travelers</span>
        </motion.div>

        {/* Main Content */}
        <div className="hero-content">
          <motion.h1 
            className="hero-title"
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <span className="gradient-text">Plan Your Perfect</span>
            <br />
            Trip Together
          </motion.h1>
          
          <motion.p 
            className="hero-subtitle"
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            Collaborate with friends to create AI-optimized travel itineraries. 
            Add places, vote on favorites, and explore together.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div 
            className="hero-buttons"
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <motion.a
              href="https://voypath.app"
              className="btn btn-primary"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              Start Planning Now
            </motion.a>
          </motion.div>

          {/* App Availability */}
          <motion.div 
            className="app-availability"
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <div className="availability-text">
              <CheckIcon size={20} />
              <span>Available on</span>
            </div>
            
            <div className="app-buttons-container">
              <motion.a
                href="https://voypath.app"
                className="btn btn-try-voypath"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <CheckIcon size={24} />
                Try Voypath
              </motion.a>
              
              <div className="store-buttons">
                <div className="store-icon app-store">
                  <AppStoreIcon size={28} />
                </div>
                <div className="store-divider" />
                <div className="store-icon google-play">
                  <GooglePlayIcon size={28} />
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Mobile Mockups */}
        <motion.div 
          className="hero-mockups"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
        >
          <motion.div 
            className="mockup mockup-1"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="mockup-screen" />
          </motion.div>
          <motion.div 
            className="mockup mockup-2"
            animate={{ y: [0, -15, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          >
            <div className="mockup-screen" />
          </motion.div>
          <motion.div 
            className="mockup mockup-3"
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          >
            <div className="mockup-screen" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;