import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "fs-extra";
import { runCmdLogged } from "../cmdLog.js";

const execAsync = promisify(exec);

export async function claudeChat(runPath: string, promptFile: string): Promise<string> {
  // 1) Try stdin pipe: works across CLI variants
  try {
    const out = await runCmdLogged(runPath, "bash", [
      "-lc",
      `cat ${JSON.stringify(promptFile)} | claude chat --auto-accept`
    ]);
    return out;
  } catch (error) {
    console.warn('Claude stdin pipe failed:', error);
  }

  // 2) Try --input-file if available
  try {
    const { stdout: help } = await execAsync("claude chat --help");
    if (help.includes("--input-file")) {
      const out = await runCmdLogged(runPath, "claude", [
        "chat", "--auto-accept", "--input-file", promptFile
      ]);
      return out;
    }
  } catch (error) {
    console.warn('Claude --input-file check failed:', error);
  }

  // 3) Last resort: --ide (interactive) is not suitable for CI; fail with clear error
  throw new Error("Claude CLI doesn't support stdin/--input-file on this host. Please update CLI or install a supported version.");
}
