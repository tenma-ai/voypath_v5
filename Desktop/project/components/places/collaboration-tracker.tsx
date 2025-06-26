'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  User,
  Clock,
  Edit3,
  Eye,
  Undo2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Users,
  MessageCircle,
  Activity,
  History,
  GitCommit,
  Merge,
  X
} from 'lucide-react'
import type { 
  CollaborativeChange,
  UserContext,
  InteractiveListItem
} from '@/lib/types/interactive-list'

interface CollaborationTrackerProps {
  changes: CollaborativeChange[]
  currentUser: UserContext
  activeEditors: ActiveEditor[]
  onRevertChange?: (changeId: string) => void
  onApproveChange?: (changeId: string) => void
  onRejectChange?: (changeId: string) => void
  onMergeConflict?: (changes: CollaborativeChange[]) => void
  className?: string
}

interface ActiveEditor {
  userId: string
  userName: string
  userColor: string
  editingItem?: string
  editingField?: string
  lastActivity: Date
  isOnline: boolean
}

interface ChangeGroup {
  destinationId: string
  destinationName: string
  changes: CollaborativeChange[]
  latestChange: Date
  hasConflicts: boolean
  conflictCount: number
}

const CHANGE_TYPE_ICONS = {
  reorder: <GitCommit className="h-4 w-4" />,
  time_adjust: <Clock className="h-4 w-4" />,
  exclude: <Eye className="h-4 w-4" />,
  include: <CheckCircle2 className="h-4 w-4" />,
  add: <User className="h-4 w-4" />,
  remove: <X className="h-4 w-4" />
} as const

const CHANGE_TYPE_COLORS = {
  reorder: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  time_adjust: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  exclude: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  include: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  add: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  remove: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
} as const

const CHANGE_STATUS_COLORS = {
  pending: 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
  applied: 'border-l-green-500 bg-green-50 dark:bg-green-900/20',
  reverted: 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/20',
  conflicted: 'border-l-red-500 bg-red-50 dark:bg-red-900/20'
} as const

export function CollaborationTracker({
  changes,
  currentUser,
  activeEditors,
  onRevertChange,
  onApproveChange,
  onRejectChange,
  onMergeConflict,
  className
}: CollaborationTrackerProps) {
  const [selectedChange, setSelectedChange] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'timeline' | 'grouped' | 'conflicts'>('timeline')
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Group changes by destination for better organization
  const groupedChanges = React.useMemo(() => {
    const groups: { [key: string]: ChangeGroup } = {}
    
    changes.forEach(change => {
      if (!groups[change.destinationId]) {
        groups[change.destinationId] = {
          destinationId: change.destinationId,
          destinationName: `Destination ${change.destinationId.slice(0, 8)}`, // Would be actual name in real implementation
          changes: [],
          latestChange: change.timestamp,
          hasConflicts: false,
          conflictCount: 0
        }
      }
      
      groups[change.destinationId].changes.push(change)
      
      if (change.timestamp > groups[change.destinationId].latestChange) {
        groups[change.destinationId].latestChange = change.timestamp
      }
      
      if (change.status === 'conflicted') {
        groups[change.destinationId].hasConflicts = true
        groups[change.destinationId].conflictCount++
      }
    })
    
    // Sort groups by latest activity
    return Object.values(groups).sort((a, b) => b.latestChange.getTime() - a.latestChange.getTime())
  }, [changes])

  // Filter changes based on view mode
  const filteredChanges = React.useMemo(() => {
    switch (viewMode) {
      case 'conflicts':
        return changes.filter(change => change.status === 'conflicted')
      case 'grouped':
        return groupedChanges.flatMap(group => group.changes)
      default:
        return [...changes].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    }
  }, [changes, viewMode, groupedChanges])

  // Format time difference
  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
    return `${Math.floor(minutes / 1440)}d ago`
  }

  // Get user initials
  const getUserInitials = (userName: string) => {
    return userName.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  // Format change description
  const formatChangeDescription = (change: CollaborativeChange) => {
    switch (change.changeType) {
      case 'reorder':
        return `Moved from position ${change.oldValue} to ${change.newValue}`
      case 'time_adjust':
        const oldTime = Math.round(change.oldValue / 60)
        const newTime = Math.round(change.newValue / 60)
        return `Changed time from ${oldTime}h to ${newTime}h`
      case 'exclude':
        return 'Excluded from itinerary'
      case 'include':
        return 'Included in itinerary'
      case 'add':
        return 'Added to itinerary'
      case 'remove':
        return 'Removed from itinerary'
      default:
        return 'Made changes'
    }
  }

  // Render active editors
  const renderActiveEditors = () => (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Currently Editing ({activeEditors.filter(e => e.isOnline).length})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {activeEditors.filter(e => e.isOnline).length === 0 ? (
          <p className="text-sm text-gray-500">No one is currently editing</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activeEditors.filter(e => e.isOnline).map(editor => (
              <TooltipProvider key={editor.userId}>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback 
                          className="text-xs" 
                          style={{ backgroundColor: editor.userColor + '20', color: editor.userColor }}
                        >
                          {getUserInitials(editor.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{editor.userName}</span>
                      {editor.editingItem && (
                        <Edit3 className="h-3 w-3 text-gray-400" />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      {editor.editingItem ? 
                        `Editing ${editor.editingField || 'destination'}` : 
                        'Online'
                      }
                      <br />
                      Last active: {formatTimeAgo(editor.lastActivity)}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )

  // Render change item
  const renderChangeItem = (change: CollaborativeChange) => (
    <Card 
      key={change.id}
      className={cn(
        "border-l-4 transition-all duration-200",
        CHANGE_STATUS_COLORS[change.status],
        selectedChange === change.id && "ring-2 ring-blue-500",
        "cursor-pointer hover:shadow-md"
      )}
      onClick={() => setSelectedChange(selectedChange === change.id ? null : change.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <Avatar className="h-8 w-8">
              <AvatarFallback 
                className="text-xs"
                style={{ 
                  backgroundColor: change.userId === currentUser.id ? currentUser.assignedColor + '20' : '#6B7280' + '20',
                  color: change.userId === currentUser.id ? currentUser.assignedColor : '#6B7280'
                }}
              >
                {getUserInitials(change.userName)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm">{change.userName}</span>
                <Badge 
                  variant="secondary" 
                  className={cn("text-xs", CHANGE_TYPE_COLORS[change.changeType])}
                >
                  {CHANGE_TYPE_ICONS[change.changeType]}
                  <span className="ml-1 capitalize">{change.changeType.replace('_', ' ')}</span>
                </Badge>
                <span className="text-xs text-gray-500">{formatTimeAgo(change.timestamp)}</span>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formatChangeDescription(change)}
              </p>
              
              {change.reasoning && (
                <p className="text-xs text-gray-500 mt-1 italic">
                  "{change.reasoning}"
                </p>
              )}
              
              {change.impact.usersAffected.length > 0 && (
                <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                  <Users className="h-3 w-3" />
                  <span>Affects {change.impact.usersAffected.length} users</span>
                  {change.impact.satisfactionChange !== 0 && (
                    <span className={cn(
                      "ml-2",
                      change.impact.satisfactionChange > 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {change.impact.satisfactionChange > 0 ? '+' : ''}{Math.round(change.impact.satisfactionChange * 100)}% satisfaction
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 ml-2">
            {change.status === 'pending' && change.userId !== currentUser.id && (
              <>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onApproveChange?.(change.id)
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRejectChange?.(change.id)
                  }}
                >
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </>
            )}
            
            {change.status === 'applied' && (
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  onRevertChange?.(change.id)
                }}
              >
                <Undo2 className="h-4 w-4 text-gray-500" />
              </Button>
            )}
            
            {change.status === 'conflicted' && (
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            )}
          </div>
        </div>
        
        {/* Expanded details */}
        {selectedChange === change.id && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <strong>Change ID:</strong> {change.id.slice(0, 8)}...
              </div>
              <div>
                <strong>Status:</strong> {change.status}
              </div>
              <div>
                <strong>Time change:</strong> {change.impact.scheduleChange > 0 ? '+' : ''}{change.impact.scheduleChange}min
              </div>
              <div>
                <strong>Users affected:</strong> {change.impact.usersAffected.join(', ')}
              </div>
            </div>
            
            {change.status === 'conflicted' && (
              <Alert className="mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  This change conflicts with other recent changes. Manual resolution may be required.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Collaboration</h3>
          <Badge variant="outline">
            {changes.length} changes
          </Badge>
          {changes.filter(c => c.status === 'conflicted').length > 0 && (
            <Badge variant="destructive">
              {changes.filter(c => c.status === 'conflicted').length} conflicts
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={viewMode === 'timeline' ? 'default' : 'outline'}
            onClick={() => setViewMode('timeline')}
          >
            Timeline
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'grouped' ? 'default' : 'outline'}
            onClick={() => setViewMode('grouped')}
          >
            Grouped
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'conflicts' ? 'default' : 'outline'}
            onClick={() => setViewMode('conflicts')}
          >
            Conflicts
          </Button>
          
          {autoRefresh && (
            <RefreshCw className="h-4 w-4 text-green-500 animate-spin" />
          )}
        </div>
      </div>
      
      {/* Active Editors */}
      {renderActiveEditors()}
      
      {/* Changes List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-3">
          {filteredChanges.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <History className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No changes yet
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-center">
                  {viewMode === 'conflicts' ? 
                    'No conflicts to resolve' : 
                    'Changes will appear here as users edit the itinerary'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            viewMode === 'grouped' ? (
              groupedChanges.map(group => (
                <div key={group.destinationId} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <span>{group.destinationName}</span>
                    <Badge variant="outline" className="text-xs">
                      {group.changes.length} changes
                    </Badge>
                    {group.hasConflicts && (
                      <Badge variant="destructive" className="text-xs">
                        {group.conflictCount} conflicts
                      </Badge>
                    )}
                  </div>
                  {group.changes.map(renderChangeItem)}
                </div>
              ))
            ) : (
              filteredChanges.map(renderChangeItem)
            )
          )}
        </div>
      </ScrollArea>
      
      {/* Conflict Resolution */}
      {changes.filter(c => c.status === 'conflicted').length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            There are {changes.filter(c => c.status === 'conflicted').length} conflicting changes that need resolution.
            <Button 
              size="sm" 
              className="ml-2"
              onClick={() => onMergeConflict?.(changes.filter(c => c.status === 'conflicted'))}
            >
              <Merge className="h-4 w-4 mr-2" />
              Resolve Conflicts
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export default CollaborationTracker