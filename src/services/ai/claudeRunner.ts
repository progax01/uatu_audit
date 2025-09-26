import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "fs-extra";
import { runCmdLogged } from "../cmdLog.js";

const execAsync = promisify(exec);

export async function claudeChat(runPath: string, promptFile: string): Promise<string> {
  const fs = await import("fs-extra");
  
  // 1) Read prompt content from file
  const promptContent = await fs.readFile(promptFile, 'utf8');
  
  // Common Claude CLI flags for sandbox operations
  const commonFlags = [
    "--print",
    "--dangerously-skip-permissions", // Bypass permission checks for sandbox
    "--permission-mode", "sandboxBashMode", // Enable sandbox bash mode
    "--allowed-tools", "Bash Edit Read Write", // Allow necessary tools for test generation
    "--output-format", "text" // Ensure we get text output
  ];
  
  // 2) Try direct Claude CLI with sandbox permissions
  try {
    const out = await runCmdLogged(runPath, "claude", [
      ...commonFlags,
      promptContent
    ]);
    return out;
  } catch (error) {
    console.warn('Claude direct prompt with sandbox permissions failed:', error);
  }

  // 3) Try with explicit Claude path if available
  try {
    const claudePath = process.env.CLAUDE_CLI_PATH || "/Users/soneshwar/.nvm/versions/node/v23.10.0/bin/claude";
    const out = await runCmdLogged(runPath, claudePath, [
      ...commonFlags,
      promptContent
    ]);
    return out;
  } catch (error) {
    console.warn('Claude with explicit path and sandbox permissions failed:', error);
  }

  // 4) Try with stdin pipe as fallback
  try {
    const claudeCmd = `claude ${commonFlags.slice(0, -1).join(' ')} --print`; // exclude prompt content from flags
    const out = await runCmdLogged(runPath, "bash", [
      "-c",
      `echo ${JSON.stringify(promptContent)} | ${claudeCmd}`
    ]);
    return out;
  } catch (error) {
    console.warn('Claude stdin pipe with sandbox permissions failed:', error);
  }

  // 5) Try basic mode without sandbox permissions as last resort
  try {
    const out = await runCmdLogged(runPath, "claude", [
      "--print",
      promptContent
    ]);
    return out;
  } catch (error) {
    console.warn('Claude basic mode failed:', error);
  }

  // 6) Last resort: fail with clear error
  throw new Error("Claude CLI failed with all attempted configurations. Check that Claude CLI is installed and accessible.");
}
