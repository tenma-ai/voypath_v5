import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Key } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';

interface JoinTripModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JoinTripModal({ isOpen, onClose }: JoinTripModalProps) {
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { initializeFromDatabase, canJoinTrip, setCurrentTrip } = useStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsJoining(true);
    setError(null);
    
    // Check trip limit before attempting to join
    if (!canJoinTrip()) {
      setError('You have reached the maximum limit of 3 trips for your current plan. Please upgrade to Premium to join more trips.');
      setIsJoining(false);
      return;
    }
    
    try {
      // Log message
      
      // Get auth headers
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please log in to join a trip');
      }

      // Log message
      // Log message
      // Log message

      // Remove hyphens from the code if present
      const cleanCode = joinCode.replace(/-/g, '').toUpperCase();
      // Log message

      // Call trip-member-management Edge Function
      const response = await fetch('https://rdufxwoeneglyponagdz.supabase.co/functions/v1/trip-member-management/join-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          invitation_code: cleanCode
        }),
      });

      // Log message
      // Log message

      if (!response.ok) {
        let errorMessage = 'Failed to join trip';
        try {
          const errorData = await response.json();
          // Log message
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          // Log message
          const errorText = await response.text();
          // Log message
          if (errorText) errorMessage = errorText;
        }
        
        // Provide more specific error messages
        if (response.status === 404) {
          errorMessage = 'Invalid invitation code. Please check the code and try again.';
        } else if (response.status === 401) {
          errorMessage = 'Please log in to join a trip.';
        } else if (response.status === 403) {
          errorMessage = 'You do not have permission to join this trip.';
        } else if (response.status === 409) {
          errorMessage = 'You are already a member of this trip.';
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      // Log message

      // Refresh trips data from database
      await initializeFromDatabase();
      
      // Set the joined trip as current trip
      setCurrentTrip(data.trip);
      
      alert(`Trip joined successfully! Welcome to "${data.trip.name}"`);
      onClose();
      setJoinCode('');
      
      // Navigate to the plan page after a brief delay
      setTimeout(() => {
        navigate('/my-trip');
      }, 100);
    } catch (error) {
      // Error occurred
      setError(error instanceof Error ? error.message : 'Failed to join trip');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[9999]">
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
              Join Trip
            </Dialog.Title>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <Key className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                Enter the trip code shared by your group organizer
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Trip Code
              </label>
              <input
                type="text"
                required
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABCD1234"
                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-lg font-mono tracking-wider"
                maxLength={11}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter the 8-character code (hyphens optional)
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isJoining}
                className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!joinCode || isJoining}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-primary-500 to-secondary-600 text-white rounded-lg hover:from-primary-600 hover:to-secondary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isJoining ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Joining...
                  </div>
                ) : (
                  'Join Trip'
                )}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}