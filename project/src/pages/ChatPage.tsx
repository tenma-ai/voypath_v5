import React, { useState } from 'react';
import { Send, Paperclip, Smile, MapPin, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';


export function ChatPage() {
  const { currentTrip } = useStore();
  const [message, setMessage] = useState('');
  const [messages] = useState([]);

  const handleSendMessage = () => {
    if (message.trim()) {
      // Handle message sending
      setMessage('');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-slate-900">
      {/* Chat Header */}
      <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {currentTrip?.name || 'Trip Chat'}
            </h1>
            <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                <span>{currentTrip?.memberCount || 0} member{currentTrip?.memberCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {messages.map((msg, index) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex space-x-3 max-w-xs lg:max-w-md ${msg.isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}>
              {!msg.isOwn && (
                <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-secondary-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-medium text-sm">{msg.avatar}</span>
                </div>
              )}
              
              <div className={`flex flex-col ${msg.isOwn ? 'items-end' : 'items-start'}`}>
                {!msg.isOwn && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                    {msg.userName}
                  </span>
                )}
                
                {msg.type === 'place-share' ? (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 max-w-xs">
                    <div className="flex items-center space-x-2 mb-2">
                      <MapPin className="w-4 h-4 text-primary-500" />
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        Shared a place
                      </span>
                    </div>
                    <div className="flex items-start space-x-3">
                      <img
                        src={msg.place.image}
                        alt={msg.place.name}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {msg.place.name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {msg.place.category} • ⭐ {msg.place.rating}
                        </p>
                      </div>
                    </div>
                    <button className="w-full mt-2 px-3 py-1 bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-lg text-sm font-medium hover:bg-primary-200 dark:hover:bg-primary-900/30 transition-colors">
                      View Place
                    </button>
                  </div>
                ) : (
                  <div className={`px-4 py-2 rounded-2xl ${
                    msg.isOwn
                      ? 'bg-primary-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                  }`}>
                    <p className="text-sm">{msg.message}</p>
                  </div>
                )}
                
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {msg.timestamp}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Message Input */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center space-x-3">
          <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <Paperclip className="w-5 h-5 text-slate-500" />
          </button>
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
          </div>
          
          <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <Smile className="w-5 h-5 text-slate-500" />
          </button>
          
          <button
            onClick={handleSendMessage}
            disabled={!message.trim()}
            className="p-2 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-300 dark:disabled:bg-slate-600 rounded-full transition-colors disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}