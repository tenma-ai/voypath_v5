import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Settings, Users, Shield, Calendar, Clock, UserCheck, UserX, Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface TripSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TripMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  joinedAt: string;
  isOnline?: boolean;
  avatar?: string;
}


export function TripSettingsModal({ isOpen, onClose }: TripSettingsModalProps) {
  const { currentTrip, updateTrip, user } = useStore();
  const [activeTab, setActiveTab] = useState<'general' | 'permissions' | 'deadline'>('general');
  const [members, setMembers] = useState<TripMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [addPlaceDeadline, setAddPlaceDeadline] = useState(
    currentTrip?.addPlaceDeadline ? new Date(currentTrip.addPlaceDeadline).toISOString().slice(0, 16) : ''
  );

  // Load trip members when modal opens and currentTrip is available
  useEffect(() => {
    // Log message
    if (isOpen && currentTrip?.id) {
      // Log message
      loadTripMembers();
    } else {
      // Log message
    }
  }, [isOpen, currentTrip?.id]);

  const loadTripMembers = async () => {
    if (!currentTrip?.id) return;
    
    // Log message
    setIsLoadingMembers(true);
    
    try {
      // First get trip members
      const { data: memberIds, error: membersError } = await supabase
        .from('trip_members')
        .select('user_id, role, joined_at')
        .eq('trip_id', currentTrip.id);

      if (membersError) {
        // Error occurred
        return;
      }

      if (!memberIds || memberIds.length === 0) {
        // Log message
        setMembers([]);
        return;
      }

      // Then get user details
      const userIds = memberIds.map(m => m.user_id);
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds);

      if (usersError) {
        // Error occurred
        return;
      }

      // Combine the data
      const membersData = memberIds.map(member => {
        const user = usersData?.find(u => u.id === member.user_id);
        return {
          ...member,
          users: user
        };
      });

      // Log message

      if (membersData && membersData.length > 0) {
        const formattedMembers: TripMember[] = membersData
          .filter((member: any) => {
            if (!member.users) {
              // Warning occurred
              return false;
            }
            return true;
          })
          .map((member: any) => ({
            id: member.user_id,
            name: member.users.name || member.users.email || 'Unknown User',
            email: member.users.email || '',
            role: member.role,
            joinedAt: new Date(member.joined_at).toLocaleDateString(),
            avatar: member.users.name?.charAt(0).toUpperCase() || member.users.email?.charAt(0).toUpperCase() || 'U',
            isOnline: Math.random() > 0.5 // Temporary random online status
          }));
        
        // Log message
        setMembers(formattedMembers);
      }
    } catch (error) {
      // Error occurred
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'member') => {
    if (!currentTrip?.id || !user?.id) return;
    
    // Prevent users from changing their own role
    if (memberId === user.id) {
      alert('You cannot change your own role. Please ask another admin to change your role.');
      return;
    }
    
    // Check if current user is admin
    const currentUserMember = members.find(m => m.id === user.id);
    if (!currentUserMember || currentUserMember.role !== 'admin') {
      alert('Only admins can change member roles.');
      return;
    }
    
    try {
      // Update in database
      const { error } = await supabase
        .from('trip_members')
        .update({ role: newRole })
        .eq('trip_id', currentTrip.id)
        .eq('user_id', memberId);

      if (error) {
        // Error occurred
        return;
      }

      // Update local state
      setMembers(prev => 
        prev.map(member => 
          member.id === memberId ? { ...member, role: newRole } : member
        )
      );
    } catch (error) {
      // Error occurred
    }
  };

  const handleDeadlineChange = async (deadline: string) => {
    setAddPlaceDeadline(deadline);
    if (currentTrip) {
      const deadlineISO = deadline ? new Date(deadline).toISOString() : undefined;
      try {
        await updateTrip(currentTrip.id, { addPlaceDeadline: deadlineISO });
      } catch (error) {
        // Error occurred
      }
    }
  };

  const formatDeadline = (deadline: string) => {
    if (!deadline) return null;
    const date = new Date(deadline);
    const now = new Date();
    const isExpired = date < now;
    
    return {
      text: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      isExpired
    };
  };

  const deadlineInfo = addPlaceDeadline ? formatDeadline(addPlaceDeadline) : null;

  const tabs = [
    { key: 'general', label: 'General', icon: Settings },
    { key: 'permissions', label: 'Permissions', icon: Users },
    { key: 'deadline', label: 'Add Place Deadline', icon: Calendar },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen} onClose={onClose} className="relative z-[9999]">
          <motion.div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm" 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden="true" 
          />
          
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel
              as={motion.div}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="w-full max-w-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-glass border border-slate-200/50 dark:border-slate-700/50 overflow-hidden max-h-[90vh]"
            >
              {/* Header */}
              <div className="relative p-6 pb-4 border-b border-slate-200/50 dark:border-slate-700/50">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-50/50 via-transparent to-secondary-50/50 dark:from-primary-900/20 dark:via-transparent dark:to-secondary-900/20"></div>
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-600 rounded-2xl flex items-center justify-center shadow-glow">
                      <Settings className="w-5 h-5 text-white" />
                    </div>
                    <Dialog.Title className="text-xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                      Trip Settings
                    </Dialog.Title>
                  </div>
                  <motion.button
                    onClick={onClose}
                    className="p-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-700/80 transition-all duration-300"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-5 h-5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" />
                  </motion.button>
                </div>
              </div>

              {/* Tabs */}
              <div className="relative px-6 pt-4">
                <div className="flex space-x-1 bg-slate-100 dark:bg-slate-700 rounded-2xl p-1">
                  {tabs.map(({ key, label, icon: Icon }) => (
                    <motion.button
                      key={key}
                      onClick={() => setActiveTab(key as any)}
                      className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                        activeTab === key
                          ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-soft'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-96">
                <AnimatePresence mode="wait">
                  {activeTab === 'general' && (
                    <motion.div
                      key="general"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                          Trip Information
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                              Trip Name
                            </label>
                            <input
                              type="text"
                              value={currentTrip?.name || ''}
                              onChange={(e) => currentTrip && updateTrip(currentTrip.id, { name: e.target.value }).catch(() => {})}
                              className="w-full px-4 py-3 border-2 border-slate-200/50 dark:border-slate-600/50 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                              Description
                            </label>
                            <textarea
                              value={currentTrip?.description || ''}
                              onChange={(e) => currentTrip && updateTrip(currentTrip.id, { description: e.target.value }).catch(() => {})}
                              rows={3}
                              className="w-full px-4 py-3 border-2 border-slate-200/50 dark:border-slate-600/50 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300 resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'permissions' && (
                    <motion.div
                      key="permissions"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                          Member Permissions
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                          Manage member roles and permissions for this trip
                        </p>

                        {/* Permission Levels Info */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 mb-6">
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Permission Levels</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center space-x-3">
                              <Shield className="w-4 h-4 text-blue-500" />
                              <span className="font-medium text-slate-900 dark:text-slate-100">Admin:</span>
                              <span className="text-slate-600 dark:text-slate-400">Can manage settings, set deadlines, and modify trip details</span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <UserCheck className="w-4 h-4 text-green-500" />
                              <span className="font-medium text-slate-900 dark:text-slate-100">Member:</span>
                              <span className="text-slate-600 dark:text-slate-400">Can add places and participate in planning</span>
                            </div>
                          </div>
                        </div>

                        {/* Members List */}
                        <div className="space-y-3">
                          {isLoadingMembers ? (
                            <div className="flex items-center justify-center p-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                              <span className="ml-3 text-slate-600 dark:text-slate-400">Loading members...</span>
                            </div>
                          ) : members.length === 0 ? (
                            <div className="text-center p-8 text-slate-500 dark:text-slate-400">
                              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                              <p>No members found</p>
                            </div>
                          ) : (
                            members.map((member) => (
                            <motion.div
                              key={member.id}
                              className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 hover:shadow-soft transition-all duration-300"
                              whileHover={{ y: -1 }}
                            >
                              <div className="flex items-center space-x-4">
                                <div className="relative">
                                  <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-secondary-500 rounded-2xl flex items-center justify-center shadow-medium">
                                    <span className="text-white font-bold">{member.avatar}</span>
                                  </div>
                                  {member.isOnline && (
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white dark:border-slate-800 rounded-full"></div>
                                  )}
                                </div>
                                
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                      {member.name}
                                    </span>
                                    {member.role === 'admin' && (
                                      <Shield className="w-4 h-4 text-blue-500" />
                                    )}
                                  </div>
                                  <div className="text-sm text-slate-500 dark:text-slate-400">
                                    Joined {member.joinedAt}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center space-x-3">
                                {(() => {
                                  const currentUserMember = members.find(m => m.id === user?.id);
                                  const canChangeRole = currentUserMember?.role === 'admin' && member.id !== user?.id;
                                  
                                  return canChangeRole ? (
                                    <select
                                      value={member.role}
                                      onChange={(e) => handleRoleChange(member.id, e.target.value as 'admin' | 'member')}
                                      className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    >
                                      <option value="member">Member</option>
                                      <option value="admin">Admin</option>
                                    </select>
                                  ) : (
                                    <span className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-xl">
                                      {member.role === 'admin' ? 'Admin' : 'Member'}
                                    </span>
                                  );
                                })()}
                              </div>
                            </motion.div>
                          ))
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'deadline' && (
                    <motion.div
                      key="deadline"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-6"
                    >
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                          Add Place Deadline
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                          Set a deadline for when members can add new places to the trip
                        </p>

                        {/* Current Deadline Status */}
                        {deadlineInfo && (
                          <div className={`p-4 rounded-2xl border mb-6 ${
                            deadlineInfo.isExpired
                              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                          }`}>
                            <div className="flex items-center space-x-3">
                              <Clock className={`w-5 h-5 ${
                                deadlineInfo.isExpired ? 'text-red-500' : 'text-amber-500'
                              }`} />
                              <div>
                                <div className={`font-semibold ${
                                  deadlineInfo.isExpired 
                                    ? 'text-red-700 dark:text-red-300' 
                                    : 'text-amber-700 dark:text-amber-300'
                                }`}>
                                  {deadlineInfo.isExpired ? 'Deadline Expired' : 'Active Deadline'}
                                </div>
                                <div className={`text-sm ${
                                  deadlineInfo.isExpired 
                                    ? 'text-red-600 dark:text-red-400' 
                                    : 'text-amber-600 dark:text-amber-400'
                                }`}>
                                  {deadlineInfo.text}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Deadline Setting */}
                        <div className="space-y-4">
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Set Deadline
                          </label>
                          <div className="relative">
                            <input
                              type="datetime-local"
                              value={addPlaceDeadline}
                              onChange={(e) => handleDeadlineChange(e.target.value)}
                              min={new Date().toISOString().slice(0, 16)}
                              max={currentTrip?.endDate ? `${currentTrip.endDate}T23:59` : undefined}
                              className="w-full px-4 py-4 border-2 border-slate-200/50 dark:border-slate-600/50 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all duration-300 cursor-pointer hover:border-primary-300/50 dark:hover:border-primary-600/50"
                            />
                            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-500/10 to-secondary-500/10 opacity-0 focus-within:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Members will not be able to add new places after this deadline
                          </p>

                          {/* Quick Deadline Options */}
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { label: '1 Day Before Trip', hours: 24 },
                              { label: '3 Days Before Trip', hours: 72 },
                              { label: '1 Week Before Trip', hours: 168 },
                              { label: 'Clear Deadline', hours: null },
                            ].map((option) => (
                              <motion.button
                                key={option.label}
                                type="button"
                                onClick={() => {
                                  if (option.hours === null) {
                                    handleDeadlineChange('');
                                  } else if (currentTrip?.startDate) {
                                    const tripStart = new Date(currentTrip.startDate);
                                    const deadline = new Date(tripStart.getTime() - (option.hours * 60 * 60 * 1000));
                                    handleDeadlineChange(deadline.toISOString().slice(0, 16));
                                  }
                                }}
                                className="p-3 border-2 border-slate-200 dark:border-slate-600 rounded-2xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-300"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                {option.label}
                              </motion.button>
                            ))}
                          </div>
                        </div>

                        {/* Deadline Effects */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-800">
                          <div className="flex items-start space-x-3">
                            <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
                            <div>
                              <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
                                How Deadlines Work
                              </h4>
                              <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
                                <li>• Members can only add places before the deadline</li>
                                <li>• Admins can always add places regardless of deadline</li>
                                <li>• Existing places are not affected by the deadline</li>
                                <li>• The deadline is displayed on all trip views</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="flex justify-end space-x-3 p-6 border-t border-slate-200/50 dark:border-slate-700/50">
                <motion.button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 border-2 border-slate-200/50 dark:border-slate-600/50 text-slate-700 dark:text-slate-300 rounded-2xl hover:bg-slate-50/80 dark:hover:bg-slate-700/80 transition-all duration-300 font-semibold"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Close
                </motion.button>
                <motion.button
                  onClick={onClose}
                  className="px-6 py-3 bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-600 text-white rounded-2xl hover:from-primary-600 hover:via-secondary-600 hover:to-primary-700 transition-all duration-300 font-semibold shadow-glow hover:shadow-glow-lg relative overflow-hidden group"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <span className="relative z-10">Save Changes</span>
                </motion.button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}