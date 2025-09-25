import fs from "fs-extra";
import path from "node:path";

export type Branding = {
  logoPath?: string;   // absolute
  mascotPath?: string; // absolute
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

  let colors: Branding["colors"] | undefined;
  if (await fs.pathExists(brandingJson)) {
    try { 
      const j = await fs.readJson(brandingJson); 
      colors = j; 
    } catch {
      // Ignore invalid branding.json
    }
  }

  return { logoPath, mascotPath, colors };
}
