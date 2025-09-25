import fs from "fs-extra";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { getUatuHome, getUserId } from "../constants/paths.js";
import { recordGitReclone } from "./metrics.js";

const execAsync = promisify(exec);

export async function cloneOrRefresh(repo: string, targetPath: string, branch: string) {
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
      await fs.remove(targetPath);
      recordGitReclone(); // Track for metrics
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
