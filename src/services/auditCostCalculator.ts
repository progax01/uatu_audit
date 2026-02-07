/**
 * Audit Cost Calculator Service
 *
 * Calculates Neurons token costs for audits based on:
 * 1. Lines of Code (SLOC) analyzed
 * 2. AI/Agentic tokens consumed during audit execution
 */

import { db } from '../db/index.js';
import { tokenPricingConfig } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { DEFAULT_PRICING } from '../constants/neuronsToken.js';
import log from '../utils/logger.js';

export interface AuditCostEstimate {
  estimatedSloc: number;
  estimatedAiTokens: number;
  slocCostNeurons: number;
  aiTokensCostNeurons: number;
  totalEstimatedCostNeurons: number;
  reservationAmount: number; // With buffer
  bufferMultiplier: number;
}

export interface AuditActualCost {
  actualSloc: number;
  actualAiTokens: number;
  slocCostNeurons: number;
  aiTokensCostNeurons: number;
  totalActualCostNeurons: number;
}

/**
 * Get current pricing configuration from database
 * Falls back to default pricing if not found
 */
export async function getPricingConfig(): Promise<{
  neuronsPerSloc: number;
  neuronsPerK1AiTokens: number;
  reservationBufferPercent: number;
}> {
  try {
    const configs = await db.select().from(tokenPricingConfig).where(eq(tokenPricingConfig.isActive, true));

    const configMap = configs.reduce((acc, config) => {
      acc[config.configKey] = Number(config.configValue);
      return acc;
    }, {} as Record<string, number>);

    // Calculate neurons per SLOC (multiplier / divisor)
    const multiplier = configMap['neurons_per_sloc_multiplier'] || 1;
    const divisor = configMap['neurons_per_sloc_divisor'] || 1000;
    const neuronsPerSloc = multiplier / divisor;

    return {
      neuronsPerSloc,
      neuronsPerK1AiTokens: configMap['neurons_per_1k_ai_tokens'] || DEFAULT_PRICING.NEURONS_PER_1K_AI_TOKENS,
      reservationBufferPercent: configMap['reservation_buffer_percent'] || 150,
    };
  } catch (error) {
    log.error('Failed to fetch pricing config, using defaults', { error });
    return {
      neuronsPerSloc: DEFAULT_PRICING.NEURONS_PER_LOC,
      neuronsPerK1AiTokens: DEFAULT_PRICING.NEURONS_PER_1K_AI_TOKENS,
      reservationBufferPercent: 150,
    };
  }
}

/**
 * Estimate audit cost before starting
 *
 * @param estimatedSloc - Estimated lines of code (can be from quick analysis or user input)
 * @param estimatedAiTokens - Estimated AI tokens (based on project complexity)
 */
export async function estimateAuditCost(
  estimatedSloc: number,
  estimatedAiTokens: number
): Promise<AuditCostEstimate> {
  const pricing = await getPricingConfig();

  // Calculate cost components
  const slocCostNeurons = estimatedSloc * pricing.neuronsPerSloc;
  const aiTokensCostNeurons = (estimatedAiTokens / 1000) * pricing.neuronsPerK1AiTokens;
  const totalEstimatedCostNeurons = slocCostNeurons + aiTokensCostNeurons;

  // Calculate reservation amount with buffer
  const bufferMultiplier = pricing.reservationBufferPercent / 100;
  const reservationAmount = totalEstimatedCostNeurons * bufferMultiplier;

  log.info('Estimated audit cost', {
    estimatedSloc,
    estimatedAiTokens,
    slocCostNeurons: slocCostNeurons.toFixed(4),
    aiTokensCostNeurons: aiTokensCostNeurons.toFixed(4),
    totalEstimatedCostNeurons: totalEstimatedCostNeurons.toFixed(4),
    reservationAmount: reservationAmount.toFixed(4),
  });

  return {
    estimatedSloc,
    estimatedAiTokens,
    slocCostNeurons,
    aiTokensCostNeurons,
    totalEstimatedCostNeurons,
    reservationAmount: Math.ceil(reservationAmount), // Round up to avoid rounding issues
    bufferMultiplier,
  };
}

/**
 * Calculate actual audit cost after completion
 *
 * @param actualSloc - Actual lines of code analyzed
 * @param actualAiTokens - Actual AI tokens consumed
 */
export async function calculateActualCost(
  actualSloc: number,
  actualAiTokens: number
): Promise<AuditActualCost> {
  const pricing = await getPricingConfig();

  // Calculate cost components
  const slocCostNeurons = actualSloc * pricing.neuronsPerSloc;
  const aiTokensCostNeurons = (actualAiTokens / 1000) * pricing.neuronsPerK1AiTokens;
  const totalActualCostNeurons = slocCostNeurons + aiTokensCostNeurons;

  log.info('Calculated actual audit cost', {
    actualSloc,
    actualAiTokens,
    slocCostNeurons: slocCostNeurons.toFixed(4),
    aiTokensCostNeurons: aiTokensCostNeurons.toFixed(4),
    totalActualCostNeurons: totalActualCostNeurons.toFixed(4),
  });

  return {
    actualSloc,
    actualAiTokens,
    slocCostNeurons,
    aiTokensCostNeurons,
    totalActualCostNeurons,
  };
}

/**
 * Estimate SLOC for a project (quick heuristic)
 * This is a rough estimate based on project type and repo size
 *
 * TODO: Implement more sophisticated SLOC estimation
 * - Clone repo and run tokei/cloc
 * - Analyze file structure
 * - Use GitHub API for language stats
 */
export async function estimateProjectSloc(projectType: string, repoUrl?: string): Promise<number> {
  // Simple heuristics for now
  const estimates: Record<string, number> = {
    'quick': 500,           // Quick scan - single contract
    'contract-only': 2000,  // Contract-only - medium project
    'full': 5000,           // Full audit - larger project
    'dapp-pentest': 8000,   // dApp - includes frontend
    'library-audit': 3000,  // Library - medium complexity
  };

  const estimate = estimates[projectType] || 3000;

  log.info('Estimated project SLOC', { projectType, repoUrl, estimate });

  return estimate;
}

/**
 * Estimate AI tokens for a project
 * Based on SLOC and audit depth
 *
 * Rule of thumb:
 * - ~100 AI tokens per SLOC for deep analysis
 * - Includes context building, analysis, report generation
 */
export function estimateAiTokensForSloc(sloc: number, auditDepth: 'quick' | 'standard' | 'deep' = 'standard'): number {
  const tokensPerSloc: Record<string, number> = {
    quick: 50,      // Quick scan - minimal analysis
    standard: 100,  // Standard - thorough analysis
    deep: 200,      // Deep - extensive analysis + clarifications
  };

  const estimate = sloc * tokensPerSloc[auditDepth];

  log.info('Estimated AI tokens', { sloc, auditDepth, estimate });

  return estimate;
}

/**
 * Get full cost breakdown with detailed information
 */
export async function getFullCostBreakdown(
  sloc: number,
  aiTokens: number
): Promise<{
  estimate: AuditCostEstimate;
  pricing: Awaited<ReturnType<typeof getPricingConfig>>;
  breakdown: {
    slocPercentage: number;
    aiTokensPercentage: number;
  };
}> {
  const pricing = await getPricingConfig();
  const estimate = await estimateAuditCost(sloc, aiTokens);

  const slocPercentage = (estimate.slocCostNeurons / estimate.totalEstimatedCostNeurons) * 100;
  const aiTokensPercentage = (estimate.aiTokensCostNeurons / estimate.totalEstimatedCostNeurons) * 100;

  return {
    estimate,
    pricing,
    breakdown: {
      slocPercentage,
      aiTokensPercentage,
    },
  };
}
