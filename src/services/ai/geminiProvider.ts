/**
 * Gemini Flash Provider for Quick Scans
 *
 * Uses Google's Gemini Flash model for fast, cost-effective vulnerability scanning.
 * This is optimized for quick scans - not the full audit pipeline.
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { logger } from '../../utils/logger.js';

const log = logger.child({ service: 'gemini-provider' });

// Configuration
const DEFAULT_TIMEOUT = 60000; // 60 seconds for quick scans
const DEFAULT_MODEL = 'gemini-2.0-flash'; // Fast and available on free tier

export interface GeminiOptions {
  timeout?: number;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GeminiResponse {
  success: boolean;
  output?: string;
  error?: string;
  errorType?: 'API_ERROR' | 'TIMEOUT' | 'INVALID_KEY' | 'RATE_LIMIT' | 'CONTENT_BLOCKED';
  executionTime?: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// Pricing per million tokens (Gemini Flash is very cheap)
const PRICING = {
  'gemini-2.0-flash': {
    input: 0.10 / 1_000_000,    // $0.10 per 1M input tokens
    output: 0.40 / 1_000_000,   // $0.40 per 1M output tokens
  },
  'gemini-1.5-flash': {
    input: 0.075 / 1_000_000,   // $0.075 per 1M input tokens
    output: 0.30 / 1_000_000,   // $0.30 per 1M output tokens
  },
  'gemini-1.5-flash-8b': {
    input: 0.0375 / 1_000_000,  // Even cheaper
    output: 0.15 / 1_000_000,
  },
  'gemini-1.5-pro': {
    input: 1.25 / 1_000_000,
    output: 5.0 / 1_000_000,
  }
};

let genAI: GoogleGenerativeAI | null = null;

/**
 * Initialize the Gemini client
 */
function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required for quick scans');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Execute a prompt using Gemini Flash
 */
export async function executeGemini(
  prompt: string,
  systemPrompt?: string,
  options: GeminiOptions = {}
): Promise<GeminiResponse> {
  const startTime = Date.now();
  const {
    timeout = DEFAULT_TIMEOUT,
    model = DEFAULT_MODEL,
    temperature = 0.2,
    maxOutputTokens = 8192
  } = options;

  log.info('Executing Gemini prompt', {
    model,
    promptLength: prompt.length,
    hasSystemPrompt: !!systemPrompt
  });

  try {
    const client = getClient();
    const generativeModel = client.getGenerativeModel({
      model,
      generationConfig: {
        temperature,
        maxOutputTokens,
        responseMimeType: 'application/json'
      },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    });

    // Build the full prompt
    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n---\n\n${prompt}`
      : prompt;

    // Execute with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), timeout);
    });

    const resultPromise = generativeModel.generateContent(fullPrompt);
    const result = await Promise.race([resultPromise, timeoutPromise]);

    const response = result.response;
    const text = response.text();
    const executionTime = Date.now() - startTime;

    // Get usage metadata if available
    const usageMetadata = response.usageMetadata;
    const usage = usageMetadata ? {
      inputTokens: usageMetadata.promptTokenCount || 0,
      outputTokens: usageMetadata.candidatesTokenCount || 0
    } : undefined;

    log.info('Gemini execution complete', {
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
    log.error('Gemini execution failed', { error: error.message, executionTime });

    let errorType: GeminiResponse['errorType'] = 'API_ERROR';
    if (error.message === 'TIMEOUT') {
      errorType = 'TIMEOUT';
    } else if (error.message?.includes('API key')) {
      errorType = 'INVALID_KEY';
    } else if (error.message?.includes('quota') || error.message?.includes('rate')) {
      errorType = 'RATE_LIMIT';
    } else if (error.message?.includes('blocked') || error.message?.includes('safety')) {
      errorType = 'CONTENT_BLOCKED';
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
 * Calculate cost for a Gemini request
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string = DEFAULT_MODEL
): number {
  const pricing = PRICING[model as keyof typeof PRICING] || PRICING['gemini-2.0-flash'];
  return (inputTokens * pricing.input) + (outputTokens * pricing.output);
}

/**
 * Check if Gemini is configured
 */
export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Get the default model for quick scans
 */
export function getDefaultModel(): string {
  return DEFAULT_MODEL;
}
