import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "fs-extra";
import { logger } from "../utils/logger.js";

const execPromise = promisify(exec);
const log = logger.child({ service: "fingerprint-orchestrator" });

export interface ProjectFingerprint {
  shape: string;
  has_node: boolean;
  pkg_manager: string;
  has_solidity: boolean;
  solidity_framework: string;
  timestamp: string;
}

/**
 * Runs deterministic shell scripts to detect project framework and shape.
 */
export async function detectProjectFingerprint(projectPath: string): Promise<ProjectFingerprint> {
  const scriptPath = path.resolve("scripts/detect/99_emit_fingerprint.sh");
  
  log.info("Running fingerprint detection", { projectPath, scriptPath });

  try {
    const { stdout } = await execPromise(\`bash "\${scriptPath}"\`, {
      cwd: projectPath,
      timeout: 30000, // 30s
    });

    const fingerprint = JSON.parse(stdout) as ProjectFingerprint;
    log.info("Fingerprint detected", fingerprint);
    return fingerprint;
  } catch (error: any) {
    log.error("Fingerprint detection failed", { error: error.message });
    throw new Error(\`Failed to detect project fingerprint: \${error.message}\`);
  }
}

export async function saveFingerprint(contextPath: string, fingerprint: ProjectFingerprint) {
  const filePath = path.join(contextPath, "fingerprint.json");
  await fs.writeJson(filePath, fingerprint, { spaces: 2 });
}

