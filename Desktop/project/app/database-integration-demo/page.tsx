'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Database, 
  Zap, 
  Activity, 
  Clock, 
  Users, 
  MapPin, 
  TrendingUp,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
// import { IntegratedRouteManager } from '@/lib/services/integrated-route-manager' // Removed to fix server/client import issue
import { routeDataCache } from '@/lib/services/route-cache'
import { realtimeSyncService } from '@/lib/services/real-time-sync'
import type { StoredRouteData, OptimizationMetrics } from '@/lib/types/route-storage'

// Mock data for demonstration
const mockRouteData: StoredRouteData = {
  status: 'success',
  optimizationMetrics: {
    fairnessScore: 0.87,
    totalDistance: 1250.5,
    totalDuration: 8640, // 144 hours = 6 days
    clusterCount: 3,
    destinationCount: 12,
    averageSatisfaction: 0.85,
    efficiencyScore: 0.92
  },
  multiDaySchedule: {
    days: [
      {
        date: '2025-06-15',
        dayIndex: 0,
        destinations: [
          {
            destinationId: 'dest_1',
            name: 'Tokyo Tower',
            address: 'Minato City, Tokyo, Japan',
            coordinates: { lat: 35.6586, lng: 139.7454 },
            startTime: '09:00',
            endTime: '11:30',
            allocatedDuration: 150,
            visitOrder: 1,
            dayVisitOrder: 1,
            wishfulUsers: [
              {
                userId: 'user_1',
                sessionId: null,
                displayName: 'Alice',
                assignedColor: '#FF5733',
                originalRating: 5,
                standardizedScore: 0.95,
                requestedDuration: 120,
                satisfactionLevel: 'high'
              },
              {
                userId: 'user_2',
                sessionId: null,
                displayName: 'Bob',
                assignedColor: '#3498DB',
                originalRating: 4,
                standardizedScore: 0.80,
                requestedDuration: 180,
                satisfactionLevel: 'medium'
              }
            ],
            transportToNext: {
              mode: 'drive',
              distance: 8.2,
              estimatedTime: 25,
              cost: 15,
              routePath: [
                { lat: 35.6586, lng: 139.7454 },
                { lat: 35.6762, lng: 139.6503 }
              ]
            }
          }
        ],
        accommodationSuggestion: {
          location: { lat: 35.6762, lng: 139.6503 },
          suggestedArea: 'Shibuya District',
          estimatedCost: 12000,
          reasoning: 'Central location with good transport access',
          confidence: 0.85
        },
        dailyStats: {
          totalDistance: 45.2,
          totalTime: 480,
          destinationCount: 4,
          averageSatisfaction: 0.87,
          intensity: 'moderate'
        }
      }
    ],
    totalStats: {
      tripDurationDays: 6,
      totalDestinations: 12,
      totalDistance: 1250.5,
      totalTime: 8640,
      averageDailyDistance: 208.4,
      averageDailyTime: 1440,
      restDayRecommendations: ['Consider a lighter schedule on Day 4']
    }
  },
  visualizationData: {
    mapBounds: {
      north: 35.7000,
      south: 35.6000,
      east: 139.8000,
      west: 139.6000,
      center: { lat: 35.6762, lng: 139.6503 },
      zoom: 11
    },
    colorMappings: {
      'dest_1': {
        primaryColor: '#FF5733',
        userCount: 2,
        popularityTier: 'small_group',
        userColors: ['#FF5733', '#3498DB'],
        blendedColor: '#A855F7'
      }
    },
    routeLines: [
      {
        from: { lat: 35.6586, lng: 139.7454 },
        to: { lat: 35.6762, lng: 139.6503 },
        mode: 'drive',
        color: '#92400E',
        strokeWeight: 3,
        dashPattern: [10, 5]
      }
    ],
    statisticalSummary: {
      walkingDistance: 12.3,
      drivingDistance: 1238.2,
      flyingDistance: 0,
      walkingTime: 148,
      drivingTime: 8492,
      flyingTime: 0,
      accommodationPoints: 6,
      averageDistanceBetweenDestinations: 104.2,
      routeEfficiency: 0.89
    }
  },
  generationInfo: {
    algorithmVersion: 'v2.1.0',
    generatedAt: new Date().toISOString(),
    processingTime: 3.2,
    inputParameters: {
      startDate: '2025-06-15',
      endDate: '2025-06-21',
      departureLocation: 'Tokyo Haneda Airport',
      maxDailyDistance: 300,
      maxDailyTime: 600,
      transportPreferences: ['drive', 'walk']
    },
    userPreferencesSnapshot: [
      {
        userId: 'user_1',
        sessionId: null,
        destinationId: 'dest_1',
        destinationName: 'Tokyo Tower',
        preferenceScore: 5,
        preferredDuration: 120,
        isPersonalFavorite: true,
        timestamp: new Date().toISOString()
      }
    ],
    optimizationConstraints: {
      timeConstraints: [],
      geographicalConstraints: [],
      userRequirements: []
    }
  }
}

const mockMetrics: OptimizationMetrics = {
  fairnessScore: 0.87,
  totalDistance: 1250.5,
  totalDuration: 8640,
  clusterCount: 3,
  destinationCount: 12,
  processingTime: 3.2,
  algorithmVersion: 'v2.1.0',
  userSatisfactionScores: {
    'user_1': 0.95,
    'user_2': 0.80,
    'user_3': 0.85
  },
  routeEfficiency: 0.92,
  accommodationOptimization: 0.88
}

export default function DatabaseIntegrationDemo() {
  // const [routeManager, setRouteManager] = useState<IntegratedRouteManager | null>(null) // Removed to fix server/client import
  const [cacheStats, setCacheStats] = useState<any>({})
  const [connectionStatus, setConnectionStatus] = useState<any>({})
  const [activeUsers, setActiveUsers] = useState<any[]>([])
  const [operations, setOperations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const demoGroupId = 'demo-group-123'
  const demoUserId = 'demo-user-456'

  useEffect(() => {
    // Demo disabled due to server/client import issues
    // Initialize route manager
    // const manager = IntegratedRouteManager.create(
    //   demoGroupId,
    //   demoUserId,
    //   null,
    //   {
    //     onRouteUpdate: (route) => {
    //       addOperation('Route Updated', `Version: ${route.version}`, 'success')
    //     },
    //     onConflict: (conflict) => {
    //       addOperation('Conflict Detected', `Local: ${conflict.local_version}, Server: ${conflict.server_version}`, 'warning')
    //     },
    //     onError: (error) => {
    //       addOperation('Error', error.message, 'error')
    //     }
    //   }
    // )
    
    // setRouteManager(manager)
    // updateStats(manager)

    // return () => {
    //   manager.dispose()
    // }
  }, [])

  const addOperation = (type: string, description: string, status: 'success' | 'error' | 'warning') => {
    setOperations(prev => [{
      id: Date.now(),
      type,
      description,
      status,
      timestamp: new Date().toISOString()
    }, ...prev.slice(0, 9)])
  }

  const updateStats = (manager: any) => {
    setCacheStats(routeDataCache.getStats())
    // setConnectionStatus(manager.getConnectionStatus())
    // setActiveUsers(manager.getActiveUsers())
  }

  const handleSaveRoute = async () => {
    // Demo functionality disabled due to server/client import issues
    addOperation('Demo Disabled', 'Route manager functionality temporarily disabled', 'warning')
    // if (!routeManager) return
    
    // setIsLoading(true)
    // try {
    //   const result = await routeManager.saveOptimizationResult(mockRouteData, mockMetrics)
    //   if (result.success) {
    //     addOperation('Route Saved', `Version: ${result.version}`, 'success')
    //     updateStats(routeManager)
    //   } else {
    //     addOperation('Save Failed', result.error?.message || 'Unknown error', 'error')
    //   }
    // } catch (error) {
    //   addOperation('Save Error', (error as Error).message, 'error')
    // } finally {
    //   setIsLoading(false)
    // }
  }

  const handleLoadRoute = async () => {
    addOperation('Demo Disabled', 'Route manager functionality temporarily disabled', 'warning')
  }

  const handleClearCache = () => {
    routeDataCache.clearAll()
    addOperation('Cache Cleared', 'All cache entries removed', 'success')
    // if (routeManager) updateStats(routeManager)
  }

  const handleReconnect = async () => {
    addOperation('Demo Disabled', 'Route manager functionality temporarily disabled', 'warning')
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Database className="w-8 h-8" />
          Database Integration Demo
        </h1>
        <p className="text-muted-foreground">
          Showcase of JSONB storage, real-time sync, caching, and performance optimization
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 justify-center">
        <Button onClick={handleSaveRoute} disabled={isLoading} className="gap-2">
          <Database className="w-4 h-4" />
          Save Mock Route
        </Button>
        <Button variant="outline" onClick={handleLoadRoute} disabled={isLoading} className="gap-2">
          <Zap className="w-4 h-4" />
          Load Route
        </Button>
        <Button variant="outline" onClick={handleClearCache} className="gap-2">
          <Activity className="w-4 h-4" />
          Clear Cache
        </Button>
        <Button variant="outline" onClick={handleReconnect} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Reconnect
        </Button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cache">Cache Stats</TabsTrigger>
          <TabsTrigger value="realtime">Real-time</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="data">Route Data</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(cacheStats.hitRate * 100).toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  {cacheStats.hits} hits, {cacheStats.misses} misses
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory Entries</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cacheStats.memoryEntries || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Cached route data
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Connection</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {connectionStatus.isConnected ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-red-500" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {connectionStatus.connectionState || 'Unknown'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeUsers.length}</div>
                <p className="text-xs text-muted-foreground">
                  Currently online
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cache Performance</CardTitle>
              <CardDescription>
                Multi-level caching with memory and local storage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Statistics</h4>
                  <ul className="space-y-1 text-sm">
                    <li>Total Requests: {cacheStats.hits + cacheStats.misses}</li>
                    <li>Cache Hits: {cacheStats.hits}</li>
                    <li>Cache Misses: {cacheStats.misses}</li>
                    <li>Invalidations: {cacheStats.invalidations}</li>
                    <li>Errors: {cacheStats.errors}</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Memory Usage</h4>
                  <ul className="space-y-1 text-sm">
                    <li>Memory Entries: {cacheStats.memoryEntries}</li>
                    <li>Hit Rate: {(cacheStats.hitRate * 100).toFixed(2)}%</li>
                    <li>Cache Strategy: Multi-level</li>
                    <li>TTL: 5 minutes (memory), 24 hours (local)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="realtime" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Synchronization</CardTitle>
              <CardDescription>
                Collaborative editing with conflict resolution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={connectionStatus.isConnected ? "default" : "destructive"}>
                  {connectionStatus.isConnected ? "Connected" : "Disconnected"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  State: {connectionStatus.connectionState}
                </span>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Active Users ({activeUsers.length})</h4>
                {activeUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active users</p>
                ) : (
                  <div className="space-y-2">
                    {activeUsers.map((user, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: user.assignedColor }}
                        />
                        <span>{user.displayName}</span>
                        <Badge variant="outline" className="text-xs">
                          {user.isOnline ? 'Online' : 'Offline'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Operations</CardTitle>
              <CardDescription>
                Database operations and real-time events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {operations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No operations yet</p>
              ) : (
                <div className="space-y-3">
                  {operations.map((op) => (
                    <div key={op.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="mt-0.5">
                        {op.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {op.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                        {op.status === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{op.type}</h4>
                          <Badge variant="outline" className="text-xs">
                            {new Date(op.timestamp).toLocaleTimeString()}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{op.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Mock Route Data Structure</CardTitle>
              <CardDescription>
                Example of JSONB stored route data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Optimization Metrics</h4>
                  <ul className="space-y-1 text-sm">
                    <li>Fairness Score: {mockRouteData.optimizationMetrics.fairnessScore}</li>
                    <li>Total Distance: {mockRouteData.optimizationMetrics.totalDistance} km</li>
                    <li>Total Duration: {mockRouteData.optimizationMetrics.totalDuration} min</li>
                    <li>Destinations: {mockRouteData.optimizationMetrics.destinationCount}</li>
                    <li>Clusters: {mockRouteData.optimizationMetrics.clusterCount}</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Trip Statistics</h4>
                  <ul className="space-y-1 text-sm">
                    <li>Duration: {mockRouteData.multiDaySchedule.totalStats.tripDurationDays} days</li>
                    <li>Total Destinations: {mockRouteData.multiDaySchedule.totalStats.totalDestinations}</li>
                    <li>Avg Daily Distance: {mockRouteData.multiDaySchedule.totalStats.averageDailyDistance} km</li>
                    <li>Generated: {new Date(mockRouteData.generationInfo.generatedAt).toLocaleString()}</li>
                    <li>Processing: {mockRouteData.generationInfo.processingTime}s</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-4">
                <h4 className="font-medium mb-2">Sample Day Schedule</h4>
                <div className="text-sm space-y-2">
                  {mockRouteData.multiDaySchedule.days[0].destinations.map((dest, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded border">
                      <MapPin className="h-4 w-4" />
                      <span className="font-medium">{dest.name}</span>
                      <Badge variant="outline">{dest.startTime} - {dest.endTime}</Badge>
                      <span className="text-muted-foreground">
                        {dest.wishfulUsers.length} users interested
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}