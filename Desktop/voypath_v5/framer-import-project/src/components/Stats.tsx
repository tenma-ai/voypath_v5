import React from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import Logo from './Logo';

interface StatItem {
  value: number;
  suffix: string;
  label: string;
}

const stats: StatItem[] = [
  {
    value: 50,
    suffix: 'k+',
    label: 'Trips planned successfully'
  },
  {
    value: 100,
    suffix: 'k+',
    label: 'Happy travelers worldwide'
  }
];

const Counter: React.FC<{ value: number; suffix: string }> = ({ value, suffix }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      const duration = 2000;
      const steps = 60;
      const increment = value / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setCount(value);
          clearInterval(timer);
        } else {
          setCount(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }
  }, [isInView, value]);

  return (
    <div ref={ref} className="stat-number">
      {count}{suffix}
    </div>
  );
};

const Stats: React.FC = () => {
  return (
    <section className="stats-section">
      <div className="stats-container">
        <motion.div 
          className="stats-content"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="stats-header">
            <div className="stats-logo">
              <Logo width={60} height={60} />
            </div>
            <h2 className="stats-title">
              Empowering travelers to create perfect journeys together
            </h2>
          </div>

          <div className="stats-grid">
            {stats.map((stat, index) => (
              <motion.div 
                key={index}
                className="stat-item"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
              >
                <Counter value={stat.value} suffix={stat.suffix} />
                <p className="stat-label">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Trust Logos */}
        <motion.div 
          className="trust-logos"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <p className="trust-text">Used by travelers in 50+ countries</p>
          <div className="logos-marquee">
            <div className="logos-track">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="trust-logo">
                  <div className="logo-placeholder">Partner {i + 1}</div>
                </div>
              ))}
              {/* Duplicate for seamless loop */}
              {[...Array(6)].map((_, i) => (
                <div key={`dup-${i}`} className="trust-logo">
                  <div className="logo-placeholder">Partner {i + 1}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Stats;