// Performance optimization utilities for map visualization

import type { MarkerConfig, RouteSegmentConfig } from '@/lib/types/map-visualization'

// Debounce utility for map events
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Throttle utility for high-frequency events
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// Marker clustering for dense destinations
export class MarkerClusterer {
  private markers: Map<string, MarkerConfig> = new Map()
  private clusters: MarkerCluster[] = []
  private gridSize: number = 60 // pixels
  private maxZoom: number = 15
  
  constructor(gridSize?: number, maxZoom?: number) {
    if (gridSize) this.gridSize = gridSize
    if (maxZoom) this.maxZoom = maxZoom
  }
  
  addMarkers(markers: MarkerConfig[], map: google.maps.Map) {
    markers.forEach(marker => {
      this.markers.set(marker.destinationId, marker)
    })
    
    this.cluster(map)
  }
  
  removeMarker(id: string) {
    this.markers.delete(id)
  }
  
  clearMarkers() {
    this.markers.clear()
    this.clusters = []
  }
  
  private cluster(map: google.maps.Map) {
    const zoom = map.getZoom() || 10
    
    if (zoom > this.maxZoom) {
      // Show individual markers at high zoom
      this.showIndividualMarkers(map)
      return
    }
    
    // Group markers into clusters
    this.clusters = []
    const processed = new Set<string>()
    
    for (const [id, marker] of Array.from(this.markers)) {
      if (processed.has(id)) continue
      
      const cluster = this.createCluster(marker, map)
      processed.add(id)
      
      // Find nearby markers
      for (const [otherId, otherMarker] of Array.from(this.markers)) {
        if (processed.has(otherId)) continue
        
        if (this.isNearby(marker, otherMarker, map)) {
          cluster.addMarker(otherMarker)
          processed.add(otherId)
        }
      }
      
      this.clusters.push(cluster)
    }
    
    // Render clusters
    this.renderClusters(map)
  }
  
  private createCluster(marker: MarkerConfig, map: google.maps.Map): MarkerCluster {
    return new MarkerCluster(marker, this.gridSize)
  }
  
  private isNearby(marker1: MarkerConfig, marker2: MarkerConfig, map: google.maps.Map): boolean {
    const projection = map.getProjection()
    if (!projection) return false
    
    const point1 = projection.fromLatLngToPoint(new google.maps.LatLng(marker1.position))
    const point2 = projection.fromLatLngToPoint(new google.maps.LatLng(marker2.position))
    
    if (!point1 || !point2) return false
    
    const distance = Math.sqrt(
      Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2)
    )
    
    const scale = Math.pow(2, map.getZoom() || 10)
    return distance * scale < this.gridSize
  }
  
  private showIndividualMarkers(map: google.maps.Map) {
    // Implementation for showing individual markers
    this.clusters = Array.from(this.markers.values()).map(marker => 
      new MarkerCluster(marker, this.gridSize)
    )
    this.renderClusters(map)
  }
  
  private renderClusters(map: google.maps.Map) {
    this.clusters.forEach(cluster => {
      cluster.render(map)
    })
  }
}

// Individual marker cluster
class MarkerCluster {
  private markers: MarkerConfig[] = []
  private center: google.maps.LatLngLiteral
  private gridSize: number
  private element: google.maps.marker.AdvancedMarkerElement | null = null
  
  constructor(initialMarker: MarkerConfig, gridSize: number) {
    this.markers = [initialMarker]
    this.center = initialMarker.position
    this.gridSize = gridSize
  }
  
  addMarker(marker: MarkerConfig) {
    this.markers.push(marker)
    this.updateCenter()
  }
  
  private updateCenter() {
    const lat = this.markers.reduce((sum, m) => sum + m.position.lat, 0) / this.markers.length
    const lng = this.markers.reduce((sum, m) => sum + m.position.lng, 0) / this.markers.length
    this.center = { lat, lng }
  }
  
  render(map: google.maps.Map) {
    if (this.element) {
      this.element.map = null
    }
    
    if (this.markers.length === 1) {
      // Single marker
      this.renderSingleMarker(map)
    } else {
      // Cluster marker
      this.renderClusterMarker(map)
    }
  }
  
  private renderSingleMarker(map: google.maps.Map) {
    const marker = this.markers[0]
    const content = this.createMarkerContent(marker)
    
    this.element = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: marker.position,
      content
    })
  }
  
  private renderClusterMarker(map: google.maps.Map) {
    const content = this.createClusterContent()
    
    this.element = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: this.center,
      content
    })
    
    // Click to zoom
    this.element.addListener('click', () => {
      const bounds = new google.maps.LatLngBounds()
      this.markers.forEach(marker => {
        bounds.extend(marker.position)
      })
      map.fitBounds(bounds)
    })
  }
  
  private createMarkerContent(marker: MarkerConfig): HTMLElement {
    const container = document.createElement('div')
    container.style.cssText = `
      width: ${marker.size}px;
      height: ${marker.size}px;
      background-color: ${marker.color};
      border: 2px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      color: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      cursor: pointer;
    `
    container.textContent = marker.orderNumber.toString()
    return container
  }
  
  private createClusterContent(): HTMLElement {
    const container = document.createElement('div')
    const size = Math.min(60, 30 + this.markers.length * 3)
    
    container.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      background-color: #F59E0B;
      border: 3px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      cursor: pointer;
      font-size: ${Math.max(12, 16 - this.markers.length)}px;
    `
    
    container.textContent = this.markers.length.toString()
    container.title = `${this.markers.length} destinations`
    
    return container
  }
}

// Viewport-based marker management
export class ViewportMarkerManager {
  private allMarkers: Map<string, MarkerConfig> = new Map()
  private visibleMarkers: Map<string, google.maps.marker.AdvancedMarkerElement> = new Map()
  private map: google.maps.Map | null = null
  private maxVisibleMarkers = 50
  
  constructor(map: google.maps.Map, maxVisible?: number) {
    this.map = map
    if (maxVisible) this.maxVisibleMarkers = maxVisible
    
    // Listen for viewport changes
    this.map.addListener('bounds_changed', 
      debounce(() => this.updateVisibleMarkers(), 300)
    )
  }
  
  setMarkers(markers: MarkerConfig[]) {
    this.allMarkers.clear()
    markers.forEach(marker => {
      this.allMarkers.set(marker.destinationId, marker)
    })
    this.updateVisibleMarkers()
  }
  
  private updateVisibleMarkers() {
    if (!this.map) return
    
    const bounds = this.map.getBounds()
    if (!bounds) return
    
    // Clear existing visible markers
    this.visibleMarkers.forEach(marker => {
      marker.map = null
    })
    this.visibleMarkers.clear()
    
    // Find markers in viewport
    const markersInView: MarkerConfig[] = []
    
    for (const marker of Array.from(this.allMarkers.values())) {
      if (bounds.contains(marker.position)) {
        markersInView.push(marker)
      }
    }
    
    // Limit number of visible markers
    const markersToShow = markersInView
      .slice(0, this.maxVisibleMarkers)
      .sort((a, b) => a.orderNumber - b.orderNumber)
    
    // Create visible markers
    markersToShow.forEach(markerConfig => {
      const content = this.createMarkerElement(markerConfig)
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: this.map,
        position: markerConfig.position,
        content
      })
      
      this.visibleMarkers.set(markerConfig.destinationId, marker)
    })
  }
  
  private createMarkerElement(config: MarkerConfig): HTMLElement {
    const container = document.createElement('div')
    container.style.cssText = `
      width: ${config.size}px;
      height: ${config.size}px;
      background-color: ${config.color};
      border: 2px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      color: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      cursor: pointer;
    `
    container.textContent = config.orderNumber.toString()
    return container
  }
}

// Route simplification for performance
export function simplifyRoute(
  path: google.maps.LatLngLiteral[],
  tolerance: number = 0.0001
): google.maps.LatLngLiteral[] {
  if (path.length <= 2) return path
  
  // Douglas-Peucker algorithm for line simplification
  const simplified = douglasPeucker(path, tolerance)
  return simplified.length >= 2 ? simplified : [path[0], path[path.length - 1]]
}

function douglasPeucker(
  points: google.maps.LatLngLiteral[],
  tolerance: number
): google.maps.LatLngLiteral[] {
  if (points.length <= 2) return points
  
  let maxDistance = 0
  let maxIndex = 0
  
  // Find the point with maximum distance from line
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(
      points[i],
      points[0],
      points[points.length - 1]
    )
    
    if (distance > maxDistance) {
      maxDistance = distance
      maxIndex = i
    }
  }
  
  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance)
    const right = douglasPeucker(points.slice(maxIndex), tolerance)
    
    return [...left.slice(0, -1), ...right]
  } else {
    return [points[0], points[points.length - 1]]
  }
}

function perpendicularDistance(
  point: google.maps.LatLngLiteral,
  lineStart: google.maps.LatLngLiteral,
  lineEnd: google.maps.LatLngLiteral
): number {
  const A = point.lat - lineStart.lat
  const B = point.lng - lineStart.lng
  const C = lineEnd.lat - lineStart.lat
  const D = lineEnd.lng - lineStart.lng
  
  const dot = A * C + B * D
  const lenSq = C * C + D * D
  
  if (lenSq === 0) return Math.sqrt(A * A + B * B)
  
  const param = dot / lenSq
  
  let xx: number, yy: number
  
  if (param < 0) {
    xx = lineStart.lat
    yy = lineStart.lng
  } else if (param > 1) {
    xx = lineEnd.lat
    yy = lineEnd.lng
  } else {
    xx = lineStart.lat + param * C
    yy = lineStart.lng + param * D
  }
  
  const dx = point.lat - xx
  const dy = point.lng - yy
  
  return Math.sqrt(dx * dx + dy * dy)
}

// Mobile performance utilities
export class MobilePerformanceManager {
  private static instance: MobilePerformanceManager
  private isLowPowerMode = false
  private connectionType = 'unknown'
  private memoryInfo: any = null
  
  static getInstance(): MobilePerformanceManager {
    if (!MobilePerformanceManager.instance) {
      MobilePerformanceManager.instance = new MobilePerformanceManager()
    }
    return MobilePerformanceManager.instance
  }
  
  constructor() {
    this.detectPerformanceConstraints()
  }
  
  private detectPerformanceConstraints() {
    // Detect low power mode
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        this.isLowPowerMode = battery.level < 0.2 || battery.charging === false
      })
    }
    
    // Detect connection type
    const connection = (navigator as any).connection
    if (connection) {
      this.connectionType = connection.effectiveType || 'unknown'
      connection.addEventListener('change', () => {
        this.connectionType = connection.effectiveType || 'unknown'
      })
    }
    
    // Detect memory constraints
    if ('memory' in performance) {
      this.memoryInfo = (performance as any).memory
    }
  }
  
  // Get performance tier for adaptive rendering
  getPerformanceTier(): 'high' | 'medium' | 'low' {
    const isSlowConnection = ['slow-2g', '2g'].includes(this.connectionType)
    const isLowMemory = this.memoryInfo && this.memoryInfo.usedJSHeapSize > this.memoryInfo.totalJSHeapSize * 0.8
    
    if (this.isLowPowerMode || isSlowConnection || isLowMemory) {
      return 'low'
    }
    
    if (['3g'].includes(this.connectionType)) {
      return 'medium'
    }
    
    return 'high'
  }
  
  // Get adaptive map options based on performance
  getAdaptiveMapOptions(): google.maps.MapOptions {
    const tier = this.getPerformanceTier()
    
    const baseOptions: google.maps.MapOptions = {
      gestureHandling: 'greedy',
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    }
    
    switch (tier) {
      case 'low':
        return {
          ...baseOptions,
          styles: [
            { featureType: 'all', stylers: [{ saturation: -100 }] }, // Grayscale for performance
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] }
          ],
          disableDefaultUI: true,
          clickableIcons: false
        }
        
      case 'medium':
        return {
          ...baseOptions,
          styles: [
            { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit.line', stylers: [{ visibility: 'off' }] }
          ]
        }
        
      default:
        return baseOptions
    }
  }
  
  // Get adaptive marker count
  getMaxMarkers(): number {
    const tier = this.getPerformanceTier()
    
    switch (tier) {
      case 'low': return 20
      case 'medium': return 50
      default: return 100
    }
  }
  
  // Check if animations should be enabled
  shouldEnableAnimations(): boolean {
    return this.getPerformanceTier() !== 'low' && 
           !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  
  // Get frame rate target
  getTargetFrameRate(): number {
    const tier = this.getPerformanceTier()
    
    switch (tier) {
      case 'low': return 30
      case 'medium': return 45
      default: return 60
    }
  }
}

// Frame rate monitor
export class FrameRateMonitor {
  private frames = 0
  private lastTime = performance.now()
  private fps = 0
  private callbacks: ((fps: number) => void)[] = []
  private isRunning = false
  
  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.measureFPS()
  }
  
  stop() {
    this.isRunning = false
  }
  
  onFPSChange(callback: (fps: number) => void) {
    this.callbacks.push(callback)
  }
  
  getCurrentFPS(): number {
    return this.fps
  }
  
  private measureFPS() {
    if (!this.isRunning) return
    
    const now = performance.now()
    this.frames++
    
    if (now - this.lastTime >= 1000) {
      this.fps = Math.round((this.frames * 1000) / (now - this.lastTime))
      this.frames = 0
      this.lastTime = now
      
      this.callbacks.forEach(callback => callback(this.fps))
    }
    
    requestAnimationFrame(() => this.measureFPS())
  }
}

// Memory management utilities
export class MapMemoryManager {
  private static instance: MapMemoryManager
  private observers: Map<string, IntersectionObserver> = new Map()
  private cleanupTasks: Map<string, () => void> = new Map()
  
  static getInstance(): MapMemoryManager {
    if (!MapMemoryManager.instance) {
      MapMemoryManager.instance = new MapMemoryManager()
    }
    return MapMemoryManager.instance
  }
  
  // Monitor map container visibility
  observeMapContainer(
    container: HTMLElement,
    onVisible: () => void,
    onHidden: () => void
  ) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            onVisible()
          } else {
            onHidden()
          }
        })
      },
      { threshold: 0.1 }
    )
    
    observer.observe(container)
    this.observers.set(container.id, observer)
  }
  
  // Register cleanup task
  registerCleanupTask(id: string, cleanup: () => void) {
    this.cleanupTasks.set(id, cleanup)
  }
  
  // Clean up observers
  cleanup(containerId: string) {
    const observer = this.observers.get(containerId)
    if (observer) {
      observer.disconnect()
      this.observers.delete(containerId)
    }
    
    const cleanupTask = this.cleanupTasks.get(containerId)
    if (cleanupTask) {
      cleanupTask()
      this.cleanupTasks.delete(containerId)
    }
  }
  
  // Clean up all observers
  cleanupAll() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers.clear()
    
    this.cleanupTasks.forEach(cleanup => cleanup())
    this.cleanupTasks.clear()
  }
  
  // Monitor memory usage
  getMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
      }
    }
    return null
  }
  
  // Force garbage collection (development only)
  forceGC() {
    if ((window as any).gc) {
      (window as any).gc()
    }
  }
}

// Adaptive image loading for map tiles
export class AdaptiveImageLoader {
  private static loadedImages = new Set<string>()
  private static failedImages = new Set<string>()
  
  static async loadImage(url: string, priority: 'high' | 'low' = 'low'): Promise<HTMLImageElement> {
    // Return cached result if available
    if (this.loadedImages.has(url)) {
      const img = new Image()
      img.src = url
      return img
    }
    
    if (this.failedImages.has(url)) {
      throw new Error(`Image previously failed to load: ${url}`)
    }
    
    return new Promise((resolve, reject) => {
      const img = new Image()
      
      // Set loading priority
      if ('loading' in img) {
        img.loading = priority === 'high' ? 'eager' : 'lazy'
      }
      
      img.onload = () => {
        this.loadedImages.add(url)
        resolve(img)
      }
      
      img.onerror = () => {
        this.failedImages.add(url)
        reject(new Error(`Failed to load image: ${url}`))
      }
      
      img.src = url
    })
  }
  
  static preloadImages(urls: string[]) {
    const perfManager = MobilePerformanceManager.getInstance()
    
    // Skip preloading on low performance devices
    if (perfManager.getPerformanceTier() === 'low') {
      return
    }
    
    urls.forEach(url => {
      // Use requestIdleCallback if available
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          this.loadImage(url, 'low').catch(() => {
            // Ignore preload errors
          })
        })
      }
    })
  }
}

// Touch optimization utilities
export class TouchOptimizer {
  private static touchHistory: TouchEvent[] = []
  private static MAX_HISTORY = 10
  
  static recordTouch(event: TouchEvent) {
    this.touchHistory.push(event)
    if (this.touchHistory.length > this.MAX_HISTORY) {
      this.touchHistory.shift()
    }
  }
  
  static detectGesture(): 'tap' | 'long-press' | 'pinch' | 'pan' | 'unknown' {
    if (this.touchHistory.length < 2) return 'unknown'
    
    const latest = this.touchHistory[this.touchHistory.length - 1]
    const previous = this.touchHistory[this.touchHistory.length - 2]
    
    // Multi-touch detection
    if (latest.touches.length > 1) {
      return 'pinch'
    }
    
    // Duration detection
    const duration = latest.timeStamp - this.touchHistory[0].timeStamp
    if (duration > 500 && this.touchHistory.length === 2) {
      return 'long-press'
    }
    
    // Movement detection
    if (this.touchHistory.length > 2) {
      const movement = this.calculateMovement()
      if (movement > 10) {
        return 'pan'
      }
    }
    
    return 'tap'
  }
  
  private static calculateMovement(): number {
    if (this.touchHistory.length < 2) return 0
    
    const first = this.touchHistory[0].touches[0]
    const last = this.touchHistory[this.touchHistory.length - 1].touches[0]
    
    return Math.sqrt(
      Math.pow(last.clientX - first.clientX, 2) + 
      Math.pow(last.clientY - first.clientY, 2)
    )
  }
  
  static clearHistory() {
    this.touchHistory = []
  }
}