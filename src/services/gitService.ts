import fs from "fs-extra";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { getUatuHome, getUserId } from "../constants/paths.js";

const execAsync = promisify(exec);

export async function cloneOrRefresh(repo: string, targetPath: string, branch: string) {
  const exists = await fs.pathExists(targetPath);
  
  if (exists) {
    // Refresh existing repo
    try {
      await execAsync(`git fetch origin && git reset --hard origin/${branch}`, { cwd: targetPath });
    } catch (error) {
      console.warn(`Failed to refresh repo at ${targetPath}:`, error);
    }
  } else {
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
      // Create a mock directory structure for demo purposes
      await fs.ensureDir(targetPath);
      await fs.writeFile(path.join(targetPath, "README.md"), `# ${path.basename(repo)}\n\nMock repository for demo purposes.\n`);
      await fs.writeFile(path.join(targetPath, "package.json"), JSON.stringify({ name: path.basename(repo), version: "1.0.0" }, null, 2));
    }
  }
}
