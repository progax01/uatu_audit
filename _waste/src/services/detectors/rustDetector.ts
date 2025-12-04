import fg from "fast-glob";
import path from "node:path";
import fs from "fs-extra";

export async function listRustFiles(cwd: string) {
  return fg(["**/*.rs", "!**/target/**", "!**/.git/**", "!**/.uatu/**", "!**/node_modules/**"], { cwd });
}

export async function listAnchorPrograms(cwd: string) {
  const hasAnchorToml = await fs.pathExists(path.join(cwd, "anchor.toml")) || await fs.pathExists(path.join(cwd, "Anchor.toml"));
  const rust = await listRustFiles(cwd);
  const anchorRust: string[] = [];
  for (const f of rust) {
    const s = await fs.readFile(path.join(cwd, f), "utf8");
    if (/\buse\s+anchor_lang::prelude::\*/.test(s) || /#\[program\]/.test(s)) anchorRust.push(f);
  }
  return { hasAnchorToml, files: anchorRust };
}

export async function listSorobanContracts(cwd: string) {
  const hasSorobanToml = await fs.pathExists(path.join(cwd, "soroban.toml")) || await fs.pathExists(path.join(cwd, "soroban.config.toml"));
  const rust = await listRustFiles(cwd);
  const sorobanRust: string[] = [];
  for (const f of rust) {
    const s = await fs.readFile(path.join(cwd, f), "utf8");
    if (/#\[(contract|contractimpl)\]/.test(s)) sorobanRust.push(f);
  }
  return { hasSorobanToml, files: sorobanRust };
}

export async function extractRustPublicFns(absFile: string) {
  const s = await fs.readFile(absFile, "utf8");
  return Array.from(s.matchAll(/\bpub\s+fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/g)).map(m => `${m[1]}(${m[2]||""})`);
}

export async function extractAnchorAccounts(absFile: string) {
  const s = await fs.readFile(absFile, "utf8");
  return Array.from(s.matchAll(/#\[\s*account\s*\][\s\S]*?struct\s+([A-Za-z_][A-Za-z0-9_]*)/g)).map(m => m[1]);
}


