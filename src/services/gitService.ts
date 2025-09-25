import fs from "fs-extra";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { getUatuHome, getUserId } from "../constants/paths.js";

const execAsync = promisify(exec);

export async function cloneOrRefresh(repo: string, targetPath: string, branch: string) {
  const exists = await fs.pathExists(targetPath);
  
  if (exists) {
    let shouldRemove = false;
    
    try {
      // First check if it's a valid git repository
      await execAsync(`git rev-parse --git-dir`, { cwd: targetPath });
      
      try {
        // Check if remote origin exists and matches expected repo
        const { stdout: remoteUrl } = await execAsync(`git config --get remote.origin.url`, { cwd: targetPath });
        const normalizedRepo = repo.replace(/\.git$/, '').toLowerCase();
        const normalizedRemote = remoteUrl.trim().replace(/\.git$/, '').replace(/^https:\/\/.*@/, 'https://').toLowerCase();
        
        // Extract repo name (owner/repo) for comparison
        const repoName = normalizedRepo.split('/').slice(-2).join('/');
        const remoteName = normalizedRemote.split('/').slice(-2).join('/');
        
        if (repoName === remoteName) {
          // Same repo, try to refresh with the correct branch
          try {
            await execAsync(`git fetch origin`, { cwd: targetPath });
            await execAsync(`git reset --hard origin/${branch}`, { cwd: targetPath });
            console.log(`Successfully refreshed repo at ${targetPath}`);
            return; // Success, no need to re-clone
          } catch (fetchError) {
            console.warn(`Failed to fetch/reset repo:`, fetchError);
            shouldRemove = true;
          }
        } else {
          console.log(`Repository mismatch. Expected: ${repoName}, Found: ${remoteName}`);
          shouldRemove = true;
        }
      } catch (remoteError) {
        console.warn(`No remote origin found:`, remoteError);
        shouldRemove = true;
      }
    } catch (gitError) {
      console.warn(`Directory exists but is not a valid git repository:`, gitError);
      shouldRemove = true;
    }
    
    if (shouldRemove) {
      console.log(`Removing directory for fresh clone: ${targetPath}`);
      await fs.remove(targetPath);
    }
  }
  
  if (!(await fs.pathExists(targetPath))) {
    // Clone new repo
    const tokenFile = path.join(getUatuHome(), "users", getUserId(), "secrets", "github.json");
    let finalUrl = repo;
    if (await fs.pathExists(tokenFile)) {
      try {
        const j = await fs.readJson(tokenFile);
        const tok = j?.token as string | undefined;
        if (tok) {
          const u = new URL(repo);
          if (u.hostname === "github.com") { u.username = "x-access-token"; u.password = tok; finalUrl = u.toString(); }
        }
      } catch {}
    }
    
    try {
      console.log(`Cloning ${repo} (branch: ${branch}) to ${targetPath}`);
      await execAsync(`git clone --branch ${branch} --single-branch ${finalUrl} ${targetPath}`);
      console.log(`Successfully cloned ${repo}`);
    } catch (error: any) {
      // Check if it's a branch not found error
      if (error.message?.includes('Remote branch') && error.message?.includes('not found')) {
        // Try cloning without branch specification, then checkout
        try {
          console.log(`Branch ${branch} not found, trying default branch for ${repo}`);
          await execAsync(`git clone ${finalUrl} ${targetPath}`);
          await execAsync(`git checkout -b ${branch} origin/${branch}`, { cwd: targetPath });
          console.log(`Successfully cloned ${repo} and checked out ${branch}`);
        } catch (fallbackError) {
          console.warn(`Failed to clone repo ${repo} with fallback method:`, fallbackError);
          throw new Error(`Failed to clone repository: Branch '${branch}' not found and fallback failed`);
        }
      } else {
        console.warn(`Failed to clone repo ${repo}:`, error);
        throw new Error(`Failed to clone repository: ${error}`);
      }
    }
  }
}
