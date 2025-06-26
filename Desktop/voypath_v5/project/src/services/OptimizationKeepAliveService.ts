/**
 * Keep-Alive Service for Edge Functions
 * Prevents cold starts by periodically pinging optimization functions
 * Scalable architecture - never stores data locally
 */

import { supabase } from '../lib/supabase';

export class OptimizationKeepAliveService {
  private static keepAliveInterval: NodeJS.Timeout | null = null;
  private static readonly PING_INTERVAL = 4 * 60 * 1000; // 4 minutes (before 5min cold start)
  private static readonly FUNCTIONS_TO_KEEP_WARM = [
    'optimize-route',
    'normalize-preferences', 
    'select-optimal-places'
  ];

  /**
   * Start keep-alive service (call once per session)
   */
  static startKeepAlive(): void {
    if (this.keepAliveInterval) {
      return; // Already running
    }

    console.log('🔥 Starting optimization keep-alive service');
    
    // Initial ping (disabled in development to avoid errors)
    if (import.meta.env.PROD) {
      this.pingAllFunctions();
    } else {
      console.log('⚠️ Keep-alive disabled in development mode');
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
      console.log('🔥 Stopped optimization keep-alive service');
    }
  }

  /**
   * Ping all optimization functions to keep them warm
   */
  private static async pingAllFunctions(): Promise<void> {
    const promises = this.FUNCTIONS_TO_KEEP_WARM.map(functionName => 
      this.pingFunction(functionName)
    );

    try {
      await Promise.allSettled(promises);
      console.log('🔥 Keep-alive ping completed for all functions');
    } catch (error) {
      console.warn('Keep-alive ping failed:', error);
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
        console.warn(`Keep-alive failed for ${functionName}:`, response.error);
      } else {
        console.log(`🔥 ${functionName} keep-alive: ${responseTime}ms`);
      }
    } catch (error) {
      console.warn(`Keep-alive error for ${functionName}:`, error);
    }
  }

  /**
   * Manual warm-up before optimization (for critical operations)
   */
  static async warmUpForOptimization(): Promise<void> {
    console.log('🔥 Warming up functions for optimization...');
    
    const startTime = Date.now();
    await this.pingAllFunctions();
    const totalTime = Date.now() - startTime;
    
    console.log(`🔥 Functions warmed up in ${totalTime}ms`);
  }

  /**
   * Check if keep-alive is currently active
   */
  static isActive(): boolean {
    return this.keepAliveInterval !== null;
  }

  /**
   * Get keep-alive status for monitoring
   */
  static getStatus(): {
    active: boolean;
    interval: number;
    functions: string[];
  } {
    return {
      active: this.isActive(),
      interval: this.PING_INTERVAL,
      functions: [...this.FUNCTIONS_TO_KEEP_WARM]
    };
  }
}