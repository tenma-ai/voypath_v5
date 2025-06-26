// Main integration module for Z-Score normalization and geographical clustering

import type { PreprocessedData } from './types'
import type {
  NormalizationResult,
  ClusteringResult,
  TimeConstraints
} from './normalization-types'
import { normalizePreferences, analyzeNormalizationQuality } from './z-score-normalization'
import { 
  clusterDestinations, 
  findOptimalClusterOrder,
  validateClusteringResult 
} from './geographical-clustering'
import { 
  processTimeConstraints,
  validateTimeConstraints,
  suggestEndDate,
  filterClustersForTimeConstraints
} from './time-constraints'

// Main result interface
export interface NormalizedClusteredData {
  normalization: NormalizationResult
  clustering: ClusteringResult
  timeConstraints: TimeConstraints
  validation: {
    isValid: boolean
    issues: string[]
    warnings: string[]
  }
  summary: {
    totalUsers: number
    totalDestinations: number
    totalClusters: number
    totalRequiredDays: number
    feasibleWithinConstraints: boolean
  }
}

/**
 * Main function to normalize preferences and cluster destinations
 * This is the primary interface for the optimization algorithm
 */
export async function normalizeAndClusterData(
  preprocessedData: PreprocessedData
): Promise<NormalizedClusteredData> {
  const issues: string[] = []
  const warnings: string[] = []
  
  try {
    // Step 1: Normalize user preferences
    console.log('Starting Z-score normalization...')
    const normalization = normalizePreferences(preprocessedData.preferences)
    
    // Validate normalization
    const normQuality = analyzeNormalizationQuality(normalization)
    if (!normQuality.isValid) {
      issues.push(...normQuality.issues)
    }
    warnings.push(...normalization.warnings)
    
    // Step 2: Get all destinations (combine destinations and places if both exist)
    const allDestinations = Array.from(preprocessedData.destinations.values())
      .map(loc => ({
        id: loc.id,
        name: loc.name,
        address: loc.address || null, // Convert undefined to null
        latitude: loc.latitude,
        longitude: loc.longitude,
        place_id: null,
        group_id: preprocessedData.groupId,
        created_by: null,
        created_at: new Date().toISOString()
      }))
    
    // Step 3: Cluster destinations geographically
    console.log('Starting geographical clustering...')
    const clustering = clusterDestinations(
      allDestinations,
      normalization.standardizedPreferences,
      {
        maxClusterRadius: 50, // 50km radius
        minClusterSize: 1,
        distanceCalculation: 'haversine'
      }
    )
    
    // Validate clustering
    const clusterValidation = validateClusteringResult(clustering)
    if (!clusterValidation.isValid) {
      issues.push(...clusterValidation.issues)
    }
    
    // Step 4: Process time constraints
    console.log('Processing time constraints...')
    // Convert tripDuration to a TripGroups-compatible object for time constraints
    const tripGroupForConstraints = {
      start_date: preprocessedData.tripDuration.startDate?.toISOString() || null,
      end_date: preprocessedData.tripDuration.endDate?.toISOString() || null,
      auto_calculate_end_date: preprocessedData.tripDuration.autoCalculate
    } as any; // Use 'as any' since we only need these specific fields
    const timeConstraints = processTimeConstraints(tripGroupForConstraints)
    
    // Step 5: Optimize cluster order
    const orderedClusters = findOptimalClusterOrder(
      preprocessedData.departureLocation,
      clustering.clusters,
      preprocessedData.returnLocation || undefined
    )
    
    // Update clustering result with ordered clusters
    clustering.clusters = orderedClusters
    
    // Step 6: Validate time constraints
    const timeValidation = validateTimeConstraints(orderedClusters, timeConstraints)
    
    let finalClusters = orderedClusters
    let removedClusters: any[] = []
    
    if (!timeValidation.isValid) {
      warnings.push(...timeValidation.issues)
      
      // Filter clusters if in fixed mode and exceeding constraints
      if (timeConstraints.mode === 'fixed') {
        const filtered = filterClustersForTimeConstraints(orderedClusters, timeConstraints)
        finalClusters = filtered.filteredClusters
        removedClusters = filtered.removedClusters
        
        if (removedClusters.length > 0) {
          warnings.push(
            `Removed ${removedClusters.length} destinations to fit within time constraints`
          )
        }
      }
    }
    
    // Update clustering with final clusters
    clustering.clusters = finalClusters
    
    // Step 7: Calculate summary statistics
    const summary = {
      totalUsers: preprocessedData.groupMembers.size,
      totalDestinations: allDestinations.length,
      totalClusters: finalClusters.length,
      totalRequiredDays: timeValidation.requiredDays,
      feasibleWithinConstraints: timeValidation.isValid || timeConstraints.mode === 'auto'
    }
    
    // Log summary
    console.log('Normalization and clustering complete:', {
      users: summary.totalUsers,
      destinations: summary.totalDestinations,
      clusters: summary.totalClusters,
      days: summary.totalRequiredDays,
      feasible: summary.feasibleWithinConstraints
    })
    
    return {
      normalization,
      clustering,
      timeConstraints,
      validation: {
        isValid: issues.length === 0,
        issues,
        warnings
      },
      summary
    }
  } catch (error) {
    console.error('Error in normalizeAndClusterData:', error)
    issues.push(error instanceof Error ? error.message : 'Unknown error occurred')
    
    return {
      normalization: {
        standardizedPreferences: [],
        userStatistics: new Map(),
        warnings: []
      },
      clustering: {
        clusters: [],
        analysis: {
          clusters: [],
          totalClusters: 0,
          averageClusterSize: 0,
          isolatedDestinations: []
        },
        distanceMatrix: new Map()
      },
      timeConstraints: {
        mode: 'auto',
        startDate: new Date(),
        dailyHours: 9
      },
      validation: {
        isValid: false,
        issues,
        warnings
      },
      summary: {
        totalUsers: 0,
        totalDestinations: 0,
        totalClusters: 0,
        totalRequiredDays: 0,
        feasibleWithinConstraints: false
      }
    }
  }
}

/**
 * Generate human-readable summary of results
 */
export function generateOptimizationSummary(
  result: NormalizedClusteredData
): string {
  const { summary, timeConstraints, clustering } = result
  
  let summaryText = `## Trip Optimization Summary\n\n`
  summaryText += `- **Participants**: ${summary.totalUsers} people\n`
  summaryText += `- **Destinations**: ${summary.totalDestinations} places\n`
  summaryText += `- **Clusters**: ${summary.totalClusters} geographical areas\n`
  summaryText += `- **Duration**: ${summary.totalRequiredDays} days\n`
  summaryText += `- **Mode**: ${timeConstraints.mode === 'auto' ? 'Auto-calculate dates' : 'Fixed date range'}\n`
  
  if (timeConstraints.mode === 'fixed' && timeConstraints.startDate && timeConstraints.endDate) {
    summaryText += `- **Date Range**: ${timeConstraints.startDate.toDateString()} - ${timeConstraints.endDate.toDateString()}\n`
  }
  
  summaryText += `\n### Geographical Clusters\n\n`
  
  clustering.clusters.forEach((cluster, index) => {
    summaryText += `${index + 1}. **${cluster.destinations[0].name}**`
    if (cluster.destinations.length > 1) {
      summaryText += ` (+ ${cluster.destinations.length - 1} nearby)`
    }
    summaryText += `\n`
    summaryText += `   - Desirability: ${cluster.totalDesirability.toFixed(2)}\n`
    summaryText += `   - Stay time: ${cluster.averageStayTime} hours\n`
  })
  
  if (result.validation.warnings.length > 0) {
    summaryText += `\n### Warnings\n\n`
    result.validation.warnings.forEach(warning => {
      summaryText += `- ${warning}\n`
    })
  }
  
  return summaryText
}

// Re-export key functions for convenience
export { 
  normalizePreferences
} from './z-score-normalization'
export { 
  clusterDestinations,
  calculateHaversineDistance 
} from './geographical-clustering'
export { 
  processTimeConstraints 
} from './time-constraints'
export type {
  NormalizationResult,
  ClusteringResult,
  TimeConstraints,
  StandardizedPreference,
  DestinationCluster
} from './normalization-types'