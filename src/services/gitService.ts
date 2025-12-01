import fs from "fs-extra";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { getUatuHome, getUserId } from "../constants/paths.js";
import { recordGitReclone } from "./metrics.js";

const execAsync = promisify(exec);

export async function cloneOrRefresh(repo: string, targetPath: string, branch: string, accessToken?: string) {
  // Early validation to catch bad repo URLs
  if (!repo || typeof repo !== 'string') {
    throw new Error(`Invalid repository URL: ${repo}`);
  }
  
  const trimmed = repo.trim();
  if (!trimmed || trimmed === 'test' || trimmed.length < 5) {
    throw new Error(`Invalid repository URL: "${trimmed}" - must be a valid git URL or owner/repo format`);
  }
  
  const exists = await fs.pathExists(targetPath);
  
  if (exists) {
    let shouldReclone = false;

    try {
      // Reclone Rule 1: Check if .git exists
      const gitDir = path.join(targetPath, '.git');
      if (!(await fs.pathExists(gitDir))) {
        console.log(`Missing .git directory, triggering reclone`);
        shouldReclone = true;
      } else {
        // Reclone Rule 2: Validate git repository
        await execAsync(`git rev-parse --git-dir`, { cwd: targetPath });

        try {
          // Reclone Rule 3: Check remote origin mismatch
          const { stdout: remoteUrl } = await execAsync(`git config --get remote.origin.url`, { cwd: targetPath });
          const normalizedRepo = repo.replace(/\.git$/, '').toLowerCase();
          const normalizedRemote = remoteUrl.trim().replace(/\.git$/, '').replace(/^https:\/\/.*@/, 'https://').toLowerCase();

          // Extract repo name (owner/repo) for comparison
          const repoName = normalizedRepo.split('/').slice(-2).join('/');
          const remoteName = normalizedRemote.split('/').slice(-2).join('/');

          if (repoName === remoteName) {
            // Same repo, try to refresh with the correct branch
            try {
              // Reclone Rule 4: git fetch failure triggers reclone
              await execAsync(`git fetch origin`, { cwd: targetPath });
              await execAsync(`git reset --hard origin/${branch}`, { cwd: targetPath });
              console.log(`Successfully refreshed repo at ${targetPath}`);
              return; // Success, no need to re-clone
            } catch (fetchError) {
              console.warn(`Git fetch failed, triggering reclone:`, fetchError);
              shouldReclone = true;
            }
          } else {
            console.log(`Repository mismatch. Expected: ${repoName}, Found: ${remoteName}, triggering reclone`);
            shouldReclone = true;
          }
        } catch (remoteError) {
          console.warn(`No remote origin found, triggering reclone:`, remoteError);
          shouldReclone = true;
        }
      }
    } catch (gitError) {
      console.warn(`Git validation failed, triggering reclone:`, gitError);
      shouldReclone = true;
    }

        if (shouldReclone) {
          console.log(`Performing reclone: rm -rf ${targetPath}`);
          try {
            await fs.remove(targetPath);
          } catch (removeError: any) {
            // If fs.remove fails, try using exec to force remove
            console.warn(`fs.remove failed, trying exec rm -rf:`, removeError.message);
            try {
              await execAsync(`rm -rf ${targetPath}`);
            } catch (execError) {
              console.error(`Failed to remove directory ${targetPath}:`, execError);
              throw new Error(`Cannot remove directory ${targetPath}: ${execError}`);
            }
          }
          recordGitReclone(); // Track for metrics
        }
  }
  
  if (!(await fs.pathExists(targetPath))) {
    // Clone new repo
    let finalUrl = repo;

    // Use passed accessToken first, then fall back to token file
    let tok: string | undefined = accessToken;
    if (!tok) {
      const tokenFile = path.join(getUatuHome(), "users", getUserId(), "secrets", "github.json");
      if (await fs.pathExists(tokenFile)) {
        try {
          const j = await fs.readJson(tokenFile);
          tok = j?.token as string | undefined;
        } catch {}
      }
    }

    if (tok) {
      try {
        const u = new URL(repo);
        if (u.hostname === "github.com") {
          u.username = "x-access-token";
          u.password = tok;
          finalUrl = u.toString();
          console.log(`Using access token for private repo clone`);
        }
      } catch {}
    }
    
        try {
          console.log(`Cloning ${repo} (branch: ${branch}) to ${targetPath} with --depth=1`);
          await execAsync(`git clone --depth=1 --branch ${branch} --single-branch ${finalUrl} ${targetPath}`);
          console.log(`Successfully cloned ${repo}`);
        } catch (error: any) {
          // Check if it's a branch not found error
          if (error.message?.includes('Remote branch') && error.message?.includes('not found')) {
            // Try cloning without branch specification, then checkout
            try {
              console.log(`Branch ${branch} not found, trying default branch for ${repo}`);
              await execAsync(`git clone --depth=1 ${finalUrl} ${targetPath}`);
              
              // Try to checkout the requested branch (might exist but not be default)
              try {
                await execAsync(`git checkout -b ${branch} origin/${branch}`, { cwd: targetPath });
                console.log(`Successfully cloned ${repo} and checked out ${branch}`);
              } catch {
                // Branch truly doesn't exist, stay on default
                console.log(`Branch ${branch} not found, staying on default branch`);
              }
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
