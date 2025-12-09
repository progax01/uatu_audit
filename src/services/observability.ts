import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'observability' });

/**
 * Observability System
 * Metrics collection and monitoring
 */

export interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastCheck: number;
  details?: Record<string, any>;
}

export interface SystemMetrics {
  timestamp: number;
  audit_stats: {
    total_audits: number;
    active_audits: number;
    completed_audits: number;
    failed_audits: number;
    avg_duration_seconds: number;
  };
  cost_stats: {
    total_cost_usd: number;
    avg_cost_per_audit: number;
    cache_savings_percentage: number;
  };
  performance_stats: {
    milestone_durations: Record<number, number>;
    avg_tokens_per_milestone: Record<number, number>;
  };
  health_checks: HealthCheck[];
}

export class ObservabilityService {
  private metrics: Metric[] = [];
  private healthChecks = new Map<string, HealthCheck>();
  private metricsPath: string;

  constructor(metricsDir: string = '.state/metrics') {
    this.metricsPath = metricsDir;
  }

  /**
   * Record a counter metric
   */
  incrementCounter(
    name: string,
    value: number = 1,
    labels?: Record<string, string>
  ): void {
    this.recordMetric({
      name,
      type: 'counter',
      value,
      timestamp: Date.now(),
      labels
    });
  }

  /**
   * Record a gauge metric
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric({
      name,
      type: 'gauge',
      value,
      timestamp: Date.now(),
      labels
    });
  }

  /**
   * Record a histogram metric (for durations, sizes, etc.)
   */
  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    this.recordMetric({
      name,
      type: 'histogram',
      value,
      timestamp: Date.now(),
      labels
    });
  }

  /**
   * Record a metric
   */
  private recordMetric(metric: Metric): void {
    this.metrics.push(metric);

    // Log significant metrics
    if (metric.value > 0) {
      log.debug(`Metric recorded: ${metric.name}`, {
        value: metric.value,
        type: metric.type,
        labels: metric.labels
      });
    }

    // Keep only last 10000 metrics in memory
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-5000);
    }
  }

  /**
   * Register a health check
   */
  registerHealthCheck(
    name: string,
    check: () => Promise<{
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
      details?: Record<string, any>;
    }>
  ): void {
    log.info(`Registered health check: ${name}`);

    // Run check immediately and periodically
    this.runHealthCheck(name, check);

    // Check every 60 seconds
    setInterval(() => {
      this.runHealthCheck(name, check);
    }, 60000);
  }

  /**
   * Run a health check
   */
  private async runHealthCheck(
    name: string,
    check: () => Promise<{
      status: 'healthy' | 'degraded' | 'unhealthy';
      message?: string;
      details?: Record<string, any>;
    }>
  ): Promise<void> {
    try {
      const result = await check();

      this.healthChecks.set(name, {
        name,
        status: result.status,
        message: result.message,
        lastCheck: Date.now(),
        details: result.details
      });

      if (result.status !== 'healthy') {
        log.warn(`Health check ${name}: ${result.status}`, {
          message: result.message,
          details: result.details
        });
      }
    } catch (error: any) {
      log.error(`Health check ${name} failed:`, error);

      this.healthChecks.set(name, {
        name,
        status: 'unhealthy',
        message: error.message,
        lastCheck: Date.now()
      });
    }
  }

  /**
   * Get all health checks
   */
  getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Get overall health status
   */
  getOverallHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: HealthCheck[];
  } {
    const checks = this.getHealthChecks();

    const hasUnhealthy = checks.some(c => c.status === 'unhealthy');
    const hasDegraded = checks.some(c => c.status === 'degraded');

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (hasUnhealthy) {
      status = 'unhealthy';
    } else if (hasDegraded) {
      status = 'degraded';
    }

    return { status, checks };
  }

  /**
   * Get metrics by name
   */
  getMetrics(
    name: string,
    since?: number,
    limit?: number
  ): Metric[] {
    let filtered = this.metrics.filter(m => m.name === name);

    if (since) {
      filtered = filtered.filter(m => m.timestamp >= since);
    }

    if (limit) {
      filtered = filtered.slice(-limit);
    }

    return filtered;
  }

  /**
   * Get metric summary
   */
  getMetricSummary(name: string, since?: number): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
  } | null {
    const metrics = this.getMetrics(name, since);

    if (metrics.length === 0) {
      return null;
    }

    const values = metrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: metrics.length,
      sum,
      avg: sum / metrics.length,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  /**
   * Get all metrics grouped by name
   */
  getAllMetrics(): Record<string, Metric[]> {
    const grouped: Record<string, Metric[]> = {};

    for (const metric of this.metrics) {
      if (!grouped[metric.name]) {
        grouped[metric.name] = [];
      }
      grouped[metric.name].push(metric);
    }

    return grouped;
  }

  /**
   * Export metrics to file
   */
  async exportMetrics(): Promise<void> {
    try {
      await fs.mkdir(this.metricsPath, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `metrics-${timestamp}.json`;
      const filepath = path.join(this.metricsPath, filename);

      const data = {
        exported_at: new Date().toISOString(),
        metrics: this.getAllMetrics(),
        health_checks: this.getHealthChecks(),
        summary: this.getSystemMetrics()
      };

      await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');

      log.info(`Metrics exported: ${filepath}`);
    } catch (error) {
      log.error('Failed to export metrics:', error);
    }
  }

  /**
   * Get system metrics summary
   */
  getSystemMetrics(): SystemMetrics {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Audit stats
    const totalAudits = this.getMetricSummary('audit.started', oneHourAgo)?.count || 0;
    const activeAudits = this.getMetricSummary('audit.active')?.count || 0;
    const completedAudits = this.getMetricSummary('audit.completed', oneHourAgo)?.count || 0;
    const failedAudits = this.getMetricSummary('audit.failed', oneHourAgo)?.count || 0;
    const avgDuration = this.getMetricSummary('audit.duration', oneHourAgo)?.avg || 0;

    // Cost stats
    const totalCost = this.getMetricSummary('cost.total', oneHourAgo)?.sum || 0;
    const avgCost = totalAudits > 0 ? totalCost / totalAudits : 0;
    const cacheSavings = this.getMetricSummary('cost.cache_savings_pct', oneHourAgo)?.avg || 0;

    // Performance stats
    const milestoneDurations: Record<number, number> = {};
    const avgTokens: Record<number, number> = {};

    for (let i = 1; i <= 5; i++) {
      const duration = this.getMetricSummary(`milestone.${i}.duration`, oneHourAgo)?.avg || 0;
      const tokens = this.getMetricSummary(`milestone.${i}.tokens`, oneHourAgo)?.avg || 0;

      milestoneDurations[i] = Math.round(duration);
      avgTokens[i] = Math.round(tokens);
    }

    return {
      timestamp: now,
      audit_stats: {
        total_audits: totalAudits,
        active_audits: activeAudits,
        completed_audits: completedAudits,
        failed_audits: failedAudits,
        avg_duration_seconds: Math.round(avgDuration)
      },
      cost_stats: {
        total_cost_usd: totalCost,
        avg_cost_per_audit: avgCost,
        cache_savings_percentage: cacheSavings
      },
      performance_stats: {
        milestone_durations: milestoneDurations,
        avg_tokens_per_milestone: avgTokens
      },
      health_checks: this.getHealthChecks()
    };
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(olderThan: number = 86400000): void {
    const cutoff = Date.now() - olderThan;
    const before = this.metrics.length;

    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);

    const removed = before - this.metrics.length;
    log.info(`Cleared ${removed} old metrics`);
  }
}

// Singleton instance
let observabilityService: ObservabilityService | null = null;

export function getObservabilityService(): ObservabilityService {
  if (!observabilityService) {
    observabilityService = new ObservabilityService();

    // Register default health checks
    observabilityService.registerHealthCheck('system', async () => {
      // Check system resources
      const memUsage = process.memoryUsage();
      const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const memPct = (memUsedMB / memTotalMB) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = `Memory: ${memUsedMB}MB / ${memTotalMB}MB (${memPct.toFixed(1)}%)`;

      if (memPct > 90) {
        status = 'unhealthy';
        message = `High memory usage: ${memPct.toFixed(1)}%`;
      } else if (memPct > 75) {
        status = 'degraded';
        message = `Elevated memory usage: ${memPct.toFixed(1)}%`;
      }

      return {
        status,
        message,
        details: {
          memory_used_mb: memUsedMB,
          memory_total_mb: memTotalMB,
          memory_percentage: Math.round(memPct)
        }
      };
    });

    // Auto-export metrics every hour
    setInterval(() => {
      observabilityService?.exportMetrics();
    }, 3600000);

    // Clear old metrics daily
    setInterval(() => {
      observabilityService?.clearOldMetrics();
    }, 86400000);
  }

  return observabilityService;
}

/**
 * Track audit lifecycle metrics
 */
export function trackAuditStart(jobId: string): void {
  const obs = getObservabilityService();
  obs.incrementCounter('audit.started', 1, { job_id: jobId });
  obs.incrementCounter('audit.active', 1);
}

export function trackAuditComplete(jobId: string, duration: number): void {
  const obs = getObservabilityService();
  obs.incrementCounter('audit.completed', 1, { job_id: jobId });
  obs.incrementCounter('audit.active', -1);
  obs.recordHistogram('audit.duration', duration, { job_id: jobId });
}

export function trackAuditFailed(jobId: string, error: string): void {
  const obs = getObservabilityService();
  obs.incrementCounter('audit.failed', 1, { job_id: jobId, error });
  obs.incrementCounter('audit.active', -1);
}

/**
 * Track milestone metrics
 */
export function trackMilestoneStart(milestone: number, jobId: string): void {
  const obs = getObservabilityService();
  obs.incrementCounter(`milestone.${milestone}.started`, 1, { job_id: jobId });
}

export function trackMilestoneComplete(
  milestone: number,
  jobId: string,
  duration: number,
  tokens: number
): void {
  const obs = getObservabilityService();
  obs.incrementCounter(`milestone.${milestone}.completed`, 1, { job_id: jobId });
  obs.recordHistogram(`milestone.${milestone}.duration`, duration, { job_id: jobId });
  obs.recordHistogram(`milestone.${milestone}.tokens`, tokens, { job_id: jobId });
}

/**
 * Track cost metrics
 */
export function trackCost(
  jobId: string,
  cost: number,
  cacheSavings: number
): void {
  const obs = getObservabilityService();
  obs.recordHistogram('cost.total', cost, { job_id: jobId });
  obs.setGauge('cost.cache_savings_pct', cacheSavings, { job_id: jobId });
}
