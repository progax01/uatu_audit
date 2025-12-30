import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { logger } from "../utils/logger.js";

const execPromise = promisify(exec);
const log = logger.child({ service: "scanner-runner" });

export async function runDeterministicScanners(projectPath: string): Promise<string> {
  log.info("Running deterministic scanners", { projectPath });
  
  try {
    // Run the scanners script
    const scriptPath = path.resolve("scripts/run/security_scanners.sh");
    const { stdout, stderr } = await execPromise(`bash "${scriptPath}"`, {
      cwd: projectPath,
      timeout: 5 * 60 * 1000, // 5 minutes
    });
    
    if (stderr) {
      log.warn("Scanner script produced stderr", { stderr });
    }
    
    return stdout;
  } catch (error: any) {
    log.error("Failed to run scanners", { error: error.message });
    return `Error running scanners: ${error.message}`;
  }
}
