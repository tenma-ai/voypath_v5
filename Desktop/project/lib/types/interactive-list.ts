// Types for interactive list visualization with drag-and-drop
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core'

// Editing permissions based on user role and group settings
export interface EditingPermissions {
  canReorderDestinations: boolean    // Drag-and-drop reordering
  canAdjustTimes: boolean           // Time allocation modification
  canRemoveDestinations: boolean    // Exclude/include destinations
  canAddDestinations: boolean       // Add new destinations to list
  canEditPreferences: boolean       // Modify own preference ratings
  canViewAllPreferences: boolean    // See other users' preferences
  canEditSettings: boolean          // Modify trip settings
}

// User role and group context
export interface UserContext {
  id: string
  sessionId: string
  displayName: string
  assignedColor: string
  role: 'admin' | 'member' | 'viewer'
  isCreator: boolean
}

export interface GroupSettings {
  allowOrderChange: 'all' | 'admin_only' | 'specific_members'
  allowDestinationAdd: 'all' | 'admin_only' | 'none'
  allowTimeAdjust: 'all' | 'admin_only' | 'none'
  orderChangeMembers?: string[]
  collaborativeEditing: boolean
  requireApproval: boolean
}

// List item data structure
export interface InteractiveListItem {
  id: string
  placeId: string
  name: string
  address: string
  coordinates: { lat: number; lng: number }
  allocatedTime: number              // Current allocated time in minutes
  visitOrder: number
  scheduledDate?: string
  isExcluded: boolean               // Temporarily excluded from itinerary
  
  // User preferences and context
  interestedUsers: UserPreference[]
  originalPreferences: UserPreferenceBreakdown
  satisfactionScore: number         // 0-1, how well current allocation satisfies users
  
  // Transport and logistics
  transportToNext?: TransportInfo
  estimatedCost?: number
  notes: string[]
  tags: string[]
  
  // Editing state
  isBeingEdited?: boolean
  lastEditedBy?: string
  lastEditedAt?: Date
}

export interface UserPreference {
  userId: string
  userName: string
  userColor: string
  rating: number                    // 1-5 star rating
  requestedTime: number            // Minutes requested
  notes?: string
  priority: 'high' | 'medium' | 'low'
}

export interface UserPreferenceBreakdown {
  users: UserPreference[]
  calculation: {
    method: 'average' | 'weighted' | 'consensus' | 'admin_override'
    reasoning: string
    originalTotal: number           // Sum of all user requests
    compromiseRatio: number         // Current / Original (how much we had to cut)
  }
  alternativeAllocations: number[]  // Other possible time allocations
}

export interface TransportInfo {
  mode: 'walking' | 'driving' | 'transit' | 'flight'
  duration: number                  // Minutes
  distance: number                  // Meters
  cost?: number
  notes?: string
}

// Time adjustment interface
export interface TimeAdjustmentControl {
  currentValue: number
  suggestedRange: [number, number]  // [min, max] based on preferences
  originalPreferences: { [userId: string]: number }
  impactDisplay: {
    scheduleChange: string          // "Ends 30min later"
    nextDestinationDelay: string    // "Next destination delayed"
    satisfactionChange: number      // Change in overall satisfaction
    usersAffected: string[]        // Users whose experience changes
  }
}

// Drag and drop types
export interface DragItem {
  id: string
  type: 'destination'
  index: number
  item: InteractiveListItem
}

export interface DropZone {
  id: string
  index: number
  isActive: boolean
  canAccept: boolean
}

// Optimization suggestions
export interface OptimizationSuggestion {
  id: string
  type: 'reorder' | 'combine' | 'time_adjust' | 'rest_break' | 'exclude' | 'transport_change'
  confidence: number                // 0-1, how confident we are
  priority: 'high' | 'medium' | 'low'
  
  // Impact analysis
  impact: {
    timeSaving: number             // Hours saved
    distanceReduction: number      // km reduced
    costSaving: number            // Money saved
    satisfactionImprovement: number // User satisfaction delta
    efficiencyGain: number        // Overall efficiency improvement
  }
  
  // Details
  title: string
  description: string
  actionRequired: string
  affectedDestinations: string[]
  
  // Implementation
  canAutoImplement: boolean
  implementationComplexity: 'simple' | 'moderate' | 'complex'
  requiresApproval: boolean
}

// Exclusion impact analysis
export interface ExclusionImpact {
  destination: InteractiveListItem
  timeSaved: number
  costSaved: number
  usersAffected: UserPreference[]
  satisfactionChange: { [userId: string]: number }
  routeOptimization: {
    distanceReduced: number
    timeReduced: number
    newTransportOptions: TransportInfo[]
  }
  recommendations: string[]
}

// Change tracking for collaboration
export interface CollaborativeChange {
  id: string
  userId: string
  userName: string
  changeType: 'reorder' | 'time_adjust' | 'exclude' | 'include' | 'add' | 'remove'
  destinationId: string
  oldValue: any
  newValue: any
  timestamp: Date
  reasoning?: string
  impact: {
    usersAffected: string[]
    satisfactionChange: number
    scheduleChange: number          // Minutes added/removed
  }
  status: 'pending' | 'applied' | 'reverted' | 'conflicted'
}

// List view configuration
export interface ListViewConfig {
  displayMode: 'compact' | 'standard' | 'detailed'
  showPreferences: boolean
  showTransport: boolean
  showSuggestions: boolean
  showExcluded: boolean
  groupByDay: boolean
  sortBy: 'order' | 'time' | 'satisfaction' | 'alphabetical'
  
  // Interaction settings
  enableDragDrop: boolean
  enableInlineEditing: boolean
  enableBulkOperations: boolean
  
  // Visual settings
  highlightChanges: boolean
  showAnimations: boolean
  compactOnMobile: boolean
}

// List state management
export interface InteractiveListState {
  items: InteractiveListItem[]
  excludedItems: InteractiveListItem[]
  dragState: {
    isDragging: boolean
    draggedItem?: DragItem
    dropZones: DropZone[]
    ghostPosition?: { x: number; y: number }
  }
  editingState: {
    editingItemId?: string
    editingField?: string
    pendingChanges: CollaborativeChange[]
    lastUpdate: Date
  }
  suggestions: OptimizationSuggestion[]
  config: ListViewConfig
}

// Event handlers
export interface ListEventHandlers {
  onDragStart: (event: DragStartEvent) => void
  onDragOver: (event: DragOverEvent) => void
  onDragEnd: (event: DragEndEvent) => void
  onTimeAdjust: (itemId: string, newTime: number) => void
  onExclude: (itemId: string, reason?: string) => void
  onInclude: (itemId: string) => void
  onPreferenceEdit: (itemId: string, userId: string, newPreference: UserPreference) => void
  onApplySuggestion: (suggestionId: string) => void
  onRevertChange: (changeId: string) => void
}

// Reorder impact calculation
export interface ReorderImpact {
  distanceChange: number            // km difference
  timeChange: number               // minutes difference
  efficiencyImpact: number         // percentage change in efficiency
  satisfactionImpact: number       // change in user satisfaction
  recommendation: 'approve' | 'caution' | 'reject'
  reasons: string[]
  alternativeOrders?: number[][]   // Better ordering suggestions
}

// Bulk operations
export interface BulkOperation {
  type: 'exclude_multiple' | 'adjust_times' | 'reorder_section' | 'apply_template'
  targetItems: string[]
  parameters: any
  preview: {
    affectedUsers: string[]
    totalTimeChange: number
    satisfactionChange: number
    efficiencyChange: number
  }
}