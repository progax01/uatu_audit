import { logger } from '../utils/logger';

const log = logger.child({ service: 'circuit-breaker' });

/**
 * Circuit Breaker Pattern
 * Protects system from cascading failures
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes to close from half-open
  timeout: number; // ms to wait before trying again (half-open)
  monitoringWindow: number; // ms window for tracking failures
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalCalls: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  lastStateChange: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000, // 60 seconds
  monitoringWindow: 120000 // 2 minutes
};

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: number = 0;
  private successes: number = 0;
  private totalCalls: number = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private lastStateChange: number = Date.now();
  private failureTimestamps: number[] = [];

  private name: string;
  private config: CircuitBreakerConfig;

  constructor(name: string, config?: Partial<CircuitBreakerConfig>) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info(`Circuit breaker initialized: ${name}`, this.config);
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        log.info(`Circuit breaker ${this.name}: Transitioning to HALF_OPEN`);
        this.state = 'HALF_OPEN';
        this.lastStateChange = Date.now();
      } else {
        const waitTime = this.config.timeout - (Date.now() - this.lastStateChange);
        throw new CircuitBreakerOpenError(
          `Circuit breaker ${this.name} is OPEN. Retry in ${Math.ceil(waitTime / 1000)}s`,
          waitTime
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error: any) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.failures = 0; // Reset failure count on success

    if (this.state === 'HALF_OPEN') {
      this.successes++;

      if (this.successes >= this.config.successThreshold) {
        log.info(`Circuit breaker ${this.name}: HALF_OPEN -> CLOSED`);
        this.state = 'CLOSED';
        this.successes = 0;
        this.lastStateChange = Date.now();
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.failures++;
    this.failureTimestamps.push(Date.now());

    // Clean old failures outside monitoring window
    const cutoff = Date.now() - this.config.monitoringWindow;
    this.failureTimestamps = this.failureTimestamps.filter(t => t > cutoff);

    // Count failures in monitoring window
    const recentFailures = this.failureTimestamps.length;

    log.warn(`Circuit breaker ${this.name}: Failure ${recentFailures}/${this.config.failureThreshold}`, {
      state: this.state,
      total_failures: this.failures
    });

    // If HALF_OPEN, go back to OPEN on any failure
    if (this.state === 'HALF_OPEN') {
      log.warn(`Circuit breaker ${this.name}: HALF_OPEN -> OPEN (failure during recovery)`);
      this.state = 'OPEN';
      this.successes = 0;
      this.lastStateChange = Date.now();
      return;
    }

    // If CLOSED, open if threshold exceeded
    if (this.state === 'CLOSED' && recentFailures >= this.config.failureThreshold) {
      log.error(`Circuit breaker ${this.name}: CLOSED -> OPEN (threshold exceeded)`, {
        failures: recentFailures,
        threshold: this.config.failureThreshold
      });
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
    }
  }

  /**
   * Check if should attempt reset
   */
  private shouldAttemptReset(): boolean {
    const elapsed = Date.now() - this.lastStateChange;
    return elapsed >= this.config.timeout;
  }

  /**
   * Get current stats
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      lastStateChange: this.lastStateChange
    };
  }

  /**
   * Force reset circuit breaker
   */
  reset(): void {
    log.info(`Circuit breaker ${this.name}: Manual reset`);
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.failureTimestamps = [];
    this.lastStateChange = Date.now();
  }

  /**
   * Force open circuit breaker (for maintenance)
   */
  forceOpen(): void {
    log.info(`Circuit breaker ${this.name}: Forced OPEN`);
    this.state = 'OPEN';
    this.lastStateChange = Date.now();
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string, public retryAfter: number) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * Circuit Breaker Registry
 * Manages multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create circuit breaker
   */
  getBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all breakers stats
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Reset all breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
    log.info('All circuit breakers reset');
  }

  /**
   * Get health status
   */
  getHealth(): {
    healthy: boolean;
    breakers: {
      name: string;
      state: CircuitState;
      healthy: boolean;
    }[];
  } {
    const breakers = [];
    let allHealthy = true;

    for (const [name, breaker] of this.breakers) {
      const stats = breaker.getStats();
      const healthy = stats.state !== 'OPEN';

      if (!healthy) {
        allHealthy = false;
      }

      breakers.push({
        name,
        state: stats.state,
        healthy
      });
    }

    return {
      healthy: allHealthy,
      breakers
    };
  }
}

// Global registry
const registry = new CircuitBreakerRegistry();

/**
 * Get global circuit breaker registry
 */
export function getCircuitBreakerRegistry(): CircuitBreakerRegistry {
  return registry;
}

/**
 * Create circuit breaker for Claude API
 */
export function createClaudeCircuitBreaker(
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  return registry.getBreaker('claude-api', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 30000, // 30 seconds
    monitoringWindow: 60000, // 1 minute
    ...config
  });
}

/**
 * Create circuit breaker for Git operations
 */
export function createGitCircuitBreaker(
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  return registry.getBreaker('git-operations', {
    failureThreshold: 5,
    successThreshold: 1,
    timeout: 10000, // 10 seconds
    monitoringWindow: 30000, // 30 seconds
    ...config
  });
}

/**
 * Create circuit breaker for database operations
 */
export function createDatabaseCircuitBreaker(
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  return registry.getBreaker('database', {
    failureThreshold: 10,
    successThreshold: 3,
    timeout: 20000, // 20 seconds
    monitoringWindow: 120000, // 2 minutes
    ...config
  });
}

/**
 * Decorator for circuit breaker protection
 */
export function withCircuitBreaker(breakerName: string, config?: Partial<CircuitBreakerConfig>) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const breaker = registry.getBreaker(breakerName, config);
      return breaker.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
