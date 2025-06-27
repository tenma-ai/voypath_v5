import React from 'react';
import { motion } from 'framer-motion';
import Logo from './Logo';

const Navigation: React.FC = () => {
  return (
    <motion.nav 
      className="navigation"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="nav-container">
        <motion.div 
          className="nav-logo" 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{ cursor: 'pointer' }}
          onClick={() => window.location.href = 'https://voypath.app'}
        >
          <Logo width={32} height={32} clickable={true} />
          <span className="logo-text">Voypath</span>
        </motion.div>
        <motion.a 
          href="https://voypath.app" 
          className="nav-cta"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Launch App
        </motion.a>
      </div>
    </motion.nav>
  );
};

export default Navigation;