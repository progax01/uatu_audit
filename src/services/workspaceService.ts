import path from "node:path";
import fs from "fs-extra";
import { getUatuHome, getUserId } from "../constants/paths.js";

export interface WorkspaceLayout {
  projectPath: string;    // where the repo is cloned
  branchPath: string;     // alias for projectPath (legacy compatibility)
  contextPath: string;    // .uatu/context
  sopPath: string;        // .uatu/sop
  runsPath: string;       // runs/
}

/**
 * Resolves the complete workspace layout for a project/branch combination
 */
export async function resolveWorkspace(project: string, branch: string): Promise<WorkspaceLayout> {
  const base = path.join(getUatuHome(), "workspace", "users", getUserId(), "projects", project, "branches", branch);
  const projectPath = base;
  const contextPath = path.join(base, ".uatu", "context");
  const sopPath = path.join(base, ".uatu", "sop");
  const runsPath = path.join(base, "runs");

  // Ensure directories exist
  await fs.ensureDir(contextPath);
  await fs.ensureDir(sopPath);
  await fs.ensureDir(runsPath);

  return {
    projectPath,
    branchPath: projectPath, // legacy alias
    contextPath,
    sopPath,
    runsPath
  };
}