// Main route optimization algorithm

import type { 
  DestinationCluster, 
  StandardizedPreference,
  TimeConstraints
} from './normalization-types'
import type { 
  NormalizedClusteredData
} from './normalization-clustering'
import type { 
  RouteSolution,
  OptimizationConfig,
  OptimizationResult,
  GenerationStrategy,
  AlgorithmStats
} from './algorithm-types'
import type { Location } from './types'
import { calculateFairness } from './fairness-calculator'
import { calculateRouteMetrics, validateRouteFeasibility } from './transport-calculator'
import { 
  nearestNeighborTSP, 
  twoOptImprovement,
  generateRandomRoute,
  generateRouteWithStart,
  calculateTotalDistance
} from './tsp-optimizer'

// Default optimization configuration
const DEFAULT_CONFIG: OptimizationConfig = {
  maxIterations: 50,
  fairnessWeight: 0.6,
  quantityWeight: 0.4,
  earlyTerminationThreshold: 0.95,
  randomExplorations: 15,
  topCandidatesToImprove: 5
}

/**
 * Main optimization function
 * Selects and orders destination clusters to maximize fairness and efficiency
 */
export function optimizeRoute(
  normalizedData: NormalizedClusteredData,
  departureLocation: Location,
  returnLocation: Location | null,
  config: Partial<OptimizationConfig> = {}
): OptimizationResult {
  const startTime = Date.now()
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  
  // Extract data
  const { clusters } = normalizedData.clustering
  const { standardizedPreferences } = normalizedData.normalization
  const { timeConstraints } = normalizedData
  
  // Get all user keys
  const userKeys = new Set(
    standardizedPreferences.map(p => p.userId || p.sessionId || 'unknown')
  )
  
  // Handle edge cases
  if (clusters.length === 0) {
    return createEmptyResult(startTime)
  }
  
  if (clusters.length === 1) {
    return createSingleClusterResult(
      clusters[0],
      departureLocation,
      returnLocation,
      standardizedPreferences,
      userKeys,
      timeConstraints,
      startTime
    )
  }
  
  // Initialize tracking
  const allSolutions: RouteSolution[] = []
  const stats: AlgorithmStats = {
    candidatesGenerated: 0,
    feasibleSolutions: 0,
    infeasibleSolutions: 0,
    averageFairness: 0,
    bestFairness: 0,
    averageQuantity: 0,
    bestQuantity: 0,
    twoOptImprovements: 0,
    cacheHits: 0
  }
  
  // Phase 1: Generate diverse candidate solutions
  console.log('Phase 1: Generating candidate solutions...')
  const candidates = generateCandidateSolutions(
    clusters,
    departureLocation,
    returnLocation,
    standardizedPreferences,
    userKeys,
    timeConstraints,
    finalConfig,
    stats
  )
  allSolutions.push(...candidates)
  
  // Check for early termination
  const bestCandidate = candidates
    .filter(c => c.feasible)
    .sort((a, b) => b.compositeScore - a.compositeScore)[0]
  
  if (bestCandidate && bestCandidate.fairnessScore >= finalConfig.earlyTerminationThreshold) {
    console.log(`Early termination: Fairness score ${bestCandidate.fairnessScore} exceeds threshold`)
    return createResult(bestCandidate, allSolutions, startTime, stats.candidatesGenerated, true)
  }
  
  // Phase 2: Apply 2-opt improvement to top candidates
  console.log('Phase 2: Applying 2-opt improvements...')
  const improvedSolutions = applyTwoOptImprovements(
    candidates,
    departureLocation,
    returnLocation,
    standardizedPreferences,
    userKeys,
    timeConstraints,
    finalConfig,
    stats
  )
  allSolutions.push(...improvedSolutions)
  
  // Phase 3: Select best solution
  console.log('Phase 3: Selecting best solution...')
  const feasibleSolutions = allSolutions.filter(s => s.feasible)
  const bestSolution = feasibleSolutions.length > 0
    ? feasibleSolutions.sort((a, b) => b.compositeScore - a.compositeScore)[0]
    : allSolutions.sort((a, b) => b.compositeScore - a.compositeScore)[0]
  
  // Update statistics
  updateStatistics(allSolutions, stats)
  
  console.log(`Optimization complete: ${stats.candidatesGenerated} candidates, ${stats.feasibleSolutions} feasible`)
  console.log(`Best solution: Fairness=${bestSolution.fairnessScore.toFixed(2)}, Clusters=${bestSolution.clusters.length}`)
  
  return createResult(bestSolution, allSolutions, startTime, stats.candidatesGenerated, false)
}

/**
 * Generate diverse candidate solutions using multiple strategies
 */
function generateCandidateSolutions(
  clusters: DestinationCluster[],
  departureLocation: Location,
  returnLocation: Location | null,
  preferences: StandardizedPreference[],
  userKeys: Set<string>,
  timeConstraints: TimeConstraints,
  config: OptimizationConfig,
  stats: AlgorithmStats
): RouteSolution[] {
  const candidates: RouteSolution[] = []
  
  // Strategy 1: Desirability-greedy from top clusters
  const topClusters = [...clusters]
    .sort((a, b) => b.totalDesirability - a.totalDesirability)
    .slice(0, 3)
  
  for (const startCluster of topClusters) {
    const route = generateDesirabilityGreedyRoute(
      [startCluster],
      clusters.filter(c => c.id !== startCluster.id),
      departureLocation,
      returnLocation,
      preferences,
      userKeys,
      timeConstraints
    )
    candidates.push(route)
    stats.candidatesGenerated++
  }
  
  // Strategy 2: Quantity-maximizing routes
  for (let i = 0; i < 3; i++) {
    const route = generateQuantityMaximizingRoute(
      clusters,
      departureLocation,
      returnLocation,
      preferences,
      userKeys,
      timeConstraints
    )
    candidates.push(route)
    stats.candidatesGenerated++
  }
  
  // Strategy 3: Nearest neighbor TSP
  const nnRoute = createRouteSolution(
    nearestNeighborTSP(departureLocation, clusters, returnLocation),
    departureLocation,
    returnLocation,
    preferences,
    userKeys,
    timeConstraints
  )
  candidates.push(nnRoute)
  stats.candidatesGenerated++
  
  // Strategy 4: Random exploration
  for (let i = 0; i < config.randomExplorations && stats.candidatesGenerated < config.maxIterations; i++) {
    const randomRoute = createRouteSolution(
      generateRandomRoute(clusters),
      departureLocation,
      returnLocation,
      preferences,
      userKeys,
      timeConstraints
    )
    candidates.push(randomRoute)
    stats.candidatesGenerated++
  }
  
  return candidates
}

/**
 * Generate desirability-greedy route
 */
function generateDesirabilityGreedyRoute(
  startClusters: DestinationCluster[],
  remainingClusters: DestinationCluster[],
  departureLocation: Location,
  returnLocation: Location | null,
  preferences: StandardizedPreference[],
  userKeys: Set<string>,
  timeConstraints: TimeConstraints
): RouteSolution {
  const route = generateRouteWithStart(startClusters, remainingClusters, departureLocation)
  
  // Trim route to fit time constraints if needed
  const trimmedRoute = trimRouteToTimeConstraint(
    route,
    departureLocation,
    returnLocation,
    timeConstraints
  )
  
  return createRouteSolution(
    trimmedRoute,
    departureLocation,
    returnLocation,
    preferences,
    userKeys,
    timeConstraints
  )
}

/**
 * Generate quantity-maximizing route
 */
function generateQuantityMaximizingRoute(
  clusters: DestinationCluster[],
  departureLocation: Location,
  returnLocation: Location | null,
  preferences: StandardizedPreference[],
  userKeys: Set<string>,
  timeConstraints: TimeConstraints
): RouteSolution {
  // Sort by stay time (shortest first) to maximize quantity
  const sortedClusters = [...clusters].sort(
    (a, b) => a.averageStayTime - b.averageStayTime
  )
  
  // Build route using nearest neighbor on sorted clusters
  const route = nearestNeighborTSP(departureLocation, sortedClusters, returnLocation)
  
  // Trim to fit constraints
  const trimmedRoute = trimRouteToTimeConstraint(
    route,
    departureLocation,
    returnLocation,
    timeConstraints
  )
  
  return createRouteSolution(
    trimmedRoute,
    departureLocation,
    returnLocation,
    preferences,
    userKeys,
    timeConstraints
  )
}

/**
 * Apply 2-opt improvements to top candidates
 */
function applyTwoOptImprovements(
  candidates: RouteSolution[],
  departureLocation: Location,
  returnLocation: Location | null,
  preferences: StandardizedPreference[],
  userKeys: Set<string>,
  timeConstraints: TimeConstraints,
  config: OptimizationConfig,
  stats: AlgorithmStats
): RouteSolution[] {
  const improved: RouteSolution[] = []
  
  // Select top candidates for improvement
  const topCandidates = candidates
    .filter(c => c.feasible)
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, config.topCandidatesToImprove)
  
  for (const candidate of topCandidates) {
    const { improvedRoute, result } = twoOptImprovement(
      candidate.clusters,
      departureLocation,
      returnLocation
    )
    
    if (result.improved) {
      stats.twoOptImprovements++
      const improvedSolution = createRouteSolution(
        improvedRoute,
        departureLocation,
        returnLocation,
        preferences,
        userKeys,
        timeConstraints
      )
      improved.push(improvedSolution)
      stats.candidatesGenerated++
    }
  }
  
  return improved
}

/**
 * Create a route solution with all metrics
 */
function createRouteSolution(
  clusters: DestinationCluster[],
  departureLocation: Location,
  returnLocation: Location | null,
  preferences: StandardizedPreference[],
  userKeys: Set<string>,
  timeConstraints: TimeConstraints
): RouteSolution {
  // Calculate route metrics
  const routeMetrics = calculateRouteMetrics(
    departureLocation,
    clusters,
    returnLocation
  )
  
  // Calculate fairness
  const fairnessResult = calculateFairness(clusters, preferences, userKeys)
  
  // Calculate quantity score
  const totalClusters = preferences.length > 0 
    ? new Set(preferences.map(p => p.destinationId)).size 
    : 1
  const quantityScore = totalClusters > 0 ? clusters.length / totalClusters : 0
  
  // Calculate composite score
  const compositeScore = 
    fairnessResult.fairnessScore * 0.6 + 
    quantityScore * 0.4
  
  // Validate feasibility
  const feasibilityCheck = validateRouteFeasibility(
    routeMetrics.totalTimeHours,
    timeConstraints.totalAvailableHours,
    routeMetrics.transportModes
  )
  
  // Create member satisfaction map
  const memberSatisfaction = new Map<string, number>()
  fairnessResult.userSatisfactions.forEach(us => {
    memberSatisfaction.set(us.userKey, us.satisfactionScore)
  })
  
  return {
    clusters,
    segments: routeMetrics.segments,
    totalDistanceKm: routeMetrics.totalDistanceKm,
    totalTimeHours: routeMetrics.totalTimeHours,
    fairnessScore: fairnessResult.fairnessScore,
    quantityScore,
    compositeScore,
    memberSatisfaction,
    feasible: feasibilityCheck.feasible,
    issues: feasibilityCheck.issues
  }
}

/**
 * Trim route to fit within time constraints
 */
function trimRouteToTimeConstraint(
  route: DestinationCluster[],
  departureLocation: Location,
  returnLocation: Location | null,
  timeConstraints: TimeConstraints
): DestinationCluster[] {
  if (timeConstraints.mode === 'auto' || !timeConstraints.totalAvailableHours) {
    return route
  }
  
  const trimmedRoute: DestinationCluster[] = []
  let currentTime = 0
  
  for (const cluster of route) {
    const testRoute = [...trimmedRoute, cluster]
    const metrics = calculateRouteMetrics(
      departureLocation,
      testRoute,
      returnLocation
    )
    
    if (metrics.totalTimeHours <= timeConstraints.totalAvailableHours) {
      trimmedRoute.push(cluster)
      currentTime = metrics.totalTimeHours
    } else {
      break // Stop adding clusters
    }
  }
  
  return trimmedRoute
}

/**
 * Update algorithm statistics
 */
function updateStatistics(solutions: RouteSolution[], stats: AlgorithmStats): void {
  const feasible = solutions.filter(s => s.feasible)
  stats.feasibleSolutions = feasible.length
  stats.infeasibleSolutions = solutions.length - feasible.length
  
  if (solutions.length > 0) {
    const fairnessScores = solutions.map(s => s.fairnessScore)
    const quantityScores = solutions.map(s => s.quantityScore)
    
    stats.averageFairness = fairnessScores.reduce((a, b) => a + b, 0) / fairnessScores.length
    stats.bestFairness = Math.max(...fairnessScores)
    stats.averageQuantity = quantityScores.reduce((a, b) => a + b, 0) / quantityScores.length
    stats.bestQuantity = Math.max(...quantityScores)
  }
}

/**
 * Create empty result
 */
function createEmptyResult(startTime: number): OptimizationResult {
  const emptySolution: RouteSolution = {
    clusters: [],
    segments: [],
    totalDistanceKm: 0,
    totalTimeHours: 0,
    fairnessScore: 1,
    quantityScore: 0,
    compositeScore: 0.6,
    memberSatisfaction: new Map(),
    feasible: true,
    issues: []
  }
  
  return {
    bestSolution: emptySolution,
    allSolutions: [emptySolution],
    executionTimeMs: Date.now() - startTime,
    iterationsPerformed: 0,
    earlyTermination: false
  }
}

/**
 * Create single cluster result
 */
function createSingleClusterResult(
  cluster: DestinationCluster,
  departureLocation: Location,
  returnLocation: Location | null,
  preferences: StandardizedPreference[],
  userKeys: Set<string>,
  timeConstraints: TimeConstraints,
  startTime: number
): OptimizationResult {
  const solution = createRouteSolution(
    [cluster],
    departureLocation,
    returnLocation,
    preferences,
    userKeys,
    timeConstraints
  )
  
  return {
    bestSolution: solution,
    allSolutions: [solution],
    executionTimeMs: Date.now() - startTime,
    iterationsPerformed: 1,
    earlyTermination: false
  }
}

/**
 * Create optimization result
 */
function createResult(
  bestSolution: RouteSolution,
  allSolutions: RouteSolution[],
  startTime: number,
  iterations: number,
  earlyTermination: boolean
): OptimizationResult {
  return {
    bestSolution,
    allSolutions,
    executionTimeMs: Date.now() - startTime,
    iterationsPerformed: iterations,
    earlyTermination
  }
}