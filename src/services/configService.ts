import path from "node:path";
import fs from "fs-extra";

export type UatuConfig = {
  ai?: boolean;
  sandbox?: "local" | "docker";
  timeouts?: { executeMs?: number };
  coverage?: { foundry?: boolean; hardhat?: boolean; node?: boolean };
};

export async function loadConfig(branchPath: string): Promise<UatuConfig> {
  const p = path.join(branchPath, ".uatu", "config.json");
  try { return await fs.readJson(p); } catch { return {}; }
}


