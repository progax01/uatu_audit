import fs from "fs-extra";
import path from "node:path";

export type Branding = {
  logoPath?: string;   // absolute
  mascotPath?: string; // absolute
  badgeMascotPath?: string; // absolute - UatuAudit certificate badge mascot
  colors?: Partial<{
    primary: string;
    accent: string;
    text: string;
    muted: string;
    card: string;
    line: string;
  }>;
};

// discover user-provided assets; do not fabricate placeholders
export async function loadBranding(branchPath: string): Promise<Branding> {
  const brandDir = path.join(branchPath, ".uatu", "brand");
  const brandingJson = path.join(brandDir, "branding.json");

  const pick = async (base: string) => {
    for (const ext of ["png", "jpg", "jpeg", "svg"]) {
      const p = path.join(brandDir, `${base}.${ext}`);
      if (await fs.pathExists(p)) return p;
    }
    return undefined;
  };

  const logoPath = await pick("logo");
  const mascotPath = await pick("mascot");

  // Load the UatuAudit badge mascot from templates directory
  // Use process.cwd() which points to /app in Docker
  let badgeMascotPath: string | undefined;
  const badgeMascotCandidates = [
    path.join(process.cwd(), "src/templates/uatu-mascot.png"),  // Docker layout: /app/src/templates
    path.join(process.cwd(), "dist/templates/uatu-mascot.png"),  // Alternative dist layout
  ];
  for (const p of badgeMascotCandidates) {
    if (await fs.pathExists(p)) {
      badgeMascotPath = p;
      break;
    }
  }

  let colors: Branding["colors"] | undefined;
  if (await fs.pathExists(brandingJson)) {
    try {
      const j = await fs.readJson(brandingJson);
      colors = j;
    } catch {
      // Ignore invalid branding.json
    }
  }

  return { logoPath, mascotPath, badgeMascotPath, colors };
}
