export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  BIGQUERY = 'bigquery',
  SUPABASE = 'supabase',
  VALIDATION = 'validation',
  SYNC = 'sync',
  NETWORK = 'network',
  DATA_QUALITY = 'data_quality',
  CONFIGURATION = 'configuration'
}

export interface ErrorDetail {
  id: string;
  timestamp: Date;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  context?: Record<string, any>;
  stackTrace?: string;
  retryable: boolean;
  retryCount?: number;
  resolved?: boolean;
  resolvedAt?: Date;
  resolution?: string;
}

export interface ErrorSummary {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  resolvedCount: number;
  unresolvedCount: number;
  criticalErrors: ErrorDetail[];
  recentErrors: ErrorDetail[];
}

export interface ErrorThreshold {
  category: ErrorCategory;
  severity: ErrorSeverity;
  maxCount: number;
  timeWindowMinutes: number;
}

export class ErrorTracker {
  private errors: Map<string, ErrorDetail> = new Map();
  private errorHandlers: Map<string, (error: ErrorDetail) => Promise<void>> = new Map();
  private thresholds: ErrorThreshold[] = [];
  private alertCallback?: (summary: ErrorSummary) => void;

  /**
   * Track a new error
   */
  trackError(error: Partial<ErrorDetail> & { message: string; category: ErrorCategory }): ErrorDetail {
    const errorDetail: ErrorDetail = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      severity: error.severity || ErrorSeverity.MEDIUM,
      retryable: error.retryable !== false,
      retryCount: 0,
      resolved: false,
      ...error,
    };

    this.errors.set(errorDetail.id, errorDetail);
    
    // Check thresholds
    this.checkThresholds();
    
    // Execute error handlers
    this.executeHandlers(errorDetail);
    
    return errorDetail;
  }

  /**
   * Track error with automatic categorization
   */
  trackAutoError(error: Error, context?: Record<string, any>): ErrorDetail {
    const category = this.categorizeError(error);
    const severity = this.determineSeverity(error, category);
    
    return this.trackError({
      category,
      severity,
      message: error.message,
      stackTrace: error.stack,
      context,
      retryable: this.isRetryable(error),
    });
  }

  /**
   * Mark error as resolved
   */
  resolveError(errorId: string, resolution?: string): void {
    const error = this.errors.get(errorId);
    if (error && !error.resolved) {
      error.resolved = true;
      error.resolvedAt = new Date();
      error.resolution = resolution;
    }
  }

  /**
   * Retry failed operation
   */
  async retryError(errorId: string, operation: () => Promise<any>): Promise<{ success: boolean; result?: any; error?: Error }> {
    const error = this.errors.get(errorId);
    if (!error || !error.retryable) {
      return { success: false, error: new Error('Error not retryable') };
    }

    error.retryCount = (error.retryCount || 0) + 1;

    try {
      const result = await operation();
      this.resolveError(errorId, 'Retry successful');
      return { success: true, result };
    } catch (retryError) {
      error.message = `Retry ${error.retryCount} failed: ${retryError instanceof Error ? retryError.message : String(retryError)}`;
      return { success: false, error: retryError instanceof Error ? retryError : new Error(String(retryError)) };
    }
  }

  /**
   * Get error summary
   */
  getErrorSummary(): ErrorSummary {
    const allErrors = Array.from(this.errors.values());
    const recentCutoff = new Date(Date.now() - 60 * 60 * 1000); // Last hour

    const errorsByCategory = this.groupByCount(allErrors, e => e.category);
    const errorsBySeverity = this.groupByCount(allErrors, e => e.severity);

    const criticalErrors = allErrors
      .filter(e => e.severity === ErrorSeverity.CRITICAL && !e.resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const recentErrors = allErrors
      .filter(e => e.timestamp > recentCutoff)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    const resolvedCount = allErrors.filter(e => e.resolved).length;
    const unresolvedCount = allErrors.filter(e => !e.resolved).length;

    return {
      totalErrors: allErrors.length,
      errorsByCategory,
      errorsBySeverity,
      resolvedCount,
      unresolvedCount,
      criticalErrors,
      recentErrors,
    };
  }

  /**
   * Get errors by criteria
   */
  getErrors(filter?: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    resolved?: boolean;
    since?: Date;
  }): ErrorDetail[] {
    let errors = Array.from(this.errors.values());

    if (filter) {
      if (filter.category) {
        errors = errors.filter(e => e.category === filter.category);
      }
      if (filter.severity) {
        errors = errors.filter(e => e.severity === filter.severity);
      }
      if (filter.resolved !== undefined) {
        errors = errors.filter(e => e.resolved === filter.resolved);
      }
      if (filter.since) {
        errors = errors.filter(e => e.timestamp > filter.since!);
      }
    }

    return errors.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Set error thresholds for alerting
   */
  setThresholds(thresholds: ErrorThreshold[]): void {
    this.thresholds = thresholds;
  }

  /**
   * Set alert callback
   */
  setAlertCallback(callback: (summary: ErrorSummary) => void): void {
    this.alertCallback = callback;
  }

  /**
   * Register error handler
   */
  registerHandler(pattern: string, handler: (error: ErrorDetail) => Promise<void>): void {
    this.errorHandlers.set(pattern, handler);
  }

  /**
   * Clear resolved errors older than specified days
   */
  cleanupOldErrors(daysToKeep: number = 7): number {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    let removedCount = 0;

    this.errors.forEach((error, id) => {
      if (error.resolved && error.resolvedAt && error.resolvedAt < cutoffDate) {
        this.errors.delete(id);
        removedCount++;
      }
    });

    return removedCount;
  }

  /**
   * Export errors for analysis
   */
  exportErrors(format: 'json' | 'csv' = 'json'): string {
    const errors = Array.from(this.errors.values());

    if (format === 'json') {
      return JSON.stringify(errors, null, 2);
    } else {
      // CSV format
      const headers = ['id', 'timestamp', 'category', 'severity', 'message', 'resolved', 'retryCount'];
      const rows = errors.map(e => [
        e.id,
        e.timestamp.toISOString(),
        e.category,
        e.severity,
        `"${e.message.replace(/"/g, '""')}"`,
        e.resolved,
        e.retryCount || 0,
      ]);

      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
  }

  /**
   * Private methods
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    
    if (message.includes('bigquery') || message.includes('bq')) {
      return ErrorCategory.BIGQUERY;
    } else if (message.includes('supabase')) {
      return ErrorCategory.SUPABASE;
    } else if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    } else if (message.includes('sync')) {
      return ErrorCategory.SYNC;
    } else if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      return ErrorCategory.NETWORK;
    } else if (message.includes('quality') || message.includes('completeness')) {
      return ErrorCategory.DATA_QUALITY;
    } else if (message.includes('config') || message.includes('setting')) {
      return ErrorCategory.CONFIGURATION;
    }
    
    return ErrorCategory.SYNC; // Default
  }

  private determineSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
    const message = error.message.toLowerCase();
    
    // Critical patterns
    if (message.includes('authentication') || message.includes('permission denied')) {
      return ErrorSeverity.CRITICAL;
    }
    if (message.includes('quota exceeded') || message.includes('rate limit')) {
      return ErrorSeverity.HIGH;
    }
    
    // Category-specific severity
    switch (category) {
      case ErrorCategory.CONFIGURATION:
        return ErrorSeverity.CRITICAL;
      case ErrorCategory.DATA_QUALITY:
        return message.includes('corrupt') ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;
      case ErrorCategory.NETWORK:
        return ErrorSeverity.MEDIUM;
      default:
        return ErrorSeverity.MEDIUM;
    }
  }

  private isRetryable(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Non-retryable patterns
    if (message.includes('permission') || message.includes('authentication')) {
      return false;
    }
    if (message.includes('invalid') || message.includes('malformed')) {
      return false;
    }
    
    // Retryable patterns
    if (message.includes('timeout') || message.includes('network')) {
      return true;
    }
    if (message.includes('temporary') || message.includes('transient')) {
      return true;
    }
    
    return false; // Default to non-retryable
  }

  private checkThresholds(): void {
    const now = new Date();
    const summary = this.getErrorSummary();

    for (const threshold of this.thresholds) {
      const windowStart = new Date(now.getTime() - threshold.timeWindowMinutes * 60 * 1000);
      const recentErrors = this.getErrors({
        category: threshold.category,
        severity: threshold.severity,
        since: windowStart,
      });

      if (recentErrors.length >= threshold.maxCount && this.alertCallback) {
        this.alertCallback(summary);
        break; // Only alert once per check
      }
    }
  }

  private executeHandlers(error: ErrorDetail): void {
    this.errorHandlers.forEach((handler, pattern) => {
      if (error.message.includes(pattern) || error.category === pattern) {
        handler(error).catch(err => {
          console.error('Error handler failed:', err);
        });
      }
    });
  }

  private groupByCount<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
    const counts: Record<string, number> = {};
    
    items.forEach(item => {
      const key = keyFn(item);
      counts[key] = (counts[key] || 0) + 1;
    });
    
    return counts;
  }
}

// Global error tracker instance
export const errorTracker = new ErrorTracker();

// Error tracking decorator
export function trackErrors(category: ErrorCategory) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        errorTracker.trackError({
          category,
          message: error instanceof Error ? error.message : String(error),
          context: {
            method: propertyKey,
            args: args.slice(0, 3), // Limit args to prevent large payloads
          },
          stackTrace: error instanceof Error ? error.stack : undefined,
        });
        throw error;
      }
    };

    return descriptor;
  };
}