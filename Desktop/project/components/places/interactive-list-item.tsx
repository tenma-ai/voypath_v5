'use client'

import React, { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  GripVertical,
  ChevronDown,
  ChevronUp,
  Clock,
  Users,
  MapPin,
  Settings,
  X,
  Eye,
  EyeOff,
  Star,
  Car,
  Footprints,
  Bus,
  Plane,
  MoreHorizontal,
  Edit,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react'
import type { 
  InteractiveListItem, 
  EditingPermissions, 
  TimeAdjustmentControl,
  UserPreference
} from '@/lib/types/interactive-list'
import { 
  formatDuration, 
  getDragHandleStyles, 
  calculateUserSatisfaction 
} from '@/lib/utils/interactive-list-utils'

// Enhanced duration formatter for longer periods (matching add-place-form)
const formatDurationExtended = (minutes: number): string => {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
  } else {
    const days = Math.floor(minutes / 1440);
    const remainingHours = Math.floor((minutes % 1440) / 60);
    if (remainingHours > 0) {
      return `${days} ${days === 1 ? 'day' : 'days'} ${remainingHours}h`;
    } else {
      return `${days} ${days === 1 ? 'day' : 'days'}`;
    }
  }
};

interface InteractiveListItemProps {
  item: InteractiveListItem
  permissions: EditingPermissions
  currentUserId: string
  isSelected?: boolean
  isBeingDragged?: boolean
  displayMode: 'compact' | 'standard' | 'detailed'
  showPreferences?: boolean
  showTransport?: boolean
  
  // Callbacks
  onSelect?: (itemId: string) => void
  onTimeAdjust?: (itemId: string, newTime: number) => void
  onExclude?: (itemId: string, reason?: string) => void
  onInclude?: (itemId: string) => void
  onPreferenceEdit?: (itemId: string, userId: string, newPreference: UserPreference) => void
  onEdit?: (itemId: string) => void
  onRemove?: (itemId: string) => void
  
  // Drag and drop (will be handled by parent)
  dragHandleProps?: any
  className?: string
}

// Transport mode icon mapping
const transportIcons = {
  walking: Footprints,
  driving: Car,
  transit: Bus,
  flight: Plane
}

export function InteractiveListItem({
  item,
  permissions,
  currentUserId,
  isSelected = false,
  isBeingDragged = false,
  displayMode = 'standard',
  showPreferences = true,
  showTransport = true,
  onSelect,
  onTimeAdjust,
  onExclude,
  onInclude,
  onPreferenceEdit,
  onEdit,
  onRemove,
  dragHandleProps,
  className
}: InteractiveListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditingTime, setIsEditingTime] = useState(false)
  const [tempTimeValue, setTempTimeValue] = useState(item.allocatedTime)
  const [editingPreferenceUserId, setEditingPreferenceUserId] = useState<string | null>(null)
  
  // Calculate satisfaction for current user
  const currentUserSatisfaction = calculateUserSatisfaction(item, currentUserId)
  const userPreference = item.interestedUsers.find(u => u.userId === currentUserId)
  
  // Handle time adjustment
  const handleTimeAdjustment = (value: number[]) => {
    setTempTimeValue(value[0])
  }
  
  const commitTimeChange = () => {
    if (tempTimeValue !== item.allocatedTime) {
      onTimeAdjust?.(item.id, tempTimeValue)
    }
    setIsEditingTime(false)
  }
  
  const cancelTimeEdit = () => {
    setTempTimeValue(item.allocatedTime)
    setIsEditingTime(false)
  }
  
  // Handle exclude/include
  const handleExclude = () => {
    onExclude?.(item.id, 'User excluded from list view')
  }
  
  const handleInclude = () => {
    onInclude?.(item.id)
  }
  
  // Get transport icon
  const TransportIcon = item.transportToNext ? 
    transportIcons[item.transportToNext.mode] : null
  
  return (
    <div
      className={cn(
        "relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg transition-all duration-200",
        isSelected && "border-blue-500 dark:border-blue-400 shadow-sm",
        isBeingDragged && "shadow-lg scale-105 rotate-1 z-50",
        item.isExcluded && "opacity-60 bg-gray-50 dark:bg-gray-900",
        displayMode === 'compact' && "p-3",
        displayMode === 'standard' && "p-4",
        displayMode === 'detailed' && "p-5",
        "hover:shadow-sm",
        className
      )}
      onClick={() => onSelect?.(item.id)}
    >
      {/* Drag Handle */}
      {permissions.canReorderDestinations && !item.isExcluded && (
        <div
          {...dragHandleProps}
          className="absolute left-2 top-1/2 transform -translate-y-1/2 cursor-grab active:cursor-grabbing touch-none"
          style={getDragHandleStyles(isBeingDragged, false)}
        >
          <GripVertical className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
        </div>
      )}
      
      {/* Main Content */}
      <div className={cn(
        "flex items-start gap-3",
        permissions.canReorderDestinations && "ml-8"
      )}>
        {/* Order Badge */}
        <div className={cn(
          "flex-shrink-0 rounded-full flex items-center justify-center text-white font-semibold",
          displayMode === 'compact' ? "w-6 h-6 text-xs" : "w-8 h-8 text-sm",
          item.isExcluded ? "bg-gray-400" : "bg-blue-500"
        )}>
          {item.visitOrder}
        </div>
        
        {/* Content Area */}
        <div className="flex-1 min-w-0">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className={cn(
                "font-semibold text-gray-900 dark:text-white truncate",
                displayMode === 'compact' ? "text-sm" : "text-base"
              )}>
                {item.name}
              </h3>
              
              {displayMode !== 'compact' && (
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                  {item.address}
                </p>
              )}
              
              {item.scheduledDate && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    📅 {new Date(item.scheduledDate).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                  {/* Add time range based on allocated time */}
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    🕐 Duration: {formatDuration(item.allocatedTime)}
                  </div>
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Time Display/Edit */}
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-gray-400" />
                {isEditingTime && permissions.canAdjustTimes ? (
                  <div className="flex items-center gap-2 min-w-[120px]">
                    <Input
                      type="number"
                      value={tempTimeValue}
                      onChange={(e) => setTempTimeValue(Number(e.target.value))}
                      className="h-6 w-16 text-xs p-1"
                      min="15"
                      max="480"
                    />
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={commitTimeChange}
                      >
                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={cancelTimeEdit}
                      >
                        <X className="h-3 w-3 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-auto p-1 text-xs font-medium",
                      permissions.canAdjustTimes && "hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (permissions.canAdjustTimes) {
                        setIsEditingTime(true)
                      }
                    }}
                  >
                    {formatDuration(item.allocatedTime)}
                  </Button>
                )}
              </div>
              
              {/* User Count */}
              {showPreferences && item.interestedUsers.length > 0 && (
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {item.interestedUsers.length}
                  </span>
                </div>
              )}
              
              {/* More Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {permissions.canAdjustTimes && (
                    <DropdownMenuItem onClick={() => onEdit?.(item.id)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Details
                    </DropdownMenuItem>
                  )}
                  
                  {!item.isExcluded ? (
                    <DropdownMenuItem 
                      onClick={handleExclude}
                      className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <EyeOff className="h-4 w-4 mr-2" />
                      Exclude from trip
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem 
                      onClick={handleInclude}
                      className="text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Include in trip
                    </DropdownMenuItem>
                  )}
                  
                  {permissions.canRemoveDestinations && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => onRemove?.(item.id)}
                        className="text-red-600 dark:text-red-400"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Expand Toggle */}
              {displayMode !== 'compact' && (
                <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>
              )}
            </div>
          </div>
          
          {/* Satisfaction Indicator */}
          {showPreferences && userPreference && displayMode !== 'compact' && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "h-3 w-3",
                      star <= userPreference.rating 
                        ? "text-yellow-400 fill-current" 
                        : "text-gray-300"
                    )}
                  />
                ))}
              </div>
              <div className="flex-1">
                <Progress 
                  value={currentUserSatisfaction * 100} 
                  className="h-1"
                />
              </div>
              <span className="text-xs text-gray-500">
                {Math.round(currentUserSatisfaction * 100)}%
              </span>
            </div>
          )}
          
          {/* Transport Info */}
          {showTransport && item.transportToNext && displayMode !== 'compact' && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              {TransportIcon && <TransportIcon className="h-4 w-4 text-blue-500" />}
              <span className="flex items-center gap-1">
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {formatDuration(item.transportToNext.duration)}
                </span>
                <span>to next destination</span>
                {item.transportToNext.distance && (
                  <>
                    <span>·</span>
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                      {(item.transportToNext.distance / 1000).toFixed(1)}km
                    </span>
                  </>
                )}
              </span>
            </div>
          )}
          
          {/* Time Adjustment Slider */}
          {isEditingTime && permissions.canAdjustTimes && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Visit Duration</span>
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {formatDurationExtended(tempTimeValue)}
                </span>
              </div>
              <Slider
                value={[tempTimeValue]}
                onValueChange={handleTimeAdjustment}
                min={15}
                max={4320} // 3 days like in add-place-form
                step={15}
                className="mb-2"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>15 minutes</span>
                <span>3 days</span>
              </div>
              <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    Current: {formatDuration(item.allocatedTime)}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                      onClick={() => setTempTimeValue(item.allocatedTime)}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Expanded Content */}
          {displayMode !== 'compact' && (
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleContent className="mt-3 space-y-3">
                {/* User Preferences */}
                {showPreferences && permissions.canViewAllPreferences && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <h4 className="text-sm font-medium mb-2">User Preferences</h4>
                    <div className="space-y-2">
                      {item.interestedUsers.map((user) => (
                        <div key={user.userId} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: user.userColor }}
                            />
                            <span className="text-sm">{user.userName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={cn(
                                    "h-3 w-3",
                                    star <= user.rating 
                                      ? "text-yellow-400 fill-current" 
                                      : "text-gray-300"
                                  )}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-gray-500">
                              ({formatDuration(user.requestedTime)} requested)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Notes */}
                {item.notes.length > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                    <h4 className="text-sm font-medium mb-2">Notes</h4>
                    <div className="space-y-1">
                      {item.notes.map((note, index) => (
                        <p key={index} className="text-sm text-gray-600 dark:text-gray-400">
                          {note}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Tags */}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
      
      {/* Excluded Overlay */}
      {item.isExcluded && (
        <div className="absolute inset-0 bg-red-500/10 border-2 border-red-300 dark:border-red-700 rounded-lg flex items-center justify-center">
          <div className="bg-red-50 dark:bg-red-900/50 px-3 py-1 rounded-full shadow-sm border border-red-200 dark:border-red-800">
            <span className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-1">
              <EyeOff className="h-3 w-3" />
              Excluded from trip
            </span>
          </div>
        </div>
      )}
      
      {/* Being Edited Indicator */}
      {item.isBeingEdited && (
        <div className="absolute top-2 right-2">
          <div className="flex items-center gap-1 bg-blue-500 text-white px-2 py-1 rounded-full text-xs">
            <Edit className="h-3 w-3" />
            <span>Editing</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default InteractiveListItem