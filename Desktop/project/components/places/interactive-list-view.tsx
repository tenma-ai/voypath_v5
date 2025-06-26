'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Search,
  Filter,
  SortAsc,
  List,
  Grid,
  Eye,
  EyeOff,
  Lightbulb,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  Undo2,
  RefreshCw,
  Settings,
  Plus,
  BarChart3
} from 'lucide-react'
import { InteractiveListItem } from './interactive-list-item'
import type { 
  InteractiveListItem as IListItem,
  EditingPermissions,
  ListViewConfig,
  OptimizationSuggestion,
  CollaborativeChange,
  ReorderImpact,
  UserContext
} from '@/lib/types/interactive-list'
import { 
  calculateReorderImpact,
  generateOptimizationSuggestions,
  calculateUserPermissions,
  formatDuration
} from '@/lib/utils/interactive-list-utils'

// Sortable wrapper for list items
function SortableListItem(props: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <InteractiveListItem
        {...props}
        isBeingDragged={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

interface InteractiveListViewProps {
  items: IListItem[]
  userContext: UserContext
  groupSettings: any // GroupSettings from your type
  isLoading?: boolean
  
  // Callbacks
  onReorder?: (oldIndex: number, newIndex: number) => void
  onTimeAdjust?: (itemId: string, newTime: number) => void
  onExclude?: (itemId: string, reason?: string) => void
  onInclude?: (itemId: string) => void
  onRemove?: (itemId: string) => void
  onEdit?: (itemId: string) => void
  onApplySuggestion?: (suggestionId: string) => void
  onBulkOperation?: (operation: string, itemIds: string[]) => void
  
  className?: string
}

export function InteractiveListView({
  items,
  userContext,
  groupSettings,
  isLoading = false,
  onReorder,
  onTimeAdjust,
  onExclude,
  onInclude,
  onRemove,
  onEdit,
  onApplySuggestion,
  onBulkOperation,
  className
}: InteractiveListViewProps) {
  // State management
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [draggedItem, setDraggedItem] = useState<IListItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterBy, setFilterBy] = useState<'all' | 'excluded' | 'included' | 'high-satisfaction'>('all')
  const [sortBy, setSortBy] = useState<'order' | 'time' | 'satisfaction' | 'alphabetical'>('order')
  const [activeTab, setActiveTab] = useState<'list' | 'suggestions' | 'stats'>('list')
  
  // Configuration
  const [config, setConfig] = useState<ListViewConfig>({
    displayMode: 'standard',
    showPreferences: true,
    showTransport: true,
    showSuggestions: true,
    showExcluded: false,
    groupByDay: false,
    sortBy: 'order',
    enableDragDrop: true,
    enableInlineEditing: true,
    enableBulkOperations: true,
    highlightChanges: true,
    showAnimations: true,
    compactOnMobile: true
  })
  
  // Calculate permissions
  const permissions = useMemo(() => 
    calculateUserPermissions(userContext, groupSettings),
    [userContext, groupSettings]
  )
  
  // Generate suggestions
  const suggestions = useMemo(() => 
    generateOptimizationSuggestions(items.filter(item => !item.isExcluded)),
    [items]
  )
  
  // Filter and sort items
  const processedItems = useMemo(() => {
    let filtered = items
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.address.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Apply status filter
    switch (filterBy) {
      case 'excluded':
        filtered = filtered.filter(item => item.isExcluded)
        break
      case 'included':
        filtered = filtered.filter(item => !item.isExcluded)
        break
      case 'high-satisfaction':
        filtered = filtered.filter(item => item.satisfactionScore > 0.8)
        break
      default:
        // Show all unless explicitly hiding excluded
        if (!config.showExcluded) {
          filtered = filtered.filter(item => !item.isExcluded)
        }
    }
    
    // Apply sorting
    switch (sortBy) {
      case 'time':
        return [...filtered].sort((a, b) => b.allocatedTime - a.allocatedTime)
      case 'satisfaction':
        return [...filtered].sort((a, b) => b.satisfactionScore - a.satisfactionScore)
      case 'alphabetical':
        return [...filtered].sort((a, b) => a.name.localeCompare(b.name))
      default:
        return [...filtered].sort((a, b) => a.visitOrder - b.visitOrder)
    }
  }, [items, searchQuery, filterBy, sortBy, config.showExcluded])
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
        delay: 200
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8
      }
    })
  )
  
  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const draggedItem = items.find(item => item.id === event.active.id)
    setDraggedItem(draggedItem || null)
  }, [items])
  
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(item => item.id === active.id)
      const newIndex = items.findIndex(item => item.id === over.id)
      
      // Calculate reorder impact
      const newOrder = [...items]
      const [movedItem] = newOrder.splice(oldIndex, 1)
      newOrder.splice(newIndex, 0, movedItem)
      
      const impact = calculateReorderImpact(items, newOrder)
      
      // Show impact and get confirmation if needed
      if (impact.recommendation === 'reject') {
        // Could show a confirmation dialog
        console.warn('Reorder not recommended:', impact.reasons)
        return
      }
      
      onReorder?.(oldIndex, newIndex)
    }
    
    setDraggedItem(null)
  }, [items, onReorder])
  
  // Item selection
  const handleItemSelect = useCallback((itemId: string) => {
    if (config.enableBulkOperations) {
      setSelectedItems(prev => {
        const newSet = new Set(prev)
        if (newSet.has(itemId)) {
          newSet.delete(itemId)
        } else {
          newSet.add(itemId)
        }
        return newSet
      })
    }
  }, [config.enableBulkOperations])
  
  // Bulk operations
  const handleBulkExclude = () => {
    if (selectedItems.size > 0) {
      onBulkOperation?.('exclude_multiple', Array.from(selectedItems))
      setSelectedItems(new Set())
    }
  }
  
  const handleBulkInclude = () => {
    if (selectedItems.size > 0) {
      onBulkOperation?.('include_multiple', Array.from(selectedItems))
      setSelectedItems(new Set())
    }
  }
  
  // Statistics calculation
  const stats = useMemo(() => {
    const included = items.filter(item => !item.isExcluded)
    const excluded = items.filter(item => item.isExcluded)
    const totalTime = included.reduce((sum, item) => sum + item.allocatedTime, 0)
    const avgSatisfaction = included.reduce((sum, item) => sum + item.satisfactionScore, 0) / included.length
    
    return {
      totalItems: items.length,
      includedItems: included.length,
      excludedItems: excluded.length,
      totalTime,
      avgSatisfaction,
      totalUsers: new Set(items.flatMap(item => item.interestedUsers.map(u => u.userId))).size
    }
  }, [items])
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="space-y-2 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-sm text-gray-500">Loading destinations...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header and Controls */}
      <div className="space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search destinations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={filterBy} onValueChange={(value: any) => setFilterBy(value)}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="included">Included</SelectItem>
                <SelectItem value="excluded">Excluded</SelectItem>
                <SelectItem value="high-satisfaction">High Rating</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-[120px]">
                <SortAsc className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="order">Order</SelectItem>
                <SelectItem value="time">Time</SelectItem>
                <SelectItem value="satisfaction">Rating</SelectItem>
                <SelectItem value="alphabetical">A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Bulk Actions */}
        {selectedItems.size > 0 && config.enableBulkOperations && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <span className="text-sm font-medium">
              {selectedItems.size} selected
            </span>
            <div className="flex gap-2 ml-auto">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleBulkExclude}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <EyeOff className="h-4 w-4 mr-2" />
                Exclude from trip
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleBulkInclude}
                className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
              >
                <Eye className="h-4 w-4 mr-2" />
                Include in trip
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setSelectedItems(new Set())}
                className="hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Clear selection
              </Button>
            </div>
          </div>
        )}
        
        {/* View Options */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="show-excluded"
                checked={config.showExcluded}
                onCheckedChange={(checked) => 
                  setConfig(prev => ({ ...prev, showExcluded: checked }))
                }
              />
              <Label htmlFor="show-excluded" className="text-sm">
                Show excluded
              </Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                id="show-preferences"
                checked={config.showPreferences}
                onCheckedChange={(checked) => 
                  setConfig(prev => ({ ...prev, showPreferences: checked }))
                }
              />
              <Label htmlFor="show-preferences" className="text-sm">
                Show preferences
              </Label>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(stats.totalTime)}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {stats.totalUsers}
            </Badge>
          </div>
        </div>
      </div>
      
      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list" className="gap-2">
            <List className="h-4 w-4" />
            Destinations ({stats.includedItems})
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            Suggestions ({suggestions.length})
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Statistics
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="list" className="mt-4">
          {processedItems.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <List className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No destinations found
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-center mb-4">
                  {searchQuery ? 'Try adjusting your search terms' : 'Add some destinations to get started'}
                </p>
                {!searchQuery && (
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Destination
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={processedItems.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {processedItems.map((item) => (
                    <SortableListItem
                      key={item.id}
                      item={item}
                      permissions={permissions}
                      currentUserId={userContext.id}
                      isSelected={selectedItems.has(item.id)}
                      displayMode={config.displayMode}
                      showPreferences={config.showPreferences}
                      showTransport={config.showTransport}
                      onSelect={handleItemSelect}
                      onTimeAdjust={onTimeAdjust}
                      onExclude={onExclude}
                      onInclude={onInclude}
                      onEdit={onEdit}
                      onRemove={onRemove}
                    />
                  ))}
                </div>
              </SortableContext>
              
              <DragOverlay>
                {draggedItem && (
                  <InteractiveListItem
                    item={draggedItem}
                    permissions={permissions}
                    currentUserId={userContext.id}
                    displayMode={config.displayMode}
                    showPreferences={config.showPreferences}
                    showTransport={config.showTransport}
                    className="rotate-2 shadow-2xl"
                  />
                )}
              </DragOverlay>
            </DndContext>
          )}
        </TabsContent>
        
        <TabsContent value="suggestions" className="mt-4">
          <div className="space-y-3">
            {suggestions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    All optimized!
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-center">
                    Your itinerary looks well optimized. No suggestions at this time.
                  </p>
                </CardContent>
              </Card>
            ) : (
              suggestions.map((suggestion) => (
                <Card key={suggestion.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base">{suggestion.title}</CardTitle>
                        <CardDescription>{suggestion.description}</CardDescription>
                      </div>
                      <Badge 
                        variant={suggestion.priority === 'high' ? 'destructive' : 
                               suggestion.priority === 'medium' ? 'default' : 'secondary'}
                      >
                        {suggestion.priority}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                        {suggestion.impact.timeSaving > 0 && (
                          <span>⏱️ {suggestion.impact.timeSaving.toFixed(1)}h saved</span>
                        )}
                        {suggestion.impact.distanceReduction > 0 && (
                          <span>📍 {suggestion.impact.distanceReduction.toFixed(1)}km less</span>
                        )}
                        <span>📈 {Math.round(suggestion.confidence * 100)}% confidence</span>
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => onApplySuggestion?.(suggestion.id)}
                        disabled={suggestion.requiresApproval && !permissions.canAdjustTimes}
                      >
                        Apply
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="stats" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Destinations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalItems}</div>
                <p className="text-xs text-gray-500">
                  {stats.includedItems} included, {stats.excludedItems} excluded
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatDuration(stats.totalTime)}</div>
                <p className="text-xs text-gray-500">
                  Average {formatDuration(stats.totalTime / Math.max(stats.includedItems, 1))} per destination
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round((stats.avgSatisfaction || 0) * 100)}%
                </div>
                <p className="text-xs text-gray-500">
                  Average user satisfaction
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default InteractiveListView