/**
 * Claude Haiku Provider for Quick Scans
 *
 * Uses Anthropic's Claude Haiku model for fast, cost-effective vulnerability scanning.
 * Much more reliable than Gemini's free tier.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../utils/logger.js';

const log = logger.child({ service: 'haiku-provider' });

// Configuration
const DEFAULT_TIMEOUT = 60000; // 60 seconds for quick scans
const DEFAULT_MODEL = 'claude-3-5-haiku-20241022'; // Fast and cheap

export interface HaikuOptions {
  timeout?: number;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface HaikuResponse {
  success: boolean;
  output?: string;
  error?: string;
  errorType?: 'API_ERROR' | 'TIMEOUT' | 'INVALID_KEY' | 'RATE_LIMIT';
  executionTime?: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// Pricing per million tokens
const PRICING = {
  'claude-3-5-haiku-20241022': {
    input: 1.00 / 1_000_000,    // $1.00 per 1M input tokens
    output: 5.00 / 1_000_000,   // $5.00 per 1M output tokens
  },
  'claude-3-haiku-20240307': {
    input: 0.25 / 1_000_000,    // $0.25 per 1M input tokens
    output: 1.25 / 1_000_000,   // $1.25 per 1M output tokens
  }
};

let anthropic: Anthropic | null = null;

/**
 * Initialize the Anthropic client
 */
function getClient(): Anthropic {
  if (!anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for quick scans');
    }
    anthropic = new Anthropic({ apiKey });
  }
  return anthropic;
}

/**
 * Execute a prompt using Claude Haiku
 */
export async function executeHaiku(
  prompt: string,
  systemPrompt?: string,
  options: HaikuOptions = {}
): Promise<HaikuResponse> {
  const startTime = Date.now();
  const {
    timeout = DEFAULT_TIMEOUT,
    model = DEFAULT_MODEL,
    temperature = 0.2,
    maxOutputTokens = 4096
  } = options;

  log.info('Executing Haiku prompt', {
    model,
    promptLength: prompt.length,
    hasSystemPrompt: !!systemPrompt
  });

  try {
    const client = getClient();

    // Execute with timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const message = await client.messages.create({
      model,
      max_tokens: maxOutputTokens,
      system: systemPrompt || '',
      messages: [{ role: 'user', content: prompt }],
    });

    clearTimeout(timeoutId);

    const executionTime = Date.now() - startTime;

    // Extract text from response
    const textBlock = message.content.find(block => block.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';

    // Get usage
    const usage = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens
    };

    log.info('Haiku execution complete', {
      model,
      executionTime,
      outputLength: text.length,
      usage
    });

    return {
      success: true,
      output: text,
      executionTime,
      usage
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    log.error('Haiku execution failed', { error: error.message, executionTime });

    let errorType: HaikuResponse['errorType'] = 'API_ERROR';
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      errorType = 'TIMEOUT';
    } else if (error.message?.includes('API key') || error.status === 401) {
      errorType = 'INVALID_KEY';
    } else if (error.message?.includes('rate') || error.status === 429) {
      errorType = 'RATE_LIMIT';
    }

    return {
      success: false,
      error: error.message,
      errorType,
      executionTime
    };
  }
}

/**
 * Calculate cost for a Haiku request
 */
export function calculateHaikuCost(
  inputTokens: number,
  outputTokens: number,
  model: string = DEFAULT_MODEL
): number {
  const pricing = PRICING[model as keyof typeof PRICING] || PRICING['claude-3-5-haiku-20241022'];
  return (inputTokens * pricing.input) + (outputTokens * pricing.output);
}

/**
 * Check if Haiku is configured
 */
export function isHaikuConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Get the default model for quick scans
 */
export function getDefaultModel(): string {
  return DEFAULT_MODEL;
}
