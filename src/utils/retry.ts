import { logger } from './logger.js';

const log = logger.child({ module: 'retry' });

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  isRetryable?: (error: any) => boolean;
}

/**
 * Retry wrapper for SOP operations with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 2,
    delayMs = 1000,
    isRetryable = (error) => {
      // Retry on common transient errors
      const message = String((error as any)?.message || error).toLowerCase();
      return message.includes('enoent') ||
             message.includes('network') ||
             message.includes('timeout') ||
             message.includes('connection') ||
             message.includes('spawn') ||
             message.includes('enotfound');
    }
  } = options;

  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxAttempts || !isRetryable(error)) {
        // Don't retry if it's the last attempt or error is not retryable
        throw error;
      }
      
      const delay = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
      log.warn(`Operation failed, retrying in ${delay}ms`, {
        attempt,
        maxAttempts,
        error: String((error as any)?.message || error)
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Timeout wrapper for operations
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    })
  ]);
}
