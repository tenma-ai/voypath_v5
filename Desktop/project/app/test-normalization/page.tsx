'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { normalizePreferences, analyzeNormalizationQuality } from '@/lib/optimization/z-score-normalization'
import { clusterDestinations, calculateHaversineDistance, validateClusteringResult } from '@/lib/optimization/geographical-clustering'

export default function TestNormalizationPage() {
  const [results, setResults] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Mock preference data for testing
  const mockPreferences = [
    // User 1 (high rater) - rates everything 7-10
    {
      userId: 'user1',
      sessionId: 'session1',
      destinationId: 'dest1',
      preferenceScore: 9,
      preferredDuration: 3,
      userDisplayName: 'Alice',
      userColor: '#ff6b6b'
    },
    {
      userId: 'user1',
      sessionId: 'session1',
      destinationId: 'dest2',
      preferenceScore: 8,
      preferredDuration: 2,
      userDisplayName: 'Alice',
      userColor: '#ff6b6b'
    },
    {
      userId: 'user1',
      sessionId: 'session1',
      destinationId: 'dest3',
      preferenceScore: 10,
      preferredDuration: 4,
      userDisplayName: 'Alice',
      userColor: '#ff6b6b'
    },
    
    // User 2 (low rater) - rates everything 1-4
    {
      userId: 'user2',
      sessionId: 'session2',
      destinationId: 'dest1',
      preferenceScore: 3,
      preferredDuration: 1,
      userDisplayName: 'Bob',
      userColor: '#4ecdc4'
    },
    {
      userId: 'user2',
      sessionId: 'session2',
      destinationId: 'dest2',
      preferenceScore: 2,
      preferredDuration: 2,
      userDisplayName: 'Bob',
      userColor: '#4ecdc4'
    },
    {
      userId: 'user2',
      sessionId: 'session2',
      destinationId: 'dest3',
      preferenceScore: 4,
      preferredDuration: 3,
      userDisplayName: 'Bob',
      userColor: '#4ecdc4'
    },
    
    // User 3 (moderate rater) - rates 5-6 consistently
    {
      userId: 'user3',
      sessionId: 'session3',
      destinationId: 'dest1',
      preferenceScore: 5,
      preferredDuration: 2,
      userDisplayName: 'Charlie',
      userColor: '#45b7d1'
    },
    {
      userId: 'user3',
      sessionId: 'session3',
      destinationId: 'dest2',
      preferenceScore: 6,
      preferredDuration: 3,
      userDisplayName: 'Charlie',
      userColor: '#45b7d1'
    }
  ]

  // Mock destination data for clustering
  const mockDestinations = [
    {
      id: 'dest1',
      name: 'Tokyo Tower',
      latitude: 35.6586,
      longitude: 139.7454,
      address: 'Minato City, Tokyo'
    },
    {
      id: 'dest2', 
      name: 'Senso-ji Temple',
      latitude: 35.7148,
      longitude: 139.7967,
      address: 'Asakusa, Tokyo'
    },
    {
      id: 'dest3',
      name: 'Mount Fuji',
      latitude: 35.3606,
      longitude: 138.7274,
      address: 'Fujinomiya, Shizuoka'
    },
    {
      id: 'dest4',
      name: 'Shibuya Crossing',
      latitude: 35.6598,
      longitude: 139.7006,
      address: 'Shibuya, Tokyo'
    }
  ]

  const runTests = async () => {
    setIsLoading(true)
    
    try {
      const testResults: any = {
        normalization: null,
        clustering: null,
        distances: null,
        errors: []
      }

      // Test 1: Z-Score Normalization
      try {
        const normalizationResult = normalizePreferences(mockPreferences)
        const qualityAnalysis = analyzeNormalizationQuality(normalizationResult)
        
        testResults.normalization = {
          success: true,
          preferences: normalizationResult.standardizedPreferences.length,
          users: normalizationResult.userStatistics.size,
          warnings: normalizationResult.warnings,
          quality: qualityAnalysis
        }
      } catch (error) {
        testResults.errors.push(`Normalization: ${(error as Error).message}`)
      }

      // Test 2: Geographical Clustering
      try {
        const normalizationResult = normalizePreferences(mockPreferences)
        const clusteringResult = clusterDestinations(
          mockDestinations as any,
          normalizationResult.standardizedPreferences,
          { maxClusterRadius: 30 }
        )
        
        const validation = validateClusteringResult(clusteringResult)
        
        testResults.clustering = {
          success: true,
          clusters: clusteringResult.clusters.length,
          clusterDetails: clusteringResult.clusters.map(cluster => ({
            id: cluster.id.slice(0, 8),
            center: `${cluster.centerLocation.latitude.toFixed(4)}, ${cluster.centerLocation.longitude.toFixed(4)}`,
            desirability: cluster.totalDesirability.toFixed(3),
            stayTime: cluster.averageStayTime.toFixed(1),
            destinations: cluster.destinations.map(d => (d as any).name)
          })),
          analysis: clusteringResult.analysis,
          validation
        }
      } catch (error) {
        testResults.errors.push(`Clustering: ${(error as Error).message}`)
      }

      // Test 3: Distance Calculations
      try {
        const tokyoTower = { lat: 35.6586, lon: 139.7454 }
        const sensoji = { lat: 35.7148, lon: 139.7967 }
        const mountFuji = { lat: 35.3606, lon: 138.7274 }
        
        const distanceTokyoSensoji = calculateHaversineDistance(
          tokyoTower.lat, tokyoTower.lon,
          sensoji.lat, sensoji.lon
        )
        
        const distanceTokyoFuji = calculateHaversineDistance(
          tokyoTower.lat, tokyoTower.lon,
          mountFuji.lat, mountFuji.lon
        )
        
        testResults.distances = {
          success: true,
          tokyoSensoji: distanceTokyoSensoji.toFixed(2),
          tokyoFuji: distanceTokyoFuji.toFixed(2),
          validationTokyoSensoji: distanceTokyoSensoji > 5 && distanceTokyoSensoji < 15,
          validationTokyoFuji: distanceTokyoFuji > 80 && distanceTokyoFuji < 120
        }
      } catch (error) {
        testResults.errors.push(`Distance calculation: ${(error as Error).message}`)
      }

      setResults(testResults)
    } catch (error) {
      setResults({
        error: `General test error: ${(error as Error).message}`
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">🧪 Normalization & Clustering Tests</h1>
        <Button 
          onClick={runTests} 
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isLoading ? 'Running Tests...' : 'Run Tests'}
        </Button>
      </div>

      {results && (
        <div className="space-y-6">
          {/* Error Summary */}
          {results.errors && results.errors.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">❌ Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 space-y-1">
                  {results.errors.map((error: string, index: number) => (
                    <li key={index} className="text-red-600">{error}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Normalization Results */}
          {results.normalization && (
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">📊 Z-Score Normalization</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p><strong>Preferences Processed:</strong> {results.normalization.preferences}</p>
                    <p><strong>Unique Users:</strong> {results.normalization.users}</p>
                    <p><strong>Quality Valid:</strong> {results.normalization.quality.isValid ? '✅' : '❌'}</p>
                  </div>
                  <div>
                    <p><strong>Mean of Means:</strong> {results.normalization.quality.statistics.meanOfMeans.toFixed(3)}</p>
                    <p><strong>Single Rating Users:</strong> {results.normalization.quality.statistics.usersWithSingleRating}</p>
                    <p><strong>Identical Rating Users:</strong> {results.normalization.quality.statistics.usersWithIdenticalRatings}</p>
                  </div>
                </div>
                
                {results.normalization.warnings.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-orange-600">⚠️ Warnings:</h4>
                    <ul className="list-disc pl-5 text-sm">
                      {results.normalization.warnings.map((warning: string, index: number) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {results.normalization.quality.issues.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-red-600">❌ Quality Issues:</h4>
                    <ul className="list-disc pl-5 text-sm">
                      {results.normalization.quality.issues.map((issue: string, index: number) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Clustering Results */}
          {results.clustering && (
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">🗺️ Geographical Clustering</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p><strong>Total Clusters:</strong> {results.clustering.clusters}</p>
                    <p><strong>Avg Cluster Size:</strong> {results.clustering.analysis.averageClusterSize.toFixed(1)}</p>
                    <p><strong>Validation:</strong> {results.clustering.validation.isValid ? '✅' : '❌'}</p>
                  </div>
                  <div>
                    <p><strong>Isolated Destinations:</strong> {results.clustering.analysis.isolatedDestinations.length}</p>
                  </div>
                </div>

                {results.clustering.clusterDetails.map((cluster: any, index: number) => (
                  <div key={index} className="border rounded p-3 bg-gray-50">
                    <h4 className="font-semibold">📍 Cluster {index + 1} (ID: {cluster.id}...)</h4>
                    <p><strong>Center:</strong> {cluster.center}</p>
                    <p><strong>Desirability:</strong> {cluster.desirability}</p>
                    <p><strong>Avg Stay Time:</strong> {cluster.stayTime} hours</p>
                    <p><strong>Destinations:</strong> {cluster.destinations.join(', ')}</p>
                  </div>
                ))}

                {results.clustering.validation.issues.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-red-600">❌ Validation Issues:</h4>
                    <ul className="list-disc pl-5 text-sm">
                      {results.clustering.validation.issues.map((issue: string, index: number) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Distance Calculations */}
          {results.distances && (
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">📏 Distance Calculations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p>
                    <strong>Tokyo Tower ↔ Senso-ji Temple:</strong> {results.distances.tokyoSensoji} km 
                    {results.distances.validationTokyoSensoji ? ' ✅' : ' ⚠️'}
                  </p>
                  <p>
                    <strong>Tokyo Tower ↔ Mount Fuji:</strong> {results.distances.tokyoFuji} km 
                    {results.distances.validationTokyoFuji ? ' ✅' : ' ⚠️'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}