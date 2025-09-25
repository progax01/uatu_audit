// Stable contract for HTML + PDF
import { z } from "zod";
import fs from "fs-extra";
import path from "node:path";

export const Finding = z.object({
  severity: z.enum(["critical","high","medium","low"]),
  title: z.string(),
  file: z.string().optional(),
  rec: z.string().optional(),
});
export type Finding = z.infer<typeof Finding>;

export const ReportData = z.object({
  meta: z.object({
    project: z.string(),
    branch: z.string(),
    commit: z.string().optional().default("-"),
    run: z.string(), // ISO or pretty UTC
  }),
  ecosystems: z.array(z.string()).default([]),
  score: z.number().min(0).max(100),
  grade: z.string(),
  coverage: z.object({
    statements: z.number().min(0).max(100).optional(),
    branches: z.number().min(0).max(100).optional(),
    functions: z.number().min(0).max(100).optional(),
  }).default({}),
  severity: z.object({
    critical: z.number().int().nonnegative().default(0),
    high: z.number().int().nonnegative().default(0),
    medium: z.number().int().nonnegative().default(0),
    low: z.number().int().nonnegative().default(0),
  }),
  artifacts: z.object({
    pdf: z.string().optional(),
    sarif: z.string().optional(),
    inventory: z.string().optional(),
    analysis: z.string().optional(),
    html: z.string().optional(),
  }).default({}),
  findings: z.array(Finding).default([]),
  timeline: z.array(z.object({
    step: z.enum(["bootstrap","inventory","analysis","testgen","execute"]),
    label: z.string(),
    pct: z.number().min(0).max(100),
    detail: z.string().optional(),
  })),
  testStrategy: z.object({
    styles: z.array(z.string()).default([]),
    coverage: z.object({
      behavioral: z.number().min(0).max(1).default(0),
      stride: z.number().min(0).max(1).default(0),
    }).default({ behavioral: 0, stride: 0 }),
    uncovered: z.object({
      behavioral: z.array(z.string()).optional(),
      stride: z.array(z.string()).optional(),
    }).default({}),
    skeletonsGenerated: z.number().int().nonnegative().default(0),
  }).default({
    styles: [],
    coverage: { behavioral: 0, stride: 0 },
    uncovered: {},
    skeletonsGenerated: 0
  }),
  improve: z.array(z.string()).default([]),
  logs: z.string().optional(), // Optional: last N lines of execution logs
});
export type ReportData = z.infer<typeof ReportData>;

// ---- scoring helpers ----
function gradeFromScore(s: number) {
  if (s >= 97) return "A+";
  if (s >= 93) return "A";
  if (s >= 90) return "A-";
  if (s >= 87) return "B+";
  if (s >= 83) return "B";
  if (s >= 80) return "B-";
  if (s >= 77) return "C+";
  if (s >= 73) return "C";
  if (s >= 70) return "C-";
  if (s >= 60) return "D";
  return "F";
}

export function computeScore(sev: ReportData["severity"], cov?: ReportData["coverage"]) {
  // base 100 minus weighted penalties (tuneable)
  const penalties =
    sev.critical * 25 +
    sev.high * 10 +
    sev.medium * 4 +
    sev.low * 1;
  let score = Math.max(0, 100 - penalties);

  // coverage bonus (cap +6) – small nudge, not deceptive
  const stmt = cov?.statements ?? 0;
  const branches = cov?.branches ?? 0;
  const fns = cov?.functions ?? 0;
  const covAvg = [stmt, branches, fns].filter(n => n > 0).reduce((a,b)=>a+b,0) /
                 Math.max(1, [stmt,branches,fns].filter(n=>n>0).length);
  if (!Number.isNaN(covAvg)) score = Math.min(100, score + Math.round(Math.min(6, covAvg/20)));

  return { score, grade: gradeFromScore(score) };
}

// small suggestion engine (maps findings → improvements)
export function suggestImprovements(findings: Finding[], coverage?: ReportData["coverage"]) {
  const out: string[] = [];
  const has = (id: RegExp) => findings.some(f => id.test(f.title) || id.test(f.rec ?? ""));

  if (findings.some(f => f.severity === "high" && /low[- ]level call|delegatecall/i.test(f.title)))
    out.push("Replace low-level calls with typed interfaces/library wrappers and verify return values.");

  if (findings.some(f => /reentrancy/i.test(f.title)))
    out.push("Wrap external calls with reentrancy guards and follow checks-effects-interactions.");

  if (findings.some(f => /unbounded loop|gas/i.test(f.title)))
    out.push("Bound loops or chunk operations to avoid DoS by gas exhaustion.");

  if (findings.some(f => /tx\.origin/i.test(f.title)))
    out.push("Never use tx.origin for authorization; use access control or msg.sender.");

  if (findings.some(f => /unsafe/i.test(f.title)))
    out.push("Replace unsafe Rust blocks with safe alternatives where possible.");

  if (findings.some(f => /unwrap/i.test(f.title)))
    out.push("Use proper error handling instead of unwrap() to prevent panics.");

  if (findings.some(f => /eval|new Function/i.test(f.title)))
    out.push("Remove eval() and new Function() usage; use safer alternatives.");

  if (findings.some(f => /hardcoded|secret/i.test(f.title)))
    out.push("Move secrets and configuration to environment variables.");

  if ((coverage?.branches ?? 0) < 75)
    out.push("Increase branch coverage, especially revert/error paths and upgrade functions.");

  if ((coverage?.statements ?? 0) < 80)
    out.push("Improve statement coverage to at least 80% for better confidence.");

  if (findings.some(f => /access|auth/i.test(f.title)))
    out.push("Implement comprehensive access control with role-based permissions.");

  if (findings.some(f => /event/i.test(f.title)))
    out.push("Emit events for all critical state changes to improve transparency.");

  if (!out.length) out.push("Maintain SOP discipline: keep access maps updated and re-run coverage on each release.");
  return out.slice(0, 6);
}

// Build report data from a run folder
export async function buildReportDataFromRun(params: {
  project: string;
  branch: string;
  branchPath: string;
  runPath: string;
  timestamp: string;
  htmlUrl?: string; // /report?format=html
  pdfUrl?: string;  // /report?format=pdf
}) {
  const { project, branch, branchPath, runPath, timestamp, htmlUrl, pdfUrl } = params;
  
  // Load run artifacts
  const inv = await fs.readJson(path.join(runPath, "inventory.json")).catch(() => ({}));
  const an  = await fs.readJson(path.join(runPath, "analysis.json")).catch(() => ({ findings: [] }));
  const bootstrap = await fs.readJson(path.join(branchPath, ".uatu", "sop", "bootstrap.status.json")).catch(() => null);
  const executeResult = await fs.readJson(path.join(runPath, "execute.json")).catch(() => null);
  
  const ecosystems = (bootstrap?.outputs?.fingerprint?.ecosystems ?? []) as string[];

  // coverage (foundry txt or hardhat summary or execute result)
  let coverage: ReportData["coverage"] = {};
  
  // Try Hardhat coverage first
  const hh = await fs.readJson(path.join(runPath, "coverage", "coverage-summary.json")).catch(() => null);
  if (hh?.total?.lines?.pct) {
    coverage.statements = Math.round(hh.total.lines.pct);
    coverage.branches = Math.round(hh.total.branches?.pct ?? hh.total.lines.pct);
    coverage.functions = Math.round(hh.total.functions?.pct ?? hh.total.lines.pct);
  } else if (executeResult?.coverage) {
    // Use execute result coverage if available
    const pct = Math.round(executeResult.coverage * 100);
    coverage.statements = pct;
    coverage.branches = Math.max(0, pct - 5); // Slightly lower
    coverage.functions = Math.max(0, pct - 3);
  }

  // Count findings by severity
  const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  const findings = (an.findings ?? []).map((f: any) => ({
    severity: f.severity,
    title: f.title,
    file: f.file || "unknown",
    rec: getRecommendationForFinding(f)
  })) as Finding[];
  
  findings.forEach(f => { 
    if (f.severity in sevCounts) {
      (sevCounts as any)[f.severity] = (sevCounts as any)[f.severity] + 1; 
    }
  });

  const { score, grade } = computeScore(sevCounts, coverage);
  const improve = suggestImprovements(findings, coverage);

  const artifacts = {
    html: htmlUrl,
    pdf: pdfUrl,
    sarif: `/runs/${timestamp}/findings.sarif`,
    inventory: `/runs/${timestamp}/inventory.json`,
    analysis: `/runs/${timestamp}/analysis.json`,
  };

  // Build timeline from SOP statuses if present
  const sopSteps = ["bootstrap","inventory","analysis","testgen","execute"] as const;
  const timeline = await Promise.all(sopSteps.map(async step => {
    const statusPath = path.join(branchPath, ".uatu", "sop", `${step}.status.json`);
    let pct = 0;
    let detail = "";
    
    if (await fs.pathExists(statusPath)) {
      const status = await fs.readJson(statusPath).catch(() => null);
      if (status?.ok || status?.completed_at) {
        pct = 100;
        detail = status?.errors?.length ? `errors: ${status.errors.length}` : "completed";
      } else if (status?.started_at) {
        pct = 50;
        detail = "in progress";
      }
    }
    
    return {
      step: step as any,
      label: step[0].toUpperCase() + step.slice(1),
      pct,
      detail
    };
  }));

  // Include execution logs (last 4000 chars)
  let logs: string | undefined;
  const executeLogPath = path.join(runPath, "execute.log");
  if (await fs.pathExists(executeLogPath)) {
    const fullLog = await fs.readFile(executeLogPath, "utf8");
    logs = fullLog.slice(-4000); // Last 4000 characters
  }

  const data = ReportData.parse({
    meta: {
      project, 
      branch,
      commit: "latest", // Could extract from git if needed
      run: new Date(parseInt(timestamp) || Date.now()).toISOString().replace("T"," ").replace(".000Z"," UTC"),
    },
    ecosystems,
    score, 
    grade,
    coverage,
    severity: sevCounts,
    artifacts,
    findings,
      timeline,
      testStrategy: await buildTestStrategyData(runPath),
      improve,
      logs,
  });
  
  return data;
}

async function buildTestStrategyData(runPath: string) {
  try {
    // Try to load test plan metrics
    const metricsPath = path.join(runPath, "testplan.metrics.json");
    const metrics = await fs.readJson(metricsPath).catch(() => ({ coverage: {} }));
    
    // Try to load testgen outputs 
    const testgenPath = path.join(runPath, "testgen.json");
    const testgen = await fs.readJson(testgenPath).catch(() => ({ outputs: {} }));
    
    // Check for individual test plan files
    const behavioralExists = await fs.pathExists(path.join(runPath, "testplan.behavioral.json"));
    const strideExists = await fs.pathExists(path.join(runPath, "testplan.stride.json"));
    
    const styles = [];
    if (behavioralExists) styles.push("behavioral");
    if (strideExists) styles.push("stride");
    
    return {
      styles: testgen.outputs?.testStyles || styles,
      coverage: {
        behavioral: Math.round((metrics.coverage?.behavioral || 0) * 100) / 100,
        stride: Math.round((metrics.coverage?.stride || 0) * 100) / 100,
      },
      uncovered: metrics.coverage?.uncovered || {},
      skeletonsGenerated: testgen.outputs?.generatedFiles?.length || 0
    };
  } catch (error) {
    return {
      styles: [],
      coverage: { behavioral: 0, stride: 0 },
      uncovered: {},
      skeletonsGenerated: 0
    };
  }
}

// Helper function for generating recommendations
function getRecommendationForFinding(finding: { id?: string; title: string; severity: string }): string {
  const title = finding.title.toLowerCase();
  const id = (finding.id || "").toLowerCase();

  // Pattern-based recommendations
  if (title.includes('tx.origin') || id.includes('tx-origin')) {
    return "Use msg.sender instead of tx.origin for authentication";
  }
  if (title.includes('low-level call') || title.includes('call(')) {
    return "Wrap with safe interface; verify return values";
  }
  if (title.includes('unbounded loop') || title.includes('loop')) {
    return "Add iteration bounds or implement pagination";
  }
  if (title.includes('unsafe') || id.includes('unsafe')) {
    return "Replace unsafe block with safe Rust alternatives";
  }
  if (title.includes('unwrap') || id.includes('unwrap')) {
    return "Use proper error handling instead of unwrap()";
  }
  if (title.includes('auth') || title.includes('access')) {
    return "Implement proper access control checks";
  }
  if (title.includes('event') || title.includes('emit')) {
    return "Emit events for critical state changes";
  }
  if (title.includes('eval') || id.includes('eval')) {
    return "Remove eval() and use safer alternatives";
  }
  if (title.includes('hardcoded') || title.includes('secret')) {
    return "Move secrets to environment variables";
  }
  if (title.includes('reentrancy')) {
    return "Implement reentrancy guards and follow checks-effects-interactions";
  }

  // Default recommendations by severity
  switch (finding.severity) {
    case 'critical':
    case 'high':
      return "Critical security issue - address immediately before deployment";
    case 'medium':
      return "Important security consideration - should be addressed";
    case 'low':
      return "Minor improvement opportunity - consider addressing";
    default:
      return "Review and consider remediation";
  }
}
