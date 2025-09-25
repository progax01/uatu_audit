import path from "node:path";
import fs from "fs-extra";
import { getUatuHome } from "../constants/paths.js";

export async function resolveWorkspace(project: string, branch: string) {
  const workspaceRoot = path.join(getUatuHome(), "workspace");
  const branchPath = path.join(workspaceRoot, project, branch);
  const contextPath = path.join(branchPath, ".uatu", "context");
  const sopPath = path.join(branchPath, ".uatu", "sop");
  const runsPath = path.join(branchPath, "runs");
  
  await fs.ensureDir(branchPath);
  await fs.ensureDir(contextPath);
  await fs.ensureDir(sopPath);
  await fs.ensureDir(runsPath);
  
  return { branchPath, contextPath, sopPath, runsPath };
}
