import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';

interface ShareTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
}

interface ShareLink {
  id: string;
  token: string;
  url: string;
  shareType: 'external_view' | 'external_collaborate';
  permissions: any;
  expiresAt?: string;
  maxUses?: number;
  hasPassword: boolean;
  createdAt: string;
}

export function ShareTripModal({ isOpen, onClose, tripId }: ShareTripModalProps) {
  const { user } = useStore();
  const [shareType, setShareType] = useState<'external_view' | 'external_collaborate'>('external_view');
  const [hasPassword, setHasPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [expiryDays, setExpiryDays] = useState<number | null>(null);
  const [maxUses, setMaxUses] = useState<number | null>(null);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const isPremium = user?.isPremium || false;

  useEffect(() => {
    if (isOpen) {
      loadExistingShares();
    }
  }, [isOpen, tripId]);

  const getAuthHeaders = async () => {
    const { supabase } = await import('../lib/supabase');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('Not authenticated');
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    };
  };

  const loadExistingShares = async () => {
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch('https://rdufxwoeneglyponagdz.supabase.co/functions/v1/trip-sharing-v3', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'get_my_shares'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const tripShares = data.shares.filter((share: any) => share.trips?.id === tripId);
        setShareLinks(tripShares.map((share: any) => ({
          id: share.id,
          token: share.share_token,
          url: `${window.location.origin}/shared/${share.share_token}`,
          shareType: share.share_type,
          permissions: share.permissions,
          expiresAt: share.expires_at,
          maxUses: share.max_uses,
          hasPassword: !!share.password_hash,
          createdAt: share.created_at
        })));
      }
    } catch (error) {
      console.error('Error loading shares:', error);
    }
  };

  const generateShareLink = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Starting share link generation...');
      console.log('Trip ID:', tripId);
      
      if (!tripId) {
        setError('No trip ID provided');
        return;
      }
      
      const headers = await getAuthHeaders();
      console.log('Headers prepared:', Object.keys(headers));
      
      const permissions = shareType === 'external_view' ? {
        can_view_places: true,
        can_add_places: false,
        can_edit_places: false,
        can_view_optimization: true,
        can_optimize: false,
        can_export: true,
        can_comment: false,
        can_join_as_member: false
      } : {
        can_view_places: true,
        can_add_places: true,
        can_edit_places: true,
        can_view_optimization: true,
        can_optimize: false,
        can_export: true,
        can_comment: true,
        can_join_as_member: false
      };

      const expiresAt = expiryDays ? 
        new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString() : 
        null;

      const requestBody = {
        action: 'create_share_link',
        tripId,
        shareType,
        permissions,
        password: hasPassword && isPremium ? password : null,
        expiresAt,
        maxUses: isPremium ? maxUses : null
      };

      console.log('Request body:', requestBody);

      const response = await fetch('https://rdufxwoeneglyponagdz.supabase.co/functions/v1/trip-sharing-v3', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const newShare = await response.json();
        console.log('New share created:', newShare);
        setShareLinks([newShare, ...shareLinks]);
        
        // Reset form
        setPassword('');
        setHasPassword(false);
        setExpiryDays(null);
        setMaxUses(null);
        console.log('Share creation successful!');
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        console.error('Share creation failed:', response.status, errorData);
        setError(errorData.error || `Failed to create share link (${response.status})`);
      }
    } catch (error) {
      console.error('Exception during share creation:', error);
      setError(error instanceof Error ? error.message : 'Failed to create share link');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (url: string, token: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const deleteShare = async (shareId: string) => {
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch('https://rdufxwoeneglyponagdz.supabase.co/functions/v1/trip-sharing-v3', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'delete_share',
          shareId
        }),
      });

      if (response.ok) {
        setShareLinks(shareLinks.filter(link => link.id !== shareId));
      }
    } catch (error) {
      console.error('Error deleting share:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Share Trip</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Create New Share */}
        <div className="border-b pb-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New Share Link</h3>
          
          {/* Share Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share Type
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="external_view"
                  checked={shareType === 'external_view'}
                  onChange={(e) => setShareType(e.target.value as any)}
                  className="mr-2"
                />
                View Only
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="external_collaborate"
                  checked={shareType === 'external_collaborate'}
                  onChange={(e) => setShareType(e.target.value as any)}
                  className="mr-2"
                />
                Collaborate
              </label>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {shareType === 'external_view' 
                ? 'Recipients can view places and export data'
                : 'Recipients can add/edit places and leave comments'
              }
            </p>
          </div>

          {/* Premium Features */}
          {isPremium && (
            <>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={hasPassword}
                    onChange={(e) => setHasPassword(e.target.checked)}
                    className="mr-2"
                  />
                  Password Protection
                </label>
                {hasPassword && (
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiry (days)
                </label>
                <select
                  value={expiryDays || ''}
                  onChange={(e) => setExpiryDays(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Never expires</option>
                  <option value="1">1 day</option>
                  <option value="7">1 week</option>
                  <option value="30">1 month</option>
                  <option value="90">3 months</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Uses
                </label>
                <input
                  type="number"
                  value={maxUses || ''}
                  onChange={(e) => setMaxUses(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Unlimited"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </>
          )}

          {!isPremium && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                🎁 Upgrade to Premium for password protection and expiry control!
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <button
            onClick={generateShareLink}
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create Share Link'}
          </button>
        </div>

        {/* Existing Shares */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Existing Share Links</h3>
          {shareLinks.length === 0 ? (
            <p className="text-gray-500">No share links created yet.</p>
          ) : (
            <div className="space-y-4">
              {shareLinks.map((link) => (
                <div key={link.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className={`inline-block px-2 py-1 text-xs rounded ${
                        link.shareType === 'external_view' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {link.shareType === 'external_view' ? 'View Only' : 'Collaborate'}
                      </span>
                      {link.hasPassword && (
                        <span className="ml-2 inline-block px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">
                          Password Protected
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => deleteShare(link.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={link.url}
                      readOnly
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50"
                    />
                    <button
                      onClick={() => copyToClipboard(link.url, link.token)}
                      className={`px-4 py-2 text-sm rounded-md ${
                        copiedToken === link.token
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-600 text-white hover:bg-gray-700'
                      }`}
                    >
                      {copiedToken === link.token ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    Created: {new Date(link.createdAt).toLocaleDateString()}
                    {link.expiresAt && (
                      <span className="ml-4">
                        Expires: {new Date(link.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                    {link.maxUses && (
                      <span className="ml-4">
                        Max uses: {link.maxUses}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}