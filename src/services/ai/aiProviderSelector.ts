import { logger } from "../../utils/logger.js";
import { ClaudeAIProvider } from "./claudeProvider.js";
import { AnthropicAPIProvider } from "./anthropicAPIProvider.js";
import { getClaudeCaps } from "./claudeCaps.js";
import type { AITestGenerationRequest, AITestGenerationResult } from "./claudeProvider.js";

const log = logger.child({ service: 'ai-provider-selector' });

export type AIProviderType = 'anthropic' | 'cli' | 'none';

export interface AIProvider {
  generateTests(request: AITestGenerationRequest): Promise<AITestGenerationResult>;
  name: string;
  available: boolean;
}

/**
 * Selects the best available AI provider based on configuration and availability
 */
export async function selectAIProvider(runPath: string, autoAccept: boolean = false): Promise<AIProvider | null> {
  const providerOrder = getProviderOrder();
  
  for (const providerType of providerOrder) {
    try {
      const provider = await createProvider(providerType, runPath, autoAccept);
      if (provider && provider.available) {
        log.info(`Selected AI provider: ${provider.name}`, { type: providerType });
        return provider;
      }
    } catch (error) {
      log.debug(`Failed to create provider: ${providerType}`, { error: String(error) });
    }
  }
  
  log.warn('No AI providers available');
  return null;
}

/**
 * Get provider order from environment configuration
 */
function getProviderOrder(): AIProviderType[] {
  const orderEnv = process.env.UATU_AI_PROVIDER_ORDER || 'anthropic,cli';
  const providers = orderEnv.split(',').map(p => p.trim().toLowerCase()) as AIProviderType[];
  
  // Validate and filter valid providers
  const validProviders = providers.filter(p => ['anthropic', 'cli', 'none'].includes(p));
  
  if (validProviders.length === 0) {
    log.warn('No valid providers in UATU_AI_PROVIDER_ORDER, defaulting to anthropic,cli');
    return ['anthropic', 'cli'];
  }
  
  return validProviders;
}

/**
 * Create and validate a specific AI provider
 */
async function createProvider(type: AIProviderType, runPath: string, autoAccept: boolean): Promise<AIProvider | null> {
  switch (type) {
    case 'anthropic':
      if (!process.env.ANTHROPIC_API_KEY) {
        log.debug('Anthropic API key not available');
        return null;
      }
      return new AnthropicAPIProvider(runPath, autoAccept);
      
    case 'cli':
      const claudeCaps = await getClaudeCaps();
      if (!claudeCaps.available) {
        log.debug('Claude CLI not available');
        return null;
      }
      return new ClaudeAIProvider(runPath, autoAccept);
      
    case 'none':
      log.info('AI provider explicitly disabled');
      return null;
      
    default:
      log.warn(`Unknown provider type: ${type}`);
      return null;
  }
}

/**
 * Check if any AI provider is available without creating instances
 */
export async function isAnyAIProviderAvailable(): Promise<boolean> {
  const providerOrder = getProviderOrder();
  
  for (const type of providerOrder) {
    switch (type) {
      case 'anthropic':
        if (process.env.ANTHROPIC_API_KEY) return true;
        break;
      case 'cli':
        const claudeCaps = await getClaudeCaps();
        if (claudeCaps.available) return true;
        break;
      case 'none':
        return false;
    }
  }
  
  return false;
}
