'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Zap,
  Coffee,
  Route,
  DollarSign,
  Heart,
  Info,
  Play,
  Pause
} from 'lucide-react'
import type { 
  OptimizationSuggestion, 
  InteractiveListItem,
  ReorderImpact 
} from '@/lib/types/interactive-list'
import { formatDuration } from '@/lib/utils/interactive-list-utils'

interface OptimizationSuggestionsProps {
  suggestions: OptimizationSuggestion[]
  items: InteractiveListItem[]
  canApply: boolean
  isLoading?: boolean
  
  // Callbacks
  onApplySuggestion?: (suggestionId: string) => void
  onPreviewSuggestion?: (suggestionId: string) => void
  onDismissSuggestion?: (suggestionId: string) => void
  onApplyAll?: () => void
  
  className?: string
}

// Suggestion type icons and colors
const suggestionTypeConfig = {
  reorder: {
    icon: Route,
    color: 'blue',
    label: 'Reorder'
  },
  combine: {
    icon: MapPin,
    color: 'green',
    label: 'Combine'
  },
  time_adjust: {
    icon: Clock,
    color: 'orange',
    label: 'Time Adjustment'
  },
  rest_break: {
    icon: Coffee,
    color: 'purple',
    label: 'Rest Break'
  },
  exclude: {
    icon: TrendingDown,
    color: 'red',
    label: 'Exclude'
  },
  transport_change: {
    icon: ArrowRight,
    color: 'cyan',
    label: 'Transport'
  }
}

// Individual suggestion card component
function SuggestionCard({ 
  suggestion, 
  canApply, 
  onApply, 
  onPreview, 
  onDismiss 
}: {
  suggestion: OptimizationSuggestion
  canApply: boolean
  onApply?: (id: string) => void
  onPreview?: (id: string) => void
  onDismiss?: (id: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  
  const typeConfig = suggestionTypeConfig[suggestion.type]
  const TypeIcon = typeConfig.icon
  
  const getImpactColor = (value: number) => {
    if (value > 0.5) return 'text-green-600 dark:text-green-400'
    if (value > 0.2) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-gray-600 dark:text-gray-400'
  }
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive'
      case 'medium': return 'default'
      case 'low': return 'secondary'
      default: return 'outline'
    }
  }
  
  return (
    <Card className="relative overflow-hidden">
      {/* Priority indicator */}
      <div className={cn(
        "absolute top-0 left-0 w-1 h-full",
        suggestion.priority === 'high' && "bg-red-500",
        suggestion.priority === 'medium' && "bg-yellow-500",
        suggestion.priority === 'low' && "bg-blue-500"
      )} />
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              typeConfig.color === 'blue' && "bg-blue-100 dark:bg-blue-900/30",
              typeConfig.color === 'green' && "bg-green-100 dark:bg-green-900/30",
              typeConfig.color === 'orange' && "bg-orange-100 dark:bg-orange-900/30",
              typeConfig.color === 'purple' && "bg-purple-100 dark:bg-purple-900/30",
              typeConfig.color === 'red' && "bg-red-100 dark:bg-red-900/30",
              typeConfig.color === 'cyan' && "bg-cyan-100 dark:bg-cyan-900/30"
            )}>
              <TypeIcon className={cn(
                "h-5 w-5",
                typeConfig.color === 'blue' && "text-blue-600 dark:text-blue-400",
                typeConfig.color === 'green' && "text-green-600 dark:text-green-400",
                typeConfig.color === 'orange' && "text-orange-600 dark:text-orange-400",
                typeConfig.color === 'purple' && "text-purple-600 dark:text-purple-400",
                typeConfig.color === 'red' && "text-red-600 dark:text-red-400",
                typeConfig.color === 'cyan' && "text-cyan-600 dark:text-cyan-400"
              )} />
            </div>
            
            <div className="flex-1">
              <CardTitle className="text-base flex items-center gap-2">
                {suggestion.title}
                <Badge variant={getPriorityColor(suggestion.priority) as any} className="text-xs">
                  {suggestion.priority}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                {suggestion.description}
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <div className="text-right">
              <div className="text-xs text-gray-500">Confidence</div>
              <div className="text-sm font-semibold">
                {Math.round(suggestion.confidence * 100)}%
              </div>
            </div>
            <Progress 
              value={suggestion.confidence * 100} 
              className="w-12 h-2 ml-2"
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Impact Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          {suggestion.impact.timeSaving > 0 && (
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
              <div className={cn("text-sm font-semibold", getImpactColor(suggestion.impact.timeSaving))}>
                +{suggestion.impact.timeSaving.toFixed(1)}h
              </div>
              <div className="text-xs text-gray-500">Time Saved</div>
            </div>
          )}
          
          {suggestion.impact.distanceReduction > 0 && (
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
              <div className={cn("text-sm font-semibold", getImpactColor(suggestion.impact.distanceReduction / 10))}>
                -{suggestion.impact.distanceReduction.toFixed(1)}km
              </div>
              <div className="text-xs text-gray-500">Distance</div>
            </div>
          )}
          
          {suggestion.impact.satisfactionImprovement > 0 && (
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
              <div className={cn("text-sm font-semibold", getImpactColor(suggestion.impact.satisfactionImprovement))}>
                +{Math.round(suggestion.impact.satisfactionImprovement * 100)}%
              </div>
              <div className="text-xs text-gray-500">Satisfaction</div>
            </div>
          )}
          
          {suggestion.impact.costSaving > 0 && (
            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
              <div className={cn("text-sm font-semibold", getImpactColor(suggestion.impact.costSaving / 50))}>
                ${suggestion.impact.costSaving.toFixed(0)}
              </div>
              <div className="text-xs text-gray-500">Cost Saved</div>
            </div>
          )}
        </div>
        
        {/* Action Required */}
        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                Action Required:
              </div>
              <div className="text-blue-700 dark:text-blue-200">
                {suggestion.actionRequired}
              </div>
            </div>
          </div>
        </div>
        
        {/* Expandable Details */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between p-2 h-auto">
              <span className="text-sm">
                {isExpanded ? 'Hide details' : 'Show details'}
              </span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-3 space-y-3">
            {/* Affected Destinations */}
            {suggestion.affectedDestinations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Affected Destinations:</h4>
                <div className="flex flex-wrap gap-1">
                  {suggestion.affectedDestinations.map((destId) => (
                    <Badge key={destId} variant="outline" className="text-xs">
                      {destId}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Implementation Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Complexity:</span>
                <span className="ml-2 capitalize">{suggestion.implementationComplexity}</span>
              </div>
              <div>
                <span className="text-gray-500">Auto-apply:</span>
                <span className="ml-2">
                  {suggestion.canAutoImplement ? (
                    <span className="text-green-600">Yes</span>
                  ) : (
                    <span className="text-orange-600">Manual</span>
                  )}
                </span>
              </div>
            </div>
            
            {suggestion.requiresApproval && (
              <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <span className="text-sm text-orange-700 dark:text-orange-200">
                  Requires approval from trip admin
                </span>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
        
        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t">
          <div className="flex gap-2">
            {onPreview && (
              <Button variant="outline" size="sm" onClick={() => onPreview(suggestion.id)}>
                <Play className="h-4 w-4 mr-2" />
                Preview
              </Button>
            )}
            
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={() => onDismiss(suggestion.id)}>
                Dismiss
              </Button>
            )}
          </div>
          
          <div>
            {suggestion.requiresApproval && !canApply ? (
              <Button size="sm" disabled>
                Approval Required
              </Button>
            ) : suggestion.canAutoImplement ? (
              <Button 
                size="sm" 
                onClick={() => onApply?.(suggestion.id)}
                className="bg-green-600 hover:bg-green-700"
              >
                <Zap className="h-4 w-4 mr-2" />
                Auto Apply
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm">
                    Apply
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Apply Suggestion</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will modify your itinerary: {suggestion.actionRequired}
                      {suggestion.implementationComplexity === 'complex' && 
                        ' This is a complex change that may have wide-reaching effects.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onApply?.(suggestion.id)}>
                      Apply Changes
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function OptimizationSuggestions({
  suggestions,
  items,
  canApply,
  isLoading = false,
  onApplySuggestion,
  onPreviewSuggestion,
  onDismissSuggestion,
  onApplyAll,
  className
}: OptimizationSuggestionsProps) {
  const [filterType, setFilterType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'priority' | 'confidence' | 'impact'>('priority')
  
  // Filter suggestions
  const filteredSuggestions = suggestions.filter(suggestion => {
    if (filterType === 'all') return true
    return suggestion.type === filterType
  })
  
  // Sort suggestions
  const sortedSuggestions = [...filteredSuggestions].sort((a, b) => {
    switch (sortBy) {
      case 'confidence':
        return b.confidence - a.confidence
      case 'impact':
        return (b.impact.efficiencyGain + b.impact.satisfactionImprovement) - 
               (a.impact.efficiencyGain + a.impact.satisfactionImprovement)
      default: // priority
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
    }
  })
  
  // Calculate summary stats
  const stats = {
    totalSuggestions: suggestions.length,
    highPriority: suggestions.filter(s => s.priority === 'high').length,
    autoApplicable: suggestions.filter(s => s.canAutoImplement).length,
    totalTimeSavings: suggestions.reduce((sum, s) => sum + s.impact.timeSaving, 0),
    totalDistanceReduction: suggestions.reduce((sum, s) => sum + s.impact.distanceReduction, 0)
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="space-y-2 text-center">
          <Lightbulb className="h-8 w-8 animate-pulse text-yellow-500 mx-auto" />
          <p className="text-sm text-gray-500">Analyzing your itinerary...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with summary stats */}
      {suggestions.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Optimization Opportunities
              </h3>
            </div>
            
            {stats.autoApplicable > 0 && onApplyAll && (
              <Button size="sm" onClick={onApplyAll} className="gap-2">
                <Zap className="h-4 w-4" />
                Apply All Auto ({stats.autoApplicable})
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {stats.totalSuggestions}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Suggestions
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {stats.highPriority}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                High Priority
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.totalTimeSavings.toFixed(1)}h
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Potential Time Savings
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.totalDistanceReduction.toFixed(1)}km
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Distance Reduction
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Filters and sorting */}
      {suggestions.length > 3 && (
        <div className="flex flex-wrap gap-3">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            <option value="all">All Types</option>
            <option value="reorder">Reorder</option>
            <option value="time_adjust">Time Adjust</option>
            <option value="rest_break">Rest Break</option>
            <option value="exclude">Exclude</option>
          </select>
          
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            <option value="priority">Sort by Priority</option>
            <option value="confidence">Sort by Confidence</option>
            <option value="impact">Sort by Impact</option>
          </select>
        </div>
      )}
      
      {/* Suggestions list */}
      {sortedSuggestions.length === 0 ? (
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
        <div className="space-y-3">
          {sortedSuggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              canApply={canApply}
              onApply={onApplySuggestion}
              onPreview={onPreviewSuggestion}
              onDismiss={onDismissSuggestion}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default OptimizationSuggestions