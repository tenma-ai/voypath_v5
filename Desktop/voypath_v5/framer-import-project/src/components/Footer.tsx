import React from 'react';
import { motion } from 'framer-motion';
import Logo from './Logo';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-main">
            {/* Logo and tagline */}
            <div className="footer-brand">
              <motion.div 
                className="footer-logo"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{ cursor: 'pointer' }}
                onClick={() => window.location.href = 'https://voypath.app'}
              >
                <Logo width={40} height={40} clickable={true} />
                <span className="footer-logo-text">Voypath</span>
              </motion.div>
              <p className="footer-tagline">
                Making group travel planning simple, smart, and fun.
              </p>
            </div>

            {/* Quick Links */}
            <div className="footer-links">
              <div className="link-group">
                <h4>Product</h4>
                <a href="https://voypath.app">Web App</a>
                <a href="#features">Features</a>
                <a href="https://voypath.app">Get Started</a>
              </div>
              <div className="link-group">
                <h4>Company</h4>
                <a href="https://voypath.app/about">About</a>
                <a href="https://voypath.app/contact">Contact</a>
                <a href="https://voypath.app/privacy">Privacy</a>
              </div>
              <div className="link-group">
                <h4>Connect</h4>
                <a href="https://twitter.com/voypath" target="_blank" rel="noopener noreferrer">Twitter</a>
                <a href="https://instagram.com/voypath" target="_blank" rel="noopener noreferrer">Instagram</a>
                <a href="mailto:hello@voypath.app">Email</a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="footer-bottom">
            <p className="copyright">
              © {currentYear} Voypath. All rights reserved.
            </p>
            <div className="footer-badges">
              <motion.div 
                className="badge"
                whileHover={{ scale: 1.05 }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z"/>
                </svg>
                <span>Secure</span>
              </motion.div>
              <motion.div 
                className="badge"
                whileHover={{ scale: 1.05 }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm.5-9H9v5l4.25 2.52.77-1.28-3.52-2.09V7z"/>
                </svg>
                <span>Fast</span>
              </motion.div>
              <motion.div 
                className="badge"
                whileHover={{ scale: 1.05 }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                </svg>
                <span>Support</span>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;