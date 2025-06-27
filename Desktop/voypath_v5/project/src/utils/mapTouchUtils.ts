/**
 * Map Touch Utilities - Helper functions for one-finger scrolling and touch optimization
 */

export class MapTouchUtils {
  private static originalBodyStyle: string = '';
  private static scrollPosition: number = 0;

  /**
   * Lock body scroll when user is interacting with map
   * Prevents conflicts between map panning and page scrolling
   */
  static lockBodyScroll(): void {
    if (typeof window === 'undefined') return;

    // Save current scroll position
    this.scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    
    // Save original body style
    this.originalBodyStyle = document.body.style.cssText;
    
    // Apply scroll lock
    document.body.style.cssText = `
      position: fixed !important;
      top: -${this.scrollPosition}px !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      overflow: hidden !important;
      -webkit-overflow-scrolling: touch !important;
    `;
    
    // Add class for CSS targeting
    document.body.classList.add('map-active');
  }

  /**
   * Unlock body scroll when user stops interacting with map
   */
  static unlockBodyScroll(): void {
    if (typeof window === 'undefined') return;

    // Restore original body style
    document.body.style.cssText = this.originalBodyStyle;
    
    // Remove class
    document.body.classList.remove('map-active');
    
    // Restore scroll position
    window.scrollTo(0, this.scrollPosition);
  }

  /**
   * Initialize touch optimizations for a map element
   */
  static initializeMapTouch(mapElement: HTMLElement): void {
    if (!mapElement) return;

    // Add touch event listeners for better interaction
    mapElement.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    mapElement.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    mapElement.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    
    // Mouse events for desktop
    mapElement.addEventListener('mousedown', this.handleMouseDown.bind(this));
    mapElement.addEventListener('mouseup', this.handleMouseUp.bind(this));
    
    // Add visual feedback
    mapElement.classList.add('map-touch-initialized');
  }

  /**
   * Clean up touch optimizations for a map element
   */
  static cleanupMapTouch(mapElement: HTMLElement): void {
    if (!mapElement) return;

    mapElement.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    mapElement.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    mapElement.removeEventListener('touchend', this.handleTouchEnd.bind(this));
    mapElement.removeEventListener('mousedown', this.handleMouseDown.bind(this));
    mapElement.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    
    mapElement.classList.remove('map-touch-initialized');
    
    // Ensure body scroll is unlocked
    this.unlockBodyScroll();
  }

  private static handleTouchStart(event: TouchEvent): void {
    // Only lock scroll for single-finger gestures (panning)
    if (event.touches.length === 1) {
      this.lockBodyScroll();
    }
  }

  private static handleTouchMove(event: TouchEvent): void {
    // Prevent default only if we're in a map interaction
    if (event.target && (event.target as Element).closest('.map-container')) {
      event.stopPropagation();
    }
  }

  private static handleTouchEnd(event: TouchEvent): void {
    // Unlock scroll when touch interaction ends
    if (event.touches.length === 0) {
      setTimeout(() => {
        this.unlockBodyScroll();
      }, 100); // Small delay to ensure map has processed the touch
    }
  }

  private static handleMouseDown(event: MouseEvent): void {
    // Lock scroll for mouse interactions (desktop panning)
    this.lockBodyScroll();
  }

  private static handleMouseUp(event: MouseEvent): void {
    // Unlock scroll when mouse interaction ends
    setTimeout(() => {
      this.unlockBodyScroll();
    }, 100);
  }

  /**
   * Optimize map performance for touch devices
   */
  static optimizeMapForTouch(map: google.maps.Map): void {
    if (!map) return;

    // Set optimal options for touch interaction
    map.setOptions({
      gestureHandling: 'greedy',
      zoomControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_CENTER
      },
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: true,
      disableDoubleClickZoom: false, // Allow pinch-to-zoom
      scrollwheel: true,
      draggable: true,
      keyboardShortcuts: false // Prevent keyboard conflicts
    });
  }

  /**
   * Check if device supports touch
   */
  static isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /**
   * Get optimal zoom control position based on device
   */
  static getOptimalControlPosition(): google.maps.ControlPosition {
    const isMobile = window.innerWidth < 768;
    const isTouch = this.isTouchDevice();
    
    if (isMobile || isTouch) {
      return google.maps.ControlPosition.BOTTOM_RIGHT;
    }
    
    return google.maps.ControlPosition.RIGHT_CENTER;
  }

  /**
   * Add custom CSS for enhanced touch experience
   */
  static addTouchStyles(): void {
    if (typeof document === 'undefined') return;

    const styleId = 'map-touch-utils-styles';
    
    // Check if styles already added
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .map-touch-initialized {
        /* Enhanced touch feedback */
        -webkit-tap-highlight-color: transparent;
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
        
        /* Smooth interactions */
        will-change: transform;
        transform: translateZ(0);
      }
      
      .map-touch-initialized:active {
        /* Visual feedback during interaction */
        filter: brightness(0.95);
      }
      
      /* Prevent text selection during map interaction */
      .map-active {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }
      
      /* Optimize touch targets in maps */
      .gm-style .gm-control-active {
        min-width: 44px !important;
        min-height: 44px !important;
        touch-action: manipulation !important;
      }
      
      @media (max-width: 768px) {
        .gm-style .gm-control-active {
          min-width: 48px !important;
          min-height: 48px !important;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Initialize all map touch optimizations
   */
  static initialize(): void {
    this.addTouchStyles();
  }
}

// Auto-initialize when module is loaded
if (typeof window !== 'undefined') {
  MapTouchUtils.initialize();
}

export default MapTouchUtils;