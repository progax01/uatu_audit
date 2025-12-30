import path from "node:path";
import fs from "fs-extra";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "../utils/logger.js";

const execPromise = promisify(exec);
const log = logger.child({ service: "toolchain-service" });

export interface ToolRequirement {
  name: string;
  version?: string;
  downloadUrl?: string;
}

export class ToolchainService {
  private binPath: string;

  constructor(projectPath: string) {
    this.binPath = path.join(projectPath, ".uatu", "bin");
  }

  /**
   * Ensures the .uatu/bin directory exists and is in the PATH for child processes.
   */
  async init() {
    await fs.ensureDir(this.binPath);
    log.info("Toolchain initialized", { binPath: this.binPath });
  }

  /**
   * Checks if a tool is available in the local .uatu/bin or system path.
   */
  async isToolAvailable(name: string): Promise<boolean> {
    const localPath = path.join(this.binPath, name);
    if (await fs.pathExists(localPath)) return true;

    try {
      await execPromise(\`which \${name}\`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns an environment object with .uatu/bin prepended to the PATH.
   */
  getEnvWithLocalBin(): NodeJS.ProcessEnv {
    const pathDelimiter = process.platform === "win32" ? ";" : ":";
    return {
      ...process.env,
      PATH: \`\${this.binPath}\${pathDelimiter}\${process.env.PATH}\`,
    };
  }

  /**
   * Mock for downloading a tool. In a real scenario, this would fetch from a URL.
   */
  async installTool(tool: ToolRequirement) {
    log.info("Installing tool", tool);
    // Real implementation would use fetch and stream to this.binPath
    // For now, we'll assume tools are pre-installed or handled by host
    if (await this.isToolAvailable(tool.name)) {
      log.info("Tool already available", { name: tool.name });
      return;
    }
    
    log.warn("Automatic tool download not implemented. Please ensure tool is in PATH.", { name: tool.name });
  }
}

