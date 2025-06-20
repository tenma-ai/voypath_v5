import React, { useState } from 'react';
import { Camera, Save, Sun, Moon, Globe, Bell, Shield, Download, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion } from 'framer-motion';

export function ProfilePage() {
  const { user, setUser, theme, toggleTheme } = useStore();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    displayName: user?.name || '',
  });
  const [hasChanges, setHasChanges] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    setHasChanges(true);
  };

  const handleSave = () => {
    if (user) {
      setUser({
        ...user,
        name: formData.name,
        email: formData.email,
      });
    }
    setHasChanges(false);
  };

  return (
    <div className="p-4 space-y-6">
      {/* Profile Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 text-center">
        <div className="relative inline-block mb-4">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-secondary-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-2xl">
              {formData.name?.charAt(0) || 'U'}
            </span>
          </div>
          <button className="absolute -bottom-1 -right-1 w-8 h-8 bg-white dark:bg-slate-700 rounded-full shadow-lg flex items-center justify-center border-2 border-white dark:border-slate-700">
            <Camera className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
        
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
          {formData.name || 'Guest User'}
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          {user?.isGuest ? 'Guest Account' : 'Registered User'}
        </p>
      </div>

      {/* Profile Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Profile Settings
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => handleInputChange('displayName', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Email (Optional)
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Display Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Display Settings
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              ) : (
                <Sun className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              )}
              <div>
                <h4 className="font-medium text-slate-900 dark:text-slate-100">
                  Theme
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Choose your preferred theme
                </p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                theme === 'dark' ? 'bg-primary-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Globe className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <div>
                <h4 className="font-medium text-slate-900 dark:text-slate-100">
                  Language
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  App display language
                </p>
              </div>
            </div>
            <select className="px-3 py-1 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm">
              <option>English</option>
              <option>日本語</option>
              <option>한국어</option>
              <option>中文</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center">
          <Bell className="w-5 h-5 mr-2" />
          Notifications
        </h3>
        
        <div className="space-y-4">
          {[
            { key: 'messages', label: 'New messages', description: 'Get notified of new group messages' },
            { key: 'updates', label: 'Trip updates', description: 'Changes to trip plans and schedules' },
            { key: 'members', label: 'New members', description: 'When someone joins your trip' },
            { key: 'reminders', label: 'Reminders', description: 'Upcoming activities and departures' },
          ].map((setting) => (
            <div key={setting.key} className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-slate-900 dark:text-slate-100">
                  {setting.label}
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {setting.description}
                </p>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary-600 transition-colors">
                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Data & Privacy */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center">
          <Shield className="w-5 h-5 mr-2" />
          Data & Privacy
        </h3>
        
        <div className="space-y-3">
          <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <div className="flex items-center space-x-3">
              <Download className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <div className="text-left">
                <h4 className="font-medium text-slate-900 dark:text-slate-100">
                  Export Data
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Download your trip data
                </p>
              </div>
            </div>
          </button>
          
          <button className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <div className="flex items-center space-x-3">
              <Trash2 className="w-5 h-5 text-red-500" />
              <div className="text-left">
                <h4 className="font-medium text-red-600 dark:text-red-400">
                  Delete Account
                </h4>
                <p className="text-sm text-red-500 dark:text-red-400">
                  Permanently delete your account
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 left-4 right-4"
        >
          <button
            onClick={handleSave}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-primary-500 to-secondary-600 text-white rounded-xl hover:from-primary-600 hover:to-secondary-700 transition-all shadow-lg"
          >
            <Save className="w-5 h-5" />
            <span className="font-medium">Save Changes</span>
          </button>
        </motion.div>
      )}
    </div>
  );
}