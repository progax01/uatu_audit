import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'cost-control' });

/**
 * Cost Control & Budget System
 * Tracks token usage, costs, and enforces budget limits
 */

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
}

export interface CostEstimate {
  input_cost: number;
  output_cost: number;
  cache_creation_cost: number;
  cache_read_cost: number;
  total_cost: number;
}

export interface AuditBudget {
  max_cost_usd: number;
  max_tokens: number;
  warn_at_percentage: number; // e.g., 80 = warn at 80% of budget
  hard_stop: boolean; // Stop audit if budget exceeded
}

export interface BudgetStatus {
  budget: AuditBudget;
  current_cost: number;
  current_tokens: number;
  percentage_used: number;
  remaining_cost: number;
  remaining_tokens: number;
  warning_triggered: boolean;
  budget_exceeded: boolean;
}

export interface CostRecord {
  timestamp: string;
  job_id: string;
  milestone?: number;
  operation: string;
  tokens: TokenUsage;
  cost: CostEstimate;
  model: string;
}

// Claude 3.5 Sonnet pricing (as of Dec 2025)
const PRICING = {
  'claude-3-5-sonnet-20241022': {
    input: 3.0 / 1_000_000, // $3 per MTok
    output: 15.0 / 1_000_000, // $15 per MTok
    cache_creation: 3.75 / 1_000_000, // $3.75 per MTok
    cache_read: 0.30 / 1_000_000 // $0.30 per MTok (90% discount)
  },
  'claude-3-5-haiku-20241022': {
    input: 1.0 / 1_000_000, // $1 per MTok
    output: 5.0 / 1_000_000, // $5 per MTok
    cache_creation: 1.25 / 1_000_000,
    cache_read: 0.10 / 1_000_000
  }
};

const DEFAULT_BUDGET: AuditBudget = {
  max_cost_usd: 10.0, // $10 default budget
  max_tokens: 5_000_000, // 5M tokens
  warn_at_percentage: 80,
  hard_stop: true
};

export class CostControlService {
  private budget: AuditBudget;
  private records: CostRecord[] = [];
  private totalCost: number = 0;
  private totalTokens: number = 0;
  private jobId: string;
  private recordsPath: string;

  constructor(jobId: string, budget?: Partial<AuditBudget>) {
    this.jobId = jobId;
    this.budget = { ...DEFAULT_BUDGET, ...budget };
    this.recordsPath = path.join('.state', 'costs', `${jobId}-costs.json`);
    log.info(`Cost control initialized for ${jobId}`, {
      budget: this.budget
    });
  }

  /**
   * Calculate cost from token usage
   */
  calculateCost(tokens: TokenUsage, model: string = 'claude-3-5-sonnet-20241022'): CostEstimate {
    const pricing = (PRICING as Record<string, typeof PRICING['claude-3-5-sonnet-20241022']>)[model] || PRICING['claude-3-5-sonnet-20241022'];

    const input_cost = tokens.input_tokens * pricing.input;
    const output_cost = tokens.output_tokens * pricing.output;
    const cache_creation_cost = (tokens.cache_creation_tokens || 0) * pricing.cache_creation;
    const cache_read_cost = (tokens.cache_read_tokens || 0) * pricing.cache_read;

    const total_cost = input_cost + output_cost + cache_creation_cost + cache_read_cost;

    return {
      input_cost,
      output_cost,
      cache_creation_cost,
      cache_read_cost,
      total_cost
    };
  }

  /**
   * Record token usage and check budget
   */
  async recordUsage(
    operation: string,
    tokens: TokenUsage,
    model: string = 'claude-3-5-sonnet-20241022',
    milestone?: number
  ): Promise<BudgetStatus> {
    const cost = this.calculateCost(tokens, model);

    // Create record
    const record: CostRecord = {
      timestamp: new Date().toISOString(),
      job_id: this.jobId,
      milestone,
      operation,
      tokens,
      cost,
      model
    };

    this.records.push(record);

    // Update totals
    this.totalCost += cost.total_cost;
    this.totalTokens +=
      tokens.input_tokens +
      tokens.output_tokens +
      (tokens.cache_creation_tokens || 0) +
      (tokens.cache_read_tokens || 0);

    log.info(`Usage recorded: ${operation}`, {
      cost: cost.total_cost.toFixed(4),
      tokens: this.totalTokens,
      milestone
    });

    // Check budget
    const status = this.getBudgetStatus();

    // Warning threshold
    if (status.warning_triggered && !this.hasWarned) {
      this.hasWarned = true;
      log.warn(
        `⚠️  Budget warning: ${status.percentage_used.toFixed(1)}% used`,
        {
          current_cost: status.current_cost,
          remaining_cost: status.remaining_cost
        }
      );
    }

    // Budget exceeded
    if (status.budget_exceeded) {
      log.error('❌ Budget exceeded!', {
        current_cost: status.current_cost,
        budget: this.budget.max_cost_usd
      });

      if (this.budget.hard_stop) {
        throw new Error(
          `Budget exceeded: $${status.current_cost.toFixed(2)} > $${this.budget.max_cost_usd.toFixed(2)}`
        );
      }
    }

    // Save records periodically
    await this.saveRecords();

    return status;
  }

  private hasWarned: boolean = false;

  /**
   * Get current budget status
   */
  getBudgetStatus(): BudgetStatus {
    const percentage_used = (this.totalCost / this.budget.max_cost_usd) * 100;
    const warning_triggered = percentage_used >= this.budget.warn_at_percentage;
    const budget_exceeded = this.totalCost >= this.budget.max_cost_usd;

    return {
      budget: this.budget,
      current_cost: this.totalCost,
      current_tokens: this.totalTokens,
      percentage_used,
      remaining_cost: Math.max(0, this.budget.max_cost_usd - this.totalCost),
      remaining_tokens: Math.max(0, this.budget.max_tokens - this.totalTokens),
      warning_triggered,
      budget_exceeded
    };
  }

  /**
   * Estimate cost for a prompt
   */
  estimateCost(
    promptLength: number,
    estimatedOutputLength: number = 2000,
    model: string = 'claude-3-5-sonnet-20241022',
    cacheHitRate: number = 0.8 // Assume 80% cache hit with 4-layer caching
  ): CostEstimate {
    const pricing = (PRICING as Record<string, typeof PRICING['claude-3-5-sonnet-20241022']>)[model] || PRICING['claude-3-5-sonnet-20241022'];

    // Estimate tokens (roughly 4 chars per token)
    const inputTokens = Math.ceil(promptLength / 4);
    const outputTokens = Math.ceil(estimatedOutputLength / 4);

    // With caching, some input tokens are cache reads
    const cacheReadTokens = Math.floor(inputTokens * cacheHitRate);
    const normalInputTokens = inputTokens - cacheReadTokens;

    const tokens: TokenUsage = {
      input_tokens: normalInputTokens,
      output_tokens: outputTokens,
      cache_read_tokens: cacheReadTokens
    };

    return this.calculateCost(tokens, model);
  }

  /**
   * Check if operation is within budget
   */
  async canAfford(
    operation: string,
    estimatedCost: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    const projected = this.totalCost + estimatedCost;

    if (projected > this.budget.max_cost_usd) {
      return {
        allowed: false,
        reason: `Operation would exceed budget: $${projected.toFixed(2)} > $${this.budget.max_cost_usd.toFixed(2)}`
      };
    }

    return { allowed: true };
  }

  /**
   * Get cost breakdown by milestone
   */
  getCostByMilestone(): Record<number, CostEstimate> {
    const breakdown: Record<number, CostEstimate> = {};

    for (const record of this.records) {
      if (record.milestone) {
        if (!breakdown[record.milestone]) {
          breakdown[record.milestone] = {
            input_cost: 0,
            output_cost: 0,
            cache_creation_cost: 0,
            cache_read_cost: 0,
            total_cost: 0
          };
        }

        breakdown[record.milestone].input_cost += record.cost.input_cost;
        breakdown[record.milestone].output_cost += record.cost.output_cost;
        breakdown[record.milestone].cache_creation_cost += record.cost.cache_creation_cost;
        breakdown[record.milestone].cache_read_cost += record.cost.cache_read_cost;
        breakdown[record.milestone].total_cost += record.cost.total_cost;
      }
    }

    return breakdown;
  }

  /**
   * Get savings from caching
   */
  getCacheSavings(): {
    actual_cost: number;
    cost_without_cache: number;
    savings: number;
    savings_percentage: number;
  } {
    let actual_cost = 0;
    let cost_without_cache = 0;

    for (const record of this.records) {
      actual_cost += record.cost.total_cost;

      // Calculate what it would cost without caching
      const pricing = (PRICING as Record<string, typeof PRICING['claude-3-5-sonnet-20241022']>)[record.model] || PRICING['claude-3-5-sonnet-20241022'];
      const cache_read_tokens = record.tokens.cache_read_tokens || 0;

      // Cache reads would be full-price input without caching
      cost_without_cache +=
        record.cost.input_cost +
        record.cost.output_cost +
        cache_read_tokens * pricing.input;
    }

    const savings = cost_without_cache - actual_cost;
    const savings_percentage = cost_without_cache > 0
      ? (savings / cost_without_cache) * 100
      : 0;

    return {
      actual_cost,
      cost_without_cache,
      savings,
      savings_percentage
    };
  }

  /**
   * Get cost summary
   */
  getSummary(): {
    total_cost: number;
    total_tokens: number;
    operations_count: number;
    avg_cost_per_operation: number;
    budget_status: BudgetStatus;
    cache_savings: ReturnType<CostControlService['getCacheSavings']>;
    breakdown_by_milestone: Record<number, CostEstimate>;
  } {
    return {
      total_cost: this.totalCost,
      total_tokens: this.totalTokens,
      operations_count: this.records.length,
      avg_cost_per_operation: this.records.length > 0 ? this.totalCost / this.records.length : 0,
      budget_status: this.getBudgetStatus(),
      cache_savings: this.getCacheSavings(),
      breakdown_by_milestone: this.getCostByMilestone()
    };
  }

  /**
   * Save cost records to disk
   */
  async saveRecords(): Promise<void> {
    try {
      const dir = path.dirname(this.recordsPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(
        this.recordsPath,
        JSON.stringify({
          job_id: this.jobId,
          budget: this.budget,
          summary: this.getSummary(),
          records: this.records
        }, null, 2),
        'utf-8'
      );
    } catch (error) {
      log.error('Failed to save cost records:', error);
    }
  }

  /**
   * Load cost records from disk
   */
  async loadRecords(): Promise<void> {
    try {
      const content = await fs.readFile(this.recordsPath, 'utf-8');
      const data = JSON.parse(content);

      this.records = data.records || [];
      this.budget = data.budget || this.budget;

      // Recalculate totals
      this.totalCost = 0;
      this.totalTokens = 0;

      for (const record of this.records) {
        this.totalCost += record.cost.total_cost;
        this.totalTokens +=
          record.tokens.input_tokens +
          record.tokens.output_tokens +
          (record.tokens.cache_creation_tokens || 0) +
          (record.tokens.cache_read_tokens || 0);
      }

      log.info('Cost records loaded', {
        total_cost: this.totalCost,
        records_count: this.records.length
      });
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        log.error('Failed to load cost records:', error);
      }
    }
  }
}

// Global cost control registry
const costControlRegistry = new Map<string, CostControlService>();

export function getCostControl(
  jobId: string,
  budget?: Partial<AuditBudget>
): CostControlService {
  if (!costControlRegistry.has(jobId)) {
    costControlRegistry.set(jobId, new CostControlService(jobId, budget));
  }
  return costControlRegistry.get(jobId)!;
}

export function clearCostControl(jobId: string): void {
  costControlRegistry.delete(jobId);
}

export function getAllCostControls(): Map<string, CostControlService> {
  return costControlRegistry;
}
