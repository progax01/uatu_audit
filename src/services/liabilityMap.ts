import path from "node:path";
import fs from "fs-extra";

export type LiabilityScope = "INTERNAL" | "EXTERNAL";

export interface ExternalReference {
  type: "github" | "npm" | "other";
  url: string;
  description?: string;
  verified?: boolean;
  last_verified_at?: string;
}

export interface ComponentLiability {
  id: string; // canonical component id, e.g. "contracts/Ownable.sol:owner"
  label: string; // human-friendly, e.g. "Admin wallet (owner)"
  scope: LiabilityScope;
  external_ref?: ExternalReference;
  notes?: string;
}

export interface LiabilityMap {
  version: string;
  repo: string;
  branch?: string;
  created_at: string;
  updated_at: string;
  components: ComponentLiability[];
}

const LIABILITY_MAP_FILENAME = "liability_map.json";

export async function loadLiabilityMap(
  contextPath: string
): Promise<LiabilityMap | null> {
  const filePath = path.join(contextPath, LIABILITY_MAP_FILENAME);
  if (!(await fs.pathExists(filePath))) return null;

  const raw = await fs.readJson(filePath);
  // VERY light validation
  if (!raw.components || !Array.isArray(raw.components)) {
    return null;
  }
  return raw as LiabilityMap;
}

export async function saveLiabilityMap(
  contextPath: string,
  map: LiabilityMap
): Promise<void> {
  const filePath = path.join(contextPath, LIABILITY_MAP_FILENAME);
  const now = new Date().toISOString();

  const withTimestamps: LiabilityMap = {
    ...map,
    updated_at: now,
    created_at: map.created_at || now,
  };

  await fs.ensureDir(contextPath);
  await fs.writeJson(filePath, withTimestamps, { spaces: 2 });
}

/**
 * Upsert a single component entry into the liability map.
 */
export async function upsertComponentLiability(
  contextPath: string,
  base: LiabilityMap | null,
  component: ComponentLiability,
  repo: string,
  branch?: string
): Promise<LiabilityMap> {
  const now = new Date().toISOString();
  const existing = base ?? {
    version: "1.0.0",
    repo,
    branch,
    created_at: now,
    updated_at: now,
    components: [],
  };

  const idx = existing.components.findIndex((c) => c.id === component.id);
  if (idx >= 0) {
    existing.components[idx] = { ...existing.components[idx], ...component };
  } else {
    existing.components.push(component);
  }

  existing.updated_at = now;
  await saveLiabilityMap(contextPath, existing);
  return existing;
}

