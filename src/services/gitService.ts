import fs from "fs-extra";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { getUatuHome, getUserId } from "../constants/paths.js";

const execAsync = promisify(exec);

export async function cloneOrRefresh(repo: string, targetPath: string, branch: string) {
  const exists = await fs.pathExists(targetPath);
  
  if (exists) {
    // Check if it's a valid git repository first
    try {
      await execAsync(`git rev-parse --git-dir`, { cwd: targetPath });
      // Verify this repo matches the expected remote and branch
      const { stdout: remoteUrl } = await execAsync(`git config --get remote.origin.url`, { cwd: targetPath });
      const normalizedRepo = repo.replace(/\.git$/, '');
      const normalizedRemote = remoteUrl.trim().replace(/\.git$/, '').replace(/^https:\/\/.*@/, 'https://');
      
      if (normalizedRemote.includes(normalizedRepo.split('/').slice(-2).join('/'))) {
        // Same repo, try to refresh
        await execAsync(`git fetch origin && git reset --hard origin/${branch}`, { cwd: targetPath });
      } else {
        console.log(`Repository mismatch. Expected: ${repo}, Found: ${remoteUrl.trim()}`);
        throw new Error('Repository mismatch');
      }
    } catch (error) {
      console.warn(`Failed to refresh repo at ${targetPath}:`, error);
      // If git operations fail, remove and re-clone
      console.log(`Removing corrupted directory: ${targetPath}`);
      await fs.remove(targetPath);
    }
  }
  
  if (!(await fs.pathExists(targetPath))) {
    // Clone new repo
    try {
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
      await execAsync(`git clone --branch ${branch} --single-branch ${finalUrl} ${targetPath}`);
    } catch (error) {
      console.warn(`Failed to clone repo ${repo}:`, error);
      throw new Error(`Failed to clone repository: ${error}`);
    }
  }
}
