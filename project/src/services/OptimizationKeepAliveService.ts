/**
 * Keep-Alive Service for Edge Functions
 * Prevents cold starts by periodically pinging optimization functions
 * Scalable architecture - never stores data locally
 */

import { supabase } from '../lib/supabase';

export class OptimizationKeepAliveService {
  private static keepAliveInterval: NodeJS.Timeout | null = null;
  private static readonly PING_INTERVAL = 8 * 60 * 1000; // 8 minutes (reduced frequency to prevent realtime conflicts)
  private static isRealtimeActive = false;
  private static readonly FUNCTIONS_TO_KEEP_WARM = [
    'optimize-route',
    'normalize-preferences'
  ];

  /**
   * Start keep-alive service (call once per session)
   */
  static startKeepAlive(): void {
    if (this.keepAliveInterval) {
      return; // Already running
    }

    // Log message
    
    // Initial ping (disabled in development to avoid errors)
    if (import.meta.env.PROD) {
      this.pingAllFunctions();
    } else {
      // Log message
    }
    
    // Set up periodic pinging (disabled in development)
    if (import.meta.env.PROD) {
      this.keepAliveInterval = setInterval(() => {
        this.pingAllFunctions();
      }, this.PING_INTERVAL);
    }
  }

  /**
   * Stop keep-alive service
   */
  static stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
      // Log message
    }
  }

  /**
   * Ping all optimization functions to keep them warm - OPTIMIZED to prevent realtime conflicts
   */
  private static async pingAllFunctions(): Promise<void> {
    // Skip pinging if realtime is active to prevent connection conflicts
    if (this.isRealtimeActive) {
      console.log('😴 Skipping keep-alive pings - realtime is active');
      return;
    }
    
    const promises = this.FUNCTIONS_TO_KEEP_WARM.map(functionName => 
      this.pingFunction(functionName)
    );

    try {
      await Promise.allSettled(promises);
      // Log message
    } catch (error) {
      // Warning occurred
    }
  }

  /**
   * Ping a specific function
   */
  private static async pingFunction(functionName: string): Promise<void> {
    try {
      const startTime = Date.now();
      
      const response = await supabase.functions.invoke(functionName, {
        body: { type: 'keep_alive' }
      });

      const responseTime = Date.now() - startTime;
      
      if (response.error) {
        // Warning occurred
      } else {
        // Log message
      }
    } catch (error) {
      // Warning occurred
    }
  }

  /**
   * Manual warm-up before optimization (for critical operations)
   */
  static async warmUpForOptimization(): Promise<void> {
    // Log message
    
    const startTime = Date.now();
    await this.pingAllFunctions();
    const totalTime = Date.now() - startTime;
    
    // Log message
  }

  /**
   * Check if keep-alive is currently active
   */
  static isActive(): boolean {
    return this.keepAliveInterval !== null;
  }

  /**
   * Set realtime status to coordinate with keep-alive
   */
  static setRealtimeActive(active: boolean): void {
    this.isRealtimeActive = active;
    console.log(`🔄 Keep-alive service: realtime status updated to ${active ? 'ACTIVE' : 'INACTIVE'}`);
  }

  /**
   * Get keep-alive status for monitoring
   */
  static getStatus(): {
    active: boolean;
    interval: number;
    functions: string[];
    realtimeActive: boolean;
  } {
    return {
      active: this.isActive(),
      interval: this.PING_INTERVAL,
      functions: [...this.FUNCTIONS_TO_KEEP_WARM],
      realtimeActive: this.isRealtimeActive
    };
  }
}