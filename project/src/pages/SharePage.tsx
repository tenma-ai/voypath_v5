import React, { useState, useEffect } from 'react';
import { Copy, Users, Crown, Share2, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import { MemberColorService } from '../services/MemberColorService';

interface TripMember {
  id: string;
  name: string;
  email: string;
  role: string;
  joined_at: string;
  color?: string;
}

export function SharePage() {
  const { currentTrip } = useStore();
  const [joinCode, setJoinCode] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    if (currentTrip) {
      loadTripMembers();
      generateInvitationCode();
      generateShareLink();
    }
  }, [currentTrip]);

  const generateInvitationCode = async () => {
    if (!currentTrip) return;
    
    setGeneratingCode(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('User not authenticated');
      }

      console.log('🔑 Generating invitation code for trip:', currentTrip.id);
      
      const response = await fetch('https://rdufxwoeneglyponagdz.supabase.co/functions/v1/trip-member-management/create-invitation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trip_id: currentTrip.id,
          max_uses: 10,
          expires_hours: 168, // 1 week
          description: 'Share page invitation'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Invitation code generated:', data.invitation.code);
        setJoinCode(data.invitation.code);
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to generate invitation code:', errorData);
        // Fallback to existing code if generation fails
        const existingCodes = await getExistingInvitationCodes();
        if (existingCodes.length > 0) {
          setJoinCode(existingCodes[0].code);
        }
      }
    } catch (error) {
      console.error('❌ Error generating invitation code:', error);
      // Try to get existing codes as fallback
      const existingCodes = await getExistingInvitationCodes();
      if (existingCodes.length > 0) {
        setJoinCode(existingCodes[0].code);
      }
    } finally {
      setGeneratingCode(false);
    }
  };

  const generateShareLink = async () => {
    if (!currentTrip) return;
    
    setGeneratingLink(true);
    try {
      console.log('🔗 Generating share link for trip:', currentTrip.id);
      
      const response = await fetch('https://rdufxwoeneglyponagdz.supabase.co/functions/v1/trip-sharing-v3', {
        method: 'POST',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_share_link',
          trip_id: currentTrip.id,
          share_type: 'external_view',
          permissions: {
            can_view_places: true,
            can_join_as_member: true,
            can_export: true
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Share link generated:', data.shareToken);
        setShareLink(`${window.location.origin}/shared/${data.shareToken}`);
      } else {
        console.error('❌ Failed to generate share link');
        // Try to get existing share link
        const existingLink = await getExistingShareLink();
        if (existingLink) {
          setShareLink(`${window.location.origin}/shared/${existingLink}`);
        } else {
          setShareLink(`${window.location.origin}/trip/${currentTrip.id}`);
        }
      }
    } catch (error) {
      console.error('❌ Error generating share link:', error);
      setShareLink(`${window.location.origin}/trip/${currentTrip.id}`);
    } finally {
      setGeneratingLink(false);
    }
  };

  const getExistingInvitationCodes = async () => {
    if (!currentTrip) return [];
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const response = await fetch(`https://rdufxwoeneglyponagdz.supabase.co/functions/v1/trip-member-management/invitations/${currentTrip.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.invitations || [];
      }
    } catch (error) {
      console.error('❌ Error getting existing invitation codes:', error);
    }
    return [];
  };

  const getExistingShareLink = async () => {
    if (!currentTrip) return null;
    
    try {
      const { data, error } = await supabase
        .from('trip_shares')
        .select('share_token')
        .eq('trip_id', currentTrip.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        return data[0].share_token;
      }
    } catch (error) {
      console.error('❌ Error getting existing share link:', error);
    }
    return null;
  };

  const loadTripMembers = async () => {
    if (!currentTrip) return;

    try {
      // First get trip members
      const { data: memberIds, error: membersError } = await supabase
        .from('trip_members')
        .select('user_id, role, joined_at, assigned_color_index')
        .eq('trip_id', currentTrip.id);

      if (membersError) {
        console.error('❌ SharePage: Error loading trip members:', membersError);
        return;
      }

      if (!memberIds || memberIds.length === 0) {
        console.log('ℹ️ SharePage: No members found for trip:', currentTrip.id);
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
        console.error('❌ SharePage: Error loading users:', usersError);
        return;
      }

      // Load member colors
      const colorMapping = await MemberColorService.getSimpleColorMapping(currentTrip.id);
      console.log('🎨 SharePage: Color mapping:', colorMapping);

      // Combine the data
      const data = memberIds.map(member => {
        const user = usersData?.find(u => u.id === member.user_id);
        return {
          ...member,
          users: user
        };
      });

      const membersData = data?.map((member: any) => {
        const memberColor = colorMapping[member.user_id] || '#0077BE'; // Fallback color
        return {
          id: member.user_id,
          name: member.users?.name || member.users?.email || 'Unknown User',
          email: member.users?.email || '',
          role: member.role,
          joined_at: member.joined_at,
          color: memberColor
        };
      }) || [];

      console.log('✅ SharePage: Formatted members data with colors:', membersData);
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
            {generatingLink ? (
              <div className="flex items-center justify-center py-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm text-slate-600 dark:text-slate-400">Generating link...</span>
              </div>
            ) : (
              <div className="text-sm font-mono text-slate-900 dark:text-slate-100 break-all">
                {shareLink || 'No link available'}
              </div>
            )}
          </div>

          <button
            onClick={handleCopyLink}
            disabled={generatingLink || !shareLink}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
              {generatingCode ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mr-2"></div>
                  <span className="text-lg text-slate-600 dark:text-slate-400">Generating code...</span>
                </div>
              ) : (
                <div className="text-4xl font-mono font-bold text-slate-900 dark:text-slate-100 tracking-wider">
                  {joinCode || 'NO CODE'}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleCopyCode}
            disabled={generatingCode || !joinCode}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: member.color || '#0077BE' }}
                    >
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