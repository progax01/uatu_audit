import fg from "fast-glob";
import path from "node:path";
import fs from "fs-extra";

export async function hasNodeProject(cwd: string) {
  return fs.pathExists(path.join(cwd, "package.json"));
}

export async function listNodeSources(cwd: string) {
  return fg(["**/*.{js,ts,jsx,tsx}", "!**/node_modules/**", "!**/.git/**", "!**/.uatu/**", "!**/dist/**", "!**/build/**"], { cwd });
}

export async function extractNodeExports(absFile: string) {
  const s = await fs.readFile(absFile, "utf8");
  const out: string[] = [];
  for (const m of s.matchAll(/\bexport\s+function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/g)) out.push(`${m[1]}(${m[2]||""})`);
  for (const m of s.matchAll(/\bexport\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/g)) out.push(`class ${m[1]}`);
  if (/module\.exports\s*=/.test(s)) out.push("module.exports = ...");
  for (const m of s.matchAll(/exports\.([A-Za-z_][A-Za-z0-9_]*)\s*=\s*/g)) out.push(`exports.${m[1]}`);
  return out;
}


