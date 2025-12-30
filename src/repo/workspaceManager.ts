import path from "node:path";
import fs from "fs-extra";
import { logger } from "../utils/logger.js";

const log = logger.child({ service: "workspace-manager" });

export interface WorkspaceInfo {
  repoPath: string;
  contextPath: string;
  runsPath: string;
}

/**
 * Manages ephemeral checkouts for specific commit SHAs.
 * workspaces/<org>/<repo>/<sha>/
 */
export async function createEphemeralWorkspace(
  org: string,
  repo: string,
  sha: string
): Promise<WorkspaceInfo> {
  const baseDir = path.resolve("workspaces", org, repo, sha);
  const repoPath = path.join(baseDir, "code");
  const contextPath = path.join(baseDir, "context");
  const runsPath = path.join(baseDir, "runs");

  log.info("Creating ephemeral workspace", { org, repo, sha, baseDir });

  await fs.ensureDir(repoPath);
  await fs.ensureDir(contextPath);
  await fs.ensureDir(runsPath);

  return { repoPath, contextPath, runsPath };
}

export async function cleanupWorkspace(org: string, repo: string, sha: string) {
  const baseDir = path.resolve("workspaces", org, repo, sha);
  log.info("Cleaning up workspace", { baseDir });
  await fs.remove(baseDir);
}

