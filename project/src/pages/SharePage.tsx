import React, { useState, useEffect } from 'react';
import { Copy, Users, Crown, Share2, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';

interface TripMember {
  id: string;
  name: string;
  email: string;
  role: string;
  joined_at: string;
}

export function SharePage() {
  const { currentTrip } = useStore();
  const [joinCode, setJoinCode] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentTrip) {
      setShareLink(`${window.location.origin}/join/${currentTrip.id}`);
      setJoinCode(generateFixedJoinCode(currentTrip.id));
      loadTripMembers();
    }
  }, [currentTrip]);

  const generateFixedJoinCode = (tripId: string) => {
    // Generate a consistent 6-character code based on trip ID
    const hash = tripId.slice(-6).toUpperCase();
    return hash.length >= 6 ? hash : (hash + 'ABCDEF').slice(0, 6);
  };

  const loadTripMembers = async () => {
    if (!currentTrip) return;

    try {
      const { data, error } = await supabase
        .from('trip_members')
        .select(`
          user_id,
          role,
          joined_at,
          users!inner (
            id,
            name,
            email
          )
        `)
        .eq('trip_id', currentTrip.id);

      if (error) throw error;

      const membersData = data?.map((member: any) => ({
        id: member.user_id,
        name: member.users?.name || member.users?.email || 'Unknown User',
        email: member.users?.email || '',
        role: member.role,
        joined_at: member.joined_at
      })) || [];

      setMembers(membersData);
    } catch (error) {
      console.error('❌ Failed to load trip members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(joinCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const formatJoinedDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'today';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  if (!currentTrip) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-8">
            <p className="text-slate-600 dark:text-slate-400">No trip selected</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Share Trip
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Share your trip with others using the link or invitation code below
          </p>
        </div>

        {/* Share Link Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-slate-700 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Share2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Share Link
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Anyone with this link can join your trip
              </p>
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 mb-4">
            <div className="text-sm font-mono text-slate-900 dark:text-slate-100 break-all">
              {shareLink}
            </div>
          </div>

          <button
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            <Copy className="w-4 h-4" />
            <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>

        {/* Invitation Code Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-slate-700 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl flex items-center justify-center">
              <ExternalLink className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Invitation Code
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Share this code for easy joining
              </p>
            </div>
          </div>
          
          <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-6 mb-4">
            <div className="text-center">
              <div className="text-4xl font-mono font-bold text-slate-900 dark:text-slate-100 tracking-wider">
                {joinCode}
              </div>
            </div>
          </div>

          <button
            onClick={handleCopyCode}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium"
          >
            <Copy className="w-4 h-4" />
            <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
          </button>
        </div>

        {/* Members Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-slate-700 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Members ({members.length})
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                People who have joined this trip
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-slate-600 dark:text-slate-400 mt-2">Loading members...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member, index) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-secondary-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium text-lg">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {member.name}
                        </span>
                        {member.role === 'admin' && (
                          <Crown className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {member.role === 'admin' ? 'Owner' : 'Member'} • Joined {formatJoinedDate(member.joined_at)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}