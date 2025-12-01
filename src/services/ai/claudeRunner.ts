import fs from "fs-extra";
import { executeClaude } from "./claudeCLIProvider.js";

/**
 * Execute Claude CLI with a prompt from a file
 * This is a wrapper around the robust claudeCLIProvider
 */
export async function claudeChat(runPath: string, promptFile: string, jobId?: number): Promise<string> {
  // Read prompt content from file
  const promptContent = await fs.readFile(promptFile, 'utf8');

  // Additional flags for sandbox operations
  const flags = [
    "--permission-mode", "bypassPermissions", // Bypass permission prompts for automated execution
    "--allowed-tools", "Bash Edit Read Write", // Allow necessary tools for test generation
    "--output-format", "text" // Ensure we get text output
  ];

  // Use the robust claudeCLIProvider which handles:
  // - Retry logic with exponential backoff
  // - Timeout management
  // - Proper error handling
  // - Process cleanup
  // - Concurrency control
  const result = await executeClaude(promptContent, {
    cwd: runPath,
    flags,
    jobId // Pass jobId for process cancellation support
  });

  return result;
}
