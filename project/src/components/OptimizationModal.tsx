import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Wand2, Clock, Car, MapPin, DollarSign } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion } from 'framer-motion';

interface OptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OptimizationModal({ isOpen, onClose }: OptimizationModalProps) {
  const [settings, setSettings] = useState({
    startTime: '09:00',
    endTime: '18:00',
    transportation: 'mixed',
    priority: 'time',
    includeBreaks: true,
  });

  const { setIsOptimizing } = useStore();

  const handleOptimize = () => {
    setIsOptimizing(true);
    onClose();
    
    // Simulate optimization process
    setTimeout(() => {
      setIsOptimizing(false);
    }, 3000);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel
          as={motion.div}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-xl"
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
            <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Route Optimization
            </Dialog.Title>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Time Settings */}
            <div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3 flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                Daily Schedule
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={settings.startTime}
                    onChange={(e) => setSettings({ ...settings, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={settings.endTime}
                    onChange={(e) => setSettings({ ...settings, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Transportation */}
            <div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3 flex items-center">
                <Car className="w-4 h-4 mr-2" />
                Transportation
              </h3>
              <select
                value={settings.transportation}
                onChange={(e) => setSettings({ ...settings, transportation: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
              >
                <option value="mixed">Mixed (Optimal)</option>
                <option value="walking">Walking Only</option>
                <option value="public">Public Transport</option>
                <option value="car">Car/Taxi</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3 flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                Optimization Priority
              </h3>
              <div className="space-y-2">
                {[
                  { value: 'time', label: 'Minimize Travel Time', icon: Clock },
                  { value: 'distance', label: 'Minimize Distance', icon: MapPin },
                  { value: 'cost', label: 'Minimize Cost', icon: DollarSign },
                ].map(({ value, label, icon: Icon }) => (
                  <label key={value} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      value={value}
                      checked={settings.priority === value}
                      onChange={(e) => setSettings({ ...settings, priority: e.target.value })}
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                    />
                    <Icon className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Additional Options */}
            <div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">
                Additional Options
              </h3>
              <div className="space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeBreaks}
                    onChange={(e) => setSettings({ ...settings, includeBreaks: e.target.checked })}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500 rounded"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Include meal and rest breaks
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex space-x-3 p-6 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleOptimize}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-primary-500 to-secondary-600 text-white rounded-lg hover:from-primary-600 hover:to-secondary-700 transition-all flex items-center justify-center space-x-2"
            >
              <Wand2 className="w-4 h-4" />
              <span>Optimize Route</span>
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}