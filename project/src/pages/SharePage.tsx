import React, { useState, useEffect } from 'react';
import { Copy, RefreshCw, Users, Settings, Crown, MoreVertical, Share2, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { ShareTripModal } from '../components/ShareTripModal';
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
  const { currentTrip, user } = useStore();
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentTrip) {
      loadTripMembers();
      generateJoinCode();
    }
  }, [currentTrip]);

  const loadTripMembers = async () => {
    if (!currentTrip) return;

    try {
      const { data, error } = await supabase
        .from('trip_members')
        .select(`
          user_id,
          role,
          joined_at,
          users (
            id,
            name,
            email
          )
        `)
        .eq('trip_id', currentTrip.id);

      if (error) throw error;

      const membersData = data?.map(member => ({
        id: member.user_id,
        name: member.users?.name || 'Unknown User',
        email: member.users?.email || '',
        role: member.role,
        joined_at: member.joined_at
      })) || [];

      setMembers(membersData);
    } catch (error) {
      console.error('Failed to load trip members:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateJoinCode = () => {
    // Generate a simple join code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 3; i++) {
      if (i > 0) code += '-';
      for (let j = 0; j < 3; j++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    setJoinCode(code);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatJoinedDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'today';
    if (diffDays === 2) return 'yesterday';
    return `${diffDays} days ago`;
  };

  return (
    <div className="p-4 space-y-6">
      {/* External Share Section */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            External Sharing
          </h2>
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>Create Share Link</span>
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Create shareable links for people outside your trip. Control permissions and access.
        </p>
        <div className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
          <ExternalLink className="w-4 h-4" />
          <span>Share with anyone, even without an account</span>
        </div>
      </div>

      {/* Join Code Section */}
      <div className="bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-xl p-6 border border-primary-200 dark:border-primary-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Member Invitation Code
        </h2>
        
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 mb-4">
          <div className="text-center">
            <div className="text-3xl font-mono font-bold text-slate-900 dark:text-slate-100 tracking-wider mb-2">
              {joinCode}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Valid for 7 days
            </p>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleCopyCode}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Copy className="w-4 h-4" />
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>
          
          <button className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Members ({members.length})
          </h3>
          <button className="flex items-center space-x-2 px-3 py-1 bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-lg text-sm font-medium hover:bg-primary-200 dark:hover:bg-primary-900/30 transition-colors">
            <Users className="w-4 h-4" />
            <span>Invite</span>
          </button>
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
                className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-secondary-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium">
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
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
                    <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
                      <span>{member.role === 'admin' ? 'Owner' : 'Member'}</span>
                      <span>•</span>
                      <span>Joined {formatJoinedDate(member.joined_at)}</span>
                    </div>
                  </div>
                </div>

                {member.role !== 'admin' && user?.id === currentTrip?.ownerId && (
                  <button className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                    <MoreVertical className="w-4 h-4 text-slate-500" />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Share Modal */}
      {currentTrip && (
        <ShareTripModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          tripId={currentTrip.id}
        />
      )}
    </div>
  );
}