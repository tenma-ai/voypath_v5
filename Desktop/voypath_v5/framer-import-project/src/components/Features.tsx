import React from 'react';
import { motion } from 'framer-motion';

interface FeatureCard {
  title: string;
  description: string;
  icon: string;
  color: string;
}

const features: FeatureCard[] = [
  {
    title: '1. Create Your Trip',
    description: 'Start a new trip, set your destination and dates. Invite friends with a simple link.',
    icon: '🗺️',
    color: '#0ea5e9'
  },
  {
    title: '2. Invite Travel Buddies',
    description: 'Share your trip code with friends. Everyone can join and contribute their ideas.',
    icon: '👥',
    color: '#3b82f6'
  },
  {
    title: '3. Add & Vote on Places',
    description: 'Everyone adds must-see spots. Vote on favorites to prioritize what matters most.',
    icon: '📍',
    color: '#8b5cf6'
  },
  {
    title: '4. Optimize Your Route',
    description: 'AI analyzes all places and creates the perfect itinerary based on location and preferences.',
    icon: '✨',
    color: '#ec4899'
  }
];

const Features: React.FC = () => {
  return (
    <section className="features-section" id="features">
      <div className="features-container">
        <motion.div 
          className="features-header"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="section-title">How Voypath Works</h2>
          <p className="section-subtitle">
            Four simple steps to plan your perfect trip with friends
          </p>
        </motion.div>

        <div className="features-grid">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="feature-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
            >
              <motion.div 
                className="feature-icon"
                style={{ background: `linear-gradient(135deg, ${feature.color}33 0%, ${feature.color}11 100%)` }}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ duration: 0.3 }}
              >
                <span>{feature.icon}</span>
              </motion.div>
              <h3 className="feature-title" style={{ color: feature.color }}>
                {feature.title}
              </h3>
              <p className="feature-description">{feature.description}</p>
              
              {/* Feature illustration placeholder */}
              <div className="feature-illustration">
                <div className="illustration-placeholder" style={{ borderColor: feature.color + '33' }}>
                  <span>Screenshot {index + 1}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;