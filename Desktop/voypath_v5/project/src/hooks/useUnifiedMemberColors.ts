/**
 * Unified Member Colors Hook
 * Provides consistent member color management across all views
 */

import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { MemberColorService } from '../services/MemberColorService';

export interface UnifiedMemberData {
  userId: string;
  name: string;
  email: string;
  color: string;
  colorIndex: number;
}

export interface UnifiedMemberColors {
  memberColors: Record<string, string>;
  memberData: UnifiedMemberData[];
  isLoading: boolean;
  error: string | null;
  refreshColors: () => Promise<void>;
  getMemberColor: (userId: string) => string;
  getMemberData: (userId: string) => UnifiedMemberData | null;
}

/**
 * Hook for unified member color management
 * Automatically syncs with Supabase and provides consistent data across all views
 */
export function useUnifiedMemberColors(): UnifiedMemberColors {
  const { currentTrip } = useStore();
  const [memberColors, setMemberColors] = useState<Record<string, string>>({});
  const [memberData, setMemberData] = useState<UnifiedMemberData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshColors = async () => {
    if (!currentTrip?.id) {
      setMemberColors({});
      setMemberData([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🎨 [useUnifiedMemberColors] Loading colors for trip:', currentTrip.id);
      
      // Ensure all members have colors assigned
      await MemberColorService.ensureAllMembersHaveColors(currentTrip.id);
      
      // Get unified member colors
      const { memberColors: colors, memberData: data } = await MemberColorService.getUnifiedMemberColors(currentTrip.id);
      
      console.log('🎨 [useUnifiedMemberColors] Loaded colors:', { colors, data });
      
      setMemberColors(colors);
      setMemberData(data);
    } catch (err) {
      console.error('Failed to load member colors:', err);
      setError(err instanceof Error ? err.message : 'Failed to load member colors');
    } finally {
      setIsLoading(false);
    }
  };

  // Load colors when trip changes
  useEffect(() => {
    refreshColors();
  }, [currentTrip?.id]);

  // Helper functions
  const getMemberColor = (userId: string): string => {
    return memberColors[userId] || '#6B7280'; // Default gray color
  };

  const getMemberData = (userId: string): UnifiedMemberData | null => {
    return memberData.find(member => member.userId === userId) || null;
  };

  return {
    memberColors,
    memberData,
    isLoading,
    error,
    refreshColors,
    getMemberColor,
    getMemberData
  };
}

/**
 * Hook for getting a specific member's color
 */
export function useMemberColor(userId: string | undefined): string {
  const { getMemberColor } = useUnifiedMemberColors();
  return userId ? getMemberColor(userId) : '#6B7280';
}

/**
 * Hook for getting member data by user ID
 */
export function useMemberData(userId: string | undefined): UnifiedMemberData | null {
  const { getMemberData } = useUnifiedMemberColors();
  return userId ? getMemberData(userId) : null;
}

/**
 * Hook for place color calculation with unified member colors
 */
export function usePlaceColor(place: any): {
  type: 'single' | 'gradient' | 'gold' | 'system';
  background: string;
  textColor: string;
  contributors: UnifiedMemberData[];
} {
  const { memberColors, memberData } = useUnifiedMemberColors();

  // System places (departure/destination)
  if (place.place_type === 'departure' || place.place_type === 'destination' || 
      place.category === 'departure_point' || place.category === 'destination_point') {
    return {
      type: 'system',
      background: '#374151', // Gray-700
      textColor: '#FFFFFF',
      contributors: []
    };
  }

  // Get contributors from member_contribution field or fallback to user_id
  let contributors: UnifiedMemberData[] = [];
  
  if (place.member_contribution && Array.isArray(place.member_contribution)) {
    // Multiple contributors from member_contribution
    contributors = place.member_contribution
      .map((contrib: any) => memberData.find(m => m.userId === contrib.user_id))
      .filter(Boolean);
  } else if (place.user_id || place.userId) {
    // Single contributor
    const userId = place.user_id || place.userId;
    const memberInfo = memberData.find(m => m.userId === userId);
    if (memberInfo) {
      contributors = [memberInfo];
    }
  }

  // No contributors
  if (contributors.length === 0) {
    return {
      type: 'single',
      background: '#6B7280', // Gray-500
      textColor: '#FFFFFF',
      contributors: []
    };
  }

  // Single contributor
  if (contributors.length === 1) {
    return {
      type: 'single',
      background: contributors[0].color,
      textColor: MemberColorService.getContrastColor(contributors[0].color),
      contributors
    };
  }

  // Multiple contributors (2-4): gradient
  if (contributors.length <= 4) {
    const colors = contributors.slice(0, 3).map(c => c.color);
    const background = colors.length === 2 
      ? `linear-gradient(45deg, ${colors[0]} 0%, ${colors[1]} 100%)`
      : `linear-gradient(45deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`;
    
    return {
      type: 'gradient',
      background,
      textColor: '#FFFFFF',
      contributors
    };
  }

  // Many contributors (5+): gold
  return {
    type: 'gold',
    background: 'linear-gradient(45deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)',
    textColor: '#000000',
    contributors
  };
}