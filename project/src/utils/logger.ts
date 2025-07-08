/**
 * Secure Logger Utility
 * Prevents sensitive data exposure in production environments
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

class SecureLogger {
  private readonly isDevelopment: boolean;
  private readonly logLevel: LogLevel;

  constructor() {
    this.isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
    this.logLevel = this.getLogLevel();
  }

  private getLogLevel(): LogLevel {
    const envLevel = import.meta.env.VITE_LOG_LEVEL;
    if (envLevel) {
      switch (envLevel.toUpperCase()) {
        case 'DEBUG': return LogLevel.DEBUG;
        case 'INFO': return LogLevel.INFO;
        case 'WARN': return LogLevel.WARN;
        case 'ERROR': return LogLevel.ERROR;
        case 'NONE': return LogLevel.NONE;
      }
    }
    
    // Default: DEBUG in development, WARN in production
    return this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sensitiveKeys = [
      'token', 'key', 'secret', 'password', 'auth', 'api_key', 'apikey',
      'supabase', 'anon_key', 'bearer', 'authorization', 'x-access-token'
    ];

    const sanitized = { ...data };

    Object.keys(sanitized).forEach(key => {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitiveKey => 
        lowerKey.includes(sensitiveKey)
      );

      if (isSensitive) {
        if (typeof sanitized[key] === 'string') {
          // Show only first 4 characters for debugging
          sanitized[key] = sanitized[key].substring(0, 4) + '***';
        } else {
          sanitized[key] = '[REDACTED]';
        }
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    });

    return sanitized;
  }

  private sanitizeUrl(url: string): string {
    if (!url) return url;

    // Redact Supabase URLs in production
    if (!this.isDevelopment && url.includes('supabase.co')) {
      const urlObj = new URL(url);
      return `https://[SUPABASE_PROJECT].supabase.co${urlObj.pathname}${urlObj.search ? '?[PARAMS]' : ''}`;
    }

    // Redact API tokens from URLs
    const tokenRegex = /([?&])(token|key|apikey|api_key)=([^&]+)/gi;
    return url.replace(tokenRegex, '$1$2=***');
  }

  debug(message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    if (data) {
      console.log(`🐛 ${message}`, this.sanitizeData(data));
    } else {
      console.log(`🐛 ${message}`);
    }
  }

  info(message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    if (data) {
      console.log(`ℹ️ ${message}`, this.sanitizeData(data));
    } else {
      console.log(`ℹ️ ${message}`);
    }
  }

  warn(message: string, data?: any): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    if (data) {
      console.warn(`⚠️ ${message}`, this.sanitizeData(data));
    } else {
      console.warn(`⚠️ ${message}`);
    }
  }

  error(message: string, error?: any): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    if (error) {
      // For errors, still sanitize but preserve error details
      const sanitizedError = error instanceof Error 
        ? { message: error.message, name: error.name, stack: this.isDevelopment ? error.stack : '[REDACTED]' }
        : this.sanitizeData(error);
      
      console.error(`❌ ${message}`, sanitizedError);
    } else {
      console.error(`❌ ${message}`);
    }
  }

  // Special method for API calls with URL sanitization
  apiCall(message: string, url: string, options?: any): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const sanitizedUrl = this.sanitizeUrl(url);
    const sanitizedOptions = options ? this.sanitizeData(options) : undefined;

    console.log(`🌐 ${message}`, {
      url: sanitizedUrl,
      ...(sanitizedOptions && { options: sanitizedOptions })
    });
  }

  // Special method for configuration logging
  config(message: string, config: any): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    console.log(`⚙️ ${message}`, this.sanitizeData(config));
  }
}

// Export singleton instance
export const logger = new SecureLogger();

// Export utility functions for backwards compatibility
export const secureLog = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
  apiCall: logger.apiCall.bind(logger),
  config: logger.config.bind(logger)
};