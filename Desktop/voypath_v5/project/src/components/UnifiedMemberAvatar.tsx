/**
 * Unified Member Avatar Component
 * Provides consistent member representation across all views
 */

import React from 'react';
import { useUnifiedMemberColors, UnifiedMemberData } from '../hooks/useUnifiedMemberColors';

interface UnifiedMemberAvatarProps {
  userId: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
  showTooltip?: boolean;
  className?: string;
  onClick?: (memberData: UnifiedMemberData) => void;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl'
};

export function UnifiedMemberAvatar({
  userId,
  size = 'md',
  showName = false,
  showTooltip = true,
  className = '',
  onClick
}: UnifiedMemberAvatarProps) {
  const { getMemberColor, getMemberData } = useUnifiedMemberColors();
  
  const memberData = getMemberData(userId);
  const color = getMemberColor(userId);
  
  if (!memberData) {
    return (
      <div className={`${sizeClasses[size]} bg-gray-400 rounded-full flex items-center justify-center ${className}`}>
        <span className="text-white font-medium">?</span>
      </div>
    );
  }

  const initials = memberData.name
    .split(' ')
    .map(name => name.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleClick = () => {
    if (onClick && memberData) {
      onClick(memberData);
    }
  };

  const avatar = (
    <div 
      className={`
        ${sizeClasses[size]} 
        rounded-full 
        flex 
        items-center 
        justify-center 
        font-medium 
        text-white 
        ${onClick ? 'cursor-pointer hover:opacity-80' : ''}
        ${className}
      `}
      style={{ backgroundColor: color }}
      onClick={handleClick}
      title={showTooltip ? `${memberData.name} (${memberData.email})` : undefined}
    >
      {initials}
    </div>
  );

  if (showName) {
    return (
      <div className="flex items-center space-x-2">
        {avatar}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {memberData.name}
        </span>
      </div>
    );
  }

  return avatar;
}

/**
 * Component for displaying multiple member avatars (for places with multiple contributors)
 */
interface UnifiedMemberAvatarGroupProps {
  userIds: string[];
  maxDisplay?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showNames?: boolean;
  className?: string;
}

export function UnifiedMemberAvatarGroup({
  userIds,
  maxDisplay = 3,
  size = 'sm',
  showNames = false,
  className = ''
}: UnifiedMemberAvatarGroupProps) {
  const { memberData } = useUnifiedMemberColors();
  
  const displayUserIds = userIds.slice(0, maxDisplay);
  const remainingCount = userIds.length - maxDisplay;

  return (
    <div className={`flex items-center ${className}`}>
      <div className="flex -space-x-1">
        {displayUserIds.map(userId => (
          <UnifiedMemberAvatar
            key={userId}
            userId={userId}
            size={size}
            showTooltip={true}
            className="border-2 border-white"
          />
        ))}
        {remainingCount > 0 && (
          <div 
            className={`
              ${sizeClasses[size]} 
              bg-gray-500 
              rounded-full 
              flex 
              items-center 
              justify-center 
              text-white 
              font-medium 
              border-2 
              border-white
            `}
            title={`+${remainingCount} more members`}
          >
            +{remainingCount}
          </div>
        )}
      </div>
      {showNames && userIds.length === 1 && (
        <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {memberData.find(m => m.userId === userIds[0])?.name || 'Unknown User'}
        </span>
      )}
    </div>
  );
}

/**
 * Component for place color indicator with member contributors
 */
interface UnifiedPlaceColorIndicatorProps {
  place: any;
  size?: 'sm' | 'md' | 'lg';
  showContributors?: boolean;
  className?: string;
}

const indicatorSizes = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6', 
  lg: 'w-8 h-8'
};

export function UnifiedPlaceColorIndicator({
  place,
  size = 'md',
  showContributors = false,
  className = ''
}: UnifiedPlaceColorIndicatorProps) {
  const { memberData } = useUnifiedMemberColors();
  
  // Get contributors
  let contributors: string[] = [];
  if (place.member_contribution && Array.isArray(place.member_contribution)) {
    contributors = place.member_contribution.map((contrib: any) => contrib.user_id);
  } else if (place.user_id || place.userId) {
    contributors = [place.user_id || place.userId];
  }

  // Calculate color based on contributors
  let background: string;
  let borderClass = '';

  if (contributors.length === 0) {
    background = '#6B7280'; // Gray
  } else if (contributors.length === 1) {
    const memberInfo = memberData.find(m => m.userId === contributors[0]);
    background = memberInfo?.color || '#6B7280';
  } else if (contributors.length <= 4) {
    const colors = contributors
      .slice(0, 3)
      .map(userId => memberData.find(m => m.userId === userId)?.color || '#6B7280');
    
    if (colors.length === 2) {
      background = `linear-gradient(45deg, ${colors[0]} 0%, ${colors[1]} 100%)`;
    } else {
      background = `linear-gradient(45deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`;
    }
  } else {
    background = 'linear-gradient(45deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)';
    borderClass = 'shadow-lg shadow-yellow-400/30';
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div 
        className={`
          ${indicatorSizes[size]} 
          rounded-full 
          border-2 
          border-white 
          ${borderClass}
        `}
        style={{ background }}
        title={`${contributors.length} contributor${contributors.length !== 1 ? 's' : ''}`}
      />
      {showContributors && contributors.length > 0 && (
        <UnifiedMemberAvatarGroup
          userIds={contributors}
          size="xs"
          maxDisplay={3}
        />
      )}
    </div>
  );
}