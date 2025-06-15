import React, { useState } from 'react';
import { Copy, RefreshCw, Users, Settings, Crown, MoreVertical, Share2, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { ShareTripModal } from '../components/ShareTripModal';
import { useStore } from '../store/useStore';

const mockMembers = [
  {
    id: '1',
    name: 'Alice Johnson',
    avatar: 'A',
    role: 'Owner',
    isOnline: true,
    joinedAt: '5 days ago',
  },
  {
    id: '2',
    name: 'Bob Smith',
    avatar: 'B',
    role: 'Member',
    isOnline: true,
    joinedAt: '4 days ago',
  },
  {
    id: '3',
    name: 'Charlie Brown',
    avatar: 'C',
    role: 'Member',
    isOnline: false,
    joinedAt: '3 days ago',
  },
  {
    id: '4',
    name: 'Diana Prince',
    avatar: 'D',
    role: 'Member',
    isOnline: true,
    joinedAt: '2 days ago',
  },
];

export function SharePage() {
  const { currentTrip } = useStore();
  const [joinCode] = useState('ABC-123-XYZ');
  const [copied, setCopied] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            Members ({mockMembers.length})
          </h3>
          <button className="flex items-center space-x-2 px-3 py-1 bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-lg text-sm font-medium hover:bg-primary-200 dark:hover:bg-primary-900/30 transition-colors">
            <Users className="w-4 h-4" />
            <span>Invite</span>
          </button>
        </div>

        <div className="space-y-3">
          {mockMembers.map((member, index) => (
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
                    <span className="text-white font-medium">{member.avatar}</span>
                  </div>
                  {member.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white dark:border-slate-800 rounded-full"></div>
                  )}
                </div>
                
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {member.name}
                    </span>
                    {member.role === 'Owner' && (
                      <Crown className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
                    <span>{member.role}</span>
                    <span>•</span>
                    <span>Joined {member.joinedAt}</span>
                  </div>
                </div>
              </div>

              {member.role !== 'Owner' && (
                <button className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                  <MoreVertical className="w-4 h-4 text-slate-500" />
                </button>
              )}
            </motion.div>
          ))}
        </div>
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