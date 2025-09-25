import fs from "fs-extra";
import path from "node:path";
import type { ReportData } from "./reportData.js";
import type { Branding } from "./branding.js";
import { REPORT_TEMPLATE_PATH } from "./paths.js";
import { logger } from "../../utils/logger.js";

const log = logger.child({ module: 'htmlReport' });

function fileToDataUrl(p?: string) {
  if (!p) return undefined;
  const ext = path.extname(p).slice(1).toLowerCase();
  const mime = ext === "svg" ? "image/svg+xml" : ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  const buf = fs.readFileSync(p);
  const b64 = buf.toString("base64");
  return `data:${mime};base64,${b64}`;
}

function resolveTemplatePath(): string {
  // Try dist layout first (when running compiled code)
  const distTemplate = path.join(__dirname, "../../templates", path.basename(REPORT_TEMPLATE_PATH));
  // Try repo src path (dev)
  const srcTemplate = path.resolve(REPORT_TEMPLATE_PATH);
  // Try one level up src (in case of different build layouts)
  const altSrcTemplate = path.join(__dirname, "../../../", REPORT_TEMPLATE_PATH);

  const candidates = [distTemplate, srcTemplate, altSrcTemplate];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  throw new Error(`Report template not found. Looked for: ${candidates.join(", ")}`);
}

export async function writeHtmlReport(runPath: string, data: ReportData, branding: Branding): Promise<string> {
  const tplPath = resolveTemplatePath();
  const htmlTpl = await fs.readFile(tplPath, "utf8");

  log.info('Generating HTML report', { 
    runPath, 
    project: data.meta.project,
    hasLogo: !!branding.logoPath,
    hasMascot: !!branding.mascotPath 
  });

  // DO NOT invent logos; if missing, leave empty container in template
  const logoUrl = branding.logoPath ? fileToDataUrl(branding.logoPath) : "";
  const mascotUrl = branding.mascotPath ? fileToDataUrl(branding.mascotPath) : "";

  // inject data + assets
  const payload = JSON.stringify({ 
    ...data, 
    logoUrl, 
    mascotUrl, 
    colors: branding.colors ?? {} 
  });

  const html = htmlTpl.replace("</head>",
    `<script id="uatu-data">window.UATU_DATA=${payload};</script></head>`);

  const out = path.join(runPath, "report.html");
  await fs.outputFile(out, html, "utf8");
  
  log.info('HTML report generated successfully', { 
    outputPath: out, 
    score: data.score, 
    grade: data.grade
  });
  
  return out;
}
