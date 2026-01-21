import fs from "fs-extra";
import path from "node:path";
import simpleGit from "simple-git";
import { getUatuHome } from "../constants/paths.js";
import { cloneOrRefresh, pullLatest } from "./gitService.js";

export interface SharedWorkspace {
  repoPath: string;        // Base repo directory
  sourcePath: string;      // source/ subdirectory
  auditsPath: string;      // audits/ subdirectory
  testsPath: string;       // tests/ subdirectory
  owner: string;
  repo: string;
  branch: string;
}

export interface WorkspaceMetadata {
  owner: string;
  repo: string;
  branch: string;
  createdAt: string;
  lastAccessedAt: string;
  accessCount: number;
  diskUsage: number; // bytes
}

/**
 * Get or create a shared workspace for a repository
 * Multiple audits of the same repo+branch share this workspace
 */
export async function getOrCreateSharedWorkspace(
  owner: string,
  repo: string,
  branch: string,
  accessToken?: string
): Promise<SharedWorkspace> {
  const workspacePath = path.join(
    getUatuHome(),
    'workspace',
    'repos',
    owner,
    repo,
    'branches',
    branch
  );

  const workspace: SharedWorkspace = {
    repoPath: workspacePath,
    sourcePath: path.join(workspacePath, 'source'),
    auditsPath: path.join(workspacePath, 'audits'),
    testsPath: path.join(workspacePath, 'tests'),
    owner,
    repo,
    branch,
  };

  // Ensure directories exist
  await fs.ensureDir(workspace.auditsPath);
  await fs.ensureDir(workspace.testsPath);

  // Clone or pull repository
  const sourceExists = await fs.pathExists(workspace.sourcePath);
  const cloneUrl = `https://github.com/${owner}/${repo}.git`;

  if (sourceExists) {
    // Pull latest changes
    console.log(`Shared workspace exists, pulling latest changes: ${workspace.sourcePath}`);
    try {
      await pullLatest(workspace.sourcePath, accessToken);
    } catch (error: any) {
      console.warn(`Pull failed, recloning: ${error.message}`);
      await fs.remove(workspace.sourcePath);
      await cloneOrRefresh(cloneUrl, workspace.sourcePath, branch, accessToken);
    }
  } else {
    // First clone
    console.log(`Creating new shared workspace: ${workspace.sourcePath}`);
    await cloneOrRefresh(cloneUrl, workspace.sourcePath, branch, accessToken);
  }

  // Update metadata
  await updateWorkspaceMetadata(workspace);

  return workspace;
}

/**
 * Get audit-specific workspace directory
 */
export function getAuditWorkspace(
  sharedWorkspace: SharedWorkspace,
  jobId: string
): string {
  return path.join(sharedWorkspace.auditsPath, jobId);
}

/**
 * Update workspace metadata (access tracking)
 */
async function updateWorkspaceMetadata(workspace: SharedWorkspace): Promise<void> {
  const metadataPath = path.join(workspace.repoPath, 'workspace.json');

  let metadata: WorkspaceMetadata;
  if (await fs.pathExists(metadataPath)) {
    metadata = await fs.readJson(metadataPath);
    metadata.lastAccessedAt = new Date().toISOString();
    metadata.accessCount += 1;
  } else {
    metadata = {
      owner: workspace.owner,
      repo: workspace.repo,
      branch: workspace.branch,
      createdAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      accessCount: 1,
      diskUsage: 0,
    };
  }

  // Calculate disk usage
  try {
    metadata.diskUsage = await getDirectorySize(workspace.sourcePath);
  } catch {
    metadata.diskUsage = 0;
  }

  await fs.writeJson(metadataPath, metadata, { spaces: 2 });
}

/**
 * Get directory size in bytes
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  async function traverse(currentPath: string) {
    const items = await fs.readdir(currentPath);
    for (const item of items) {
      const itemPath = path.join(currentPath, item);
      const stats = await fs.stat(itemPath);

      if (stats.isDirectory()) {
        await traverse(itemPath);
      } else {
        totalSize += stats.size;
      }
    }
  }

  try {
    await traverse(dirPath);
  } catch (error) {
    console.warn(`Failed to calculate directory size: ${error}`);
  }

  return totalSize;
}

/**
 * Clean up old workspaces based on age or disk usage
 */
export async function cleanupOldWorkspaces(
  maxAgeDays: number = 30,
  maxDiskUsageGB: number = 10
): Promise<{ cleaned: number; freedBytes: number }> {
  const workspacesRoot = path.join(getUatuHome(), 'workspace', 'repos');

  if (!(await fs.pathExists(workspacesRoot))) {
    return { cleaned: 0, freedBytes: 0 };
  }

  let cleaned = 0;
  let freedBytes = 0;

  // Traverse all workspaces
  const owners = await fs.readdir(workspacesRoot);
  for (const owner of owners) {
    const ownerPath = path.join(workspacesRoot, owner);
    const repos = await fs.readdir(ownerPath);

    for (const repo of repos) {
      const repoPath = path.join(ownerPath, repo, 'branches');
      if (!(await fs.pathExists(repoPath))) continue;

      const branches = await fs.readdir(repoPath);
      for (const branch of branches) {
        const branchPath = path.join(repoPath, branch);
        const metadataPath = path.join(branchPath, 'workspace.json');

        if (await fs.pathExists(metadataPath)) {
          const metadata: WorkspaceMetadata = await fs.readJson(metadataPath);
          const lastAccessed = new Date(metadata.lastAccessedAt);
          const daysSinceAccess = (Date.now() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24);

          // Check age threshold
          if (daysSinceAccess > maxAgeDays) {
            console.log(`Cleaning up old workspace (${daysSinceAccess.toFixed(0)} days): ${owner}/${repo}/${branch}`);
            freedBytes += metadata.diskUsage;
            await fs.remove(branchPath);
            cleaned++;
          }
        }
      }
    }
  }

  return { cleaned, freedBytes };
}

/**
 * Get workspace statistics
 */
export async function getWorkspaceStats(): Promise<{
  totalWorkspaces: number;
  totalDiskUsage: number;
  workspaces: WorkspaceMetadata[];
}> {
  const workspacesRoot = path.join(getUatuHome(), 'workspace', 'repos');

  if (!(await fs.pathExists(workspacesRoot))) {
    return { totalWorkspaces: 0, totalDiskUsage: 0, workspaces: [] };
  }

  const workspaces: WorkspaceMetadata[] = [];
  let totalDiskUsage = 0;

  // Traverse all workspaces
  const owners = await fs.readdir(workspacesRoot);
  for (const owner of owners) {
    const ownerPath = path.join(workspacesRoot, owner);
    const repos = await fs.readdir(ownerPath);

    for (const repo of repos) {
      const repoPath = path.join(ownerPath, repo, 'branches');
      if (!(await fs.pathExists(repoPath))) continue;

      const branches = await fs.readdir(repoPath);
      for (const branch of branches) {
        const metadataPath = path.join(repoPath, branch, 'workspace.json');

        if (await fs.pathExists(metadataPath)) {
          const metadata: WorkspaceMetadata = await fs.readJson(metadataPath);
          workspaces.push(metadata);
          totalDiskUsage += metadata.diskUsage;
        }
      }
    }
  }

  return {
    totalWorkspaces: workspaces.length,
    totalDiskUsage,
    workspaces,
  };
}

/**
 * Check if a branch exists in the repository
 */
export async function checkBranchExists(
  repoPath: string,
  branchName: string
): Promise<boolean> {
  try {
    const git = simpleGit(repoPath);
    const branches = await git.branch();
    return branches.all.includes(branchName) ||
           branches.all.includes(`remotes/origin/${branchName}`);
  } catch (error) {
    return false;
  }
}

/**
 * Parse GitHub URL to extract owner and repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com[\/:]([^\/]+)\/([^\/\.]+)/,  // https://github.com/owner/repo or git@github.com:owner/repo
    /^([^\/]+)\/([^\/]+)$/,                  // owner/repo
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace('.git', ''),
      };
    }
  }

  return null;
}
