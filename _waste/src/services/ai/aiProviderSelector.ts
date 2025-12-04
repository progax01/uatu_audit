import { logger } from "../../utils/logger.js";
import { checkCLIAvailable } from "./claudeCLIProvider.js";

const log = logger.child({ service: "ai-provider-selector" });

/**
 * Simplified AI provider selector
 * Only supports Claude CLI in the new single-prompt architecture
 */
export async function isAnyAIProviderAvailable(): Promise<boolean> {
  // Check if Claude CLI is available
  const cliAvailable = checkCLIAvailable();

  if (cliAvailable) {
    log.info("Claude CLI is available");
    return true;
  }

  log.warn("No AI providers available - Claude CLI not found");
  return false;
}

/**
 * Check if Claude CLI is available
 */
export function isClaudeCLIAvailable(): boolean {
  return checkCLIAvailable();
}
