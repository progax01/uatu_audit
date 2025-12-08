import path from "node:path";
import fs from "fs-extra";

// Certificate data format for the new dark-themed template
interface CertificateData {
  reportId: string;
  reportDate: string;
  project: string;
  version: string;
  scope: string;
  score: number;
  grade: string;
  severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  findings: Array<{
    severity: string;
    title: string;
    file: string;
    recommendation: string;
  }>;
  recommendations: string[];
  executiveSummary: string;
  logoUrl?: string;
  mascotUrl?: string;
}

export interface AuditResults {
  metadata: {
    repo: string;
    branch: string;
    timestamp: string;
    duration_seconds: number;
    status: string;
  };
  analysis: {
    contracts_analyzed: number;
    total_findings: number;
    findings: Finding[];
  };
  tests_generated: {
    behavioral: { count: number; files: string[] };
    stride: { count: number; files: string[] };
    owasp: { count: number; files: string[] };
  };
  score: {
    value: number;
    grade: string;
    breakdown: {
      critical_count?: number;
      high_count?: number;
      medium_count?: number;
      low_count?: number;
      info_count?: number;
    };
  };
  recommendations: string[];
  // New optional fields for detailed audit
  contracts_explained?: ContractExplanation[];
  test_methodology?: TestMethodology;
  user_flows?: UserFlow[];
  test_results?: TestResult[];
}

// New interfaces for detailed audit features
export interface ContractExplanation {
  name: string;
  purpose: string;
  summary: string;
  key_functions: Array<{
    name: string;
    description: string;
    visibility: string;
  }>;
  state_variables: string[];
  dependencies: string[];
}

export interface TestMethodology {
  stride_coverage: {
    spoofing?: string;
    tampering?: string;
    repudiation?: string;
    information_disclosure?: string;
    denial_of_service?: string;
    elevation_of_privilege?: string;
  };
  owasp_coverage: {
    [key: string]: string;
  };
  behavioral_coverage: {
    normal_operations?: string;
    edge_cases?: string;
    business_logic?: string;
  };
  rationale: string;
}

export interface UserFlow {
  id: string;
  name: string;
  description: string;
  severity?: "CRITICAL" | "MODERATE" | "POSITIVE";
  steps: Array<{
    step: number;
    actor: string;
    action: string;
    contract: string;
    state_change: string;
    result: string;
  }>;
  critical: boolean;
  integration_points: string[];
}

export interface TestResult {
  id: string;
  name: string;
  type: "positive" | "negative";
  category: "behavioral" | "stride" | "owasp";
  scenario: string;
  contract: string;
  function: string;
  expected: string;
  actual: string;
  status: "PASS" | "FAIL";
  severity: "critical" | "high" | "medium" | "low" | null;
  finding_id: string | null;
  // New fields for detailed failure info
  line?: number;
  error?: string;
  code_snippet?: string;
}

export interface Finding {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  title: string;
  file: string;
  line?: number;
  description: string;
  code_snippet?: string;
  recommendation: string;
}

// Old UATU_DATA format for the classic template
interface UatuData {
  meta: {
    project: string;
    branch: string;
    run: string;
  };
  ecosystems: string[];
  score: number;
  grade: string;
  coverage: {
    statements?: number;
    branches?: number;
    functions?: number;
  };
  severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  findings: Array<{
    severity: string;
    title: string;
    file: string;
    rec: string;
    code_snippet?: string;
  }>;
  contractsAnalyzed?: number;
  timeline: Array<{
    step: string;
    label: string;
    pct: number;
    detail: string;
  }>;
  testStrategy: {
    styles: string[];
    coverage: {
      behavioral: number;
      stride: number;
    };
    skeletonsGenerated: number;
  };
  improve: string[];
  artifacts: Record<string, string>;
  logoUrl?: string;
  mascotUrl?: string;
  // New detailed audit fields
  contracts_explained?: ContractExplanation[];
  test_methodology?: TestMethodology | null;
  user_flows?: UserFlow[];
  test_results?: TestResult[];
}

/**
 * Generate HTML report from results.json using the classic template with window.UATU_DATA injection
 */
export async function generateReportFromResults(
  contextPath: string,
  runPath: string,
  logoDataUri?: string
): Promise<string> {
  // Load Uatu logo (audit logo.svg - same as certificate)
  const logoCandidates = [
    path.join(process.cwd(), "src/templates/audit logo.svg"),
    path.join(process.cwd(), "dist/templates/audit logo.svg"),
    path.join(process.cwd(), "templates/audit logo.svg")
  ];

  let uatuLogoDataUri: string | undefined;
  for (const logoPath of logoCandidates) {
    uatuLogoDataUri = await imageToDataUri(logoPath);
    if (uatuLogoDataUri) break;
  }

  // Load gold mascot (uatu-mascot.png - same as certificate badge)
  const mascotCandidates = [
    path.join(process.cwd(), "src/templates/uatu-mascot.png"),
    path.join(process.cwd(), "dist/templates/uatu-mascot.png"),
    path.join(process.cwd(), "templates/uatu-mascot.png")
  ];

  let mascotDataUri: string | undefined;
  for (const mascotPath of mascotCandidates) {
    mascotDataUri = await imageToDataUri(mascotPath);
    if (mascotDataUri) break;
  }

  // Load results.json
  const resultsPath = path.join(contextPath, "results.json");
  if (!(await fs.pathExists(resultsPath))) {
    throw new Error("results.json not found in context path");
  }

  const results: AuditResults = await fs.readJson(resultsPath);

  // Validate results structure
  if (!results.score) {
    throw new Error(
      "Invalid results.json - missing 'score' field. " +
      "Audit may have failed or produced incomplete results. " +
      `Results structure: ${JSON.stringify(Object.keys(results), null, 2)}`
    );
  }

  if (!results.analysis || !results.analysis.findings) {
    throw new Error(
      "Invalid results.json - missing 'analysis' or 'findings' fields. " +
      "Audit did not complete successfully. " +
      `Available fields: ${JSON.stringify(Object.keys(results), null, 2)}`
    );
  }

  if (typeof results.score.value !== 'number') {
    throw new Error(
      "Invalid results.json - score.value is not a number. " +
      `Got: ${JSON.stringify(results.score)}`
    );
  }

  if (!results.metadata) {
    throw new Error(
      "Invalid results.json - missing 'metadata' field. " +
      "Required metadata not found in audit results."
    );
  }

  // Load template (from src/templates or dist/templates depending on build)
  const templateCandidates = [
    path.join(process.cwd(), "src/templates/report-template.html"),
    path.join(process.cwd(), "dist/templates/report-template.html"),
    path.join(process.cwd(), "templates/report-template.html")
  ];

  let templatePath = templateCandidates[0];
  for (const candidate of templateCandidates) {
    if (await fs.pathExists(candidate)) {
      templatePath = candidate;
      break;
    }
  }
  let template = await fs.readFile(templatePath, "utf8");

  // Extract project name from repo
  const projectName = results.metadata.repo?.split("/").pop()?.replace(".git", "") || "Unknown Project";

  // Calculate counts if not in breakdown (with safe fallbacks)
  const breakdown = results.score.breakdown || {
    critical_count: 0,
    high_count: 0,
    medium_count: 0,
    low_count: 0,
    info_count: 0
  };
  const criticalCount = breakdown.critical_count ?? countBySeverity(results.analysis.findings, "critical");
  const highCount = breakdown.high_count ?? countBySeverity(results.analysis.findings, "high");
  const mediumCount = breakdown.medium_count ?? countBySeverity(results.analysis.findings, "medium");
  const lowCount = breakdown.low_count ?? countBySeverity(results.analysis.findings, "low");
  const infoCount = breakdown.info_count ?? countBySeverity(results.analysis.findings, "info");

  // Build UATU_DATA in the format the new dark-themed template expects
  const uatuData: UatuData = {
    meta: {
      project: projectName,
      branch: results.metadata.branch || "main",
      run: formatDate(results.metadata.timestamp)
    },
    ecosystems: [], // Will be populated if available
    score: results.score.value,
    grade: results.score.grade,
    coverage: {
      statements: 0,
      branches: 0,
      functions: 0
    },
    severity: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
      info: infoCount
    },
    contractsAnalyzed: results.analysis.contracts_analyzed || 0,
    findings: results.analysis.findings.map(f => ({
      severity: f.severity,
      title: f.title,
      file: f.file + (f.line ? `:${f.line}` : ""),
      rec: f.recommendation,
      code_snippet: f.code_snippet
    })),
    timeline: [
      { step: "bootstrap", label: "Bootstrap", pct: 100, detail: "Completed" },
      { step: "inventory", label: "Inventory", pct: 100, detail: `${results.analysis.contracts_analyzed} contracts` },
      { step: "analysis", label: "Analysis", pct: 100, detail: `${results.analysis.total_findings} findings` },
      { step: "testgen", label: "Testgen", pct: 100, detail: "Completed" },
      { step: "execute", label: "Execute", pct: 100, detail: "Completed" }
    ],
    testStrategy: {
      styles: getTestStyles(results.tests_generated),
      coverage: {
        behavioral: results.tests_generated.behavioral?.count > 0 ? 1 : 0,
        stride: results.tests_generated.stride?.count > 0 ? 1 : 0
      },
      skeletonsGenerated:
        (results.tests_generated.behavioral?.count || 0) +
        (results.tests_generated.stride?.count || 0) +
        (results.tests_generated.owasp?.count || 0)
    },
    improve: results.recommendations || [],
    artifacts: {},
    logoUrl: logoDataUri || uatuLogoDataUri,
    mascotUrl: mascotDataUri,
    // New detailed audit fields
    contracts_explained: results.contracts_explained || [],
    test_methodology: results.test_methodology || null,
    user_flows: results.user_flows || [],
    test_results: results.test_results || []
  };

  // Inject UATU_DATA into template
  const payload = JSON.stringify(uatuData);
  const html = template.replace("</head>",
    `<script id="uatu-data">window.UATU_DATA=${payload};</script></head>`);

  // Write report
  const reportPath = path.join(runPath, "report.html");
  await fs.writeFile(reportPath, html, "utf8");

  return reportPath;
}

function countBySeverity(findings: Finding[], severity: string): number {
  return findings.filter(f => f.severity === severity).length;
}

function getTestStyles(tests: AuditResults["tests_generated"]): string[] {
  const styles: string[] = [];
  if (tests.behavioral?.count > 0) styles.push("behavioral");
  if (tests.stride?.count > 0) styles.push("stride");
  if (tests.owasp?.count > 0) styles.push("owasp");
  return styles;
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toISOString().replace("T", " ").replace(".000Z", " UTC").slice(0, -4) + " UTC";
  } catch {
    return isoString || "N/A";
  }
}

/**
 * Convert an image file to a data URI
 */
async function imageToDataUri(imagePath: string): Promise<string | undefined> {
  try {
    if (!(await fs.pathExists(imagePath))) {
      return undefined;
    }
    const buffer = await fs.readFile(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".gif": "image/gif"
    };
    const mime = mimeTypes[ext] || "image/png";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/**
 * Generate the dark-themed certificate HTML from results.json
 */
export async function generateCertificateFromResults(
  contextPath: string,
  runPath: string
): Promise<string> {
  // Load results.json
  const resultsPath = path.join(contextPath, "results.json");
  if (!(await fs.pathExists(resultsPath))) {
    throw new Error("results.json not found in context path");
  }

  const results: AuditResults = await fs.readJson(resultsPath);

  // Load certificate template
  const templateCandidates = [
    path.join(process.cwd(), "src/templates/certificate-template.html"),
    path.join(process.cwd(), "dist/templates/certificate-template.html"),
    path.join(process.cwd(), "templates/certificate-template.html")
  ];

  let templatePath = templateCandidates[0];
  for (const candidate of templateCandidates) {
    if (await fs.pathExists(candidate)) {
      templatePath = candidate;
      break;
    }
  }
  const template = await fs.readFile(templatePath, "utf8");

  // Load audit logo for header (audit logo.svg)
  const shieldLogoCandidates = [
    path.join(process.cwd(), "src/templates/audit logo.svg"),
    path.join(process.cwd(), "dist/templates/audit logo.svg")
  ];

  let shieldLogoDataUri: string | undefined;
  for (const logoPath of shieldLogoCandidates) {
    shieldLogoDataUri = await imageToDataUri(logoPath);
    if (shieldLogoDataUri) break;
  }

  // Load owl mascot for badge (uatu-mascot.png)
  const mascotCandidates = [
    path.join(process.cwd(), "src/templates/uatu-mascot.png"),
    path.join(process.cwd(), "dist/templates/uatu-mascot.png")
  ];

  let mascotDataUri: string | undefined;
  for (const mascotPath of mascotCandidates) {
    mascotDataUri = await imageToDataUri(mascotPath);
    if (mascotDataUri) break;
  }

  // Extract project name from repo
  const projectName = results.metadata.repo?.split("/").pop()?.replace(".git", "") || "Unknown Project";

  // Calculate counts
  const breakdown = results.score.breakdown || {};
  const criticalCount = breakdown.critical_count ?? countBySeverity(results.analysis.findings, "critical");
  const highCount = breakdown.high_count ?? countBySeverity(results.analysis.findings, "high");
  const mediumCount = breakdown.medium_count ?? countBySeverity(results.analysis.findings, "medium");
  const lowCount = breakdown.low_count ?? countBySeverity(results.analysis.findings, "low");
  const infoCount = breakdown.info_count ?? countBySeverity(results.analysis.findings, "info");
  const totalFindings = criticalCount + highCount + mediumCount + lowCount + infoCount;

  // Generate report ID
  const timestamp = new Date(results.metadata.timestamp || Date.now());
  const reportId = `UA-${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, "0")}-${String(timestamp.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;

  // Build certificate data
  const certData: CertificateData = {
    reportId,
    reportDate: results.metadata.timestamp || new Date().toISOString(),
    project: projectName,
    version: `branch: ${results.metadata.branch || "main"}`,
    scope: `Solidity Smart Contracts, ${results.analysis.contracts_analyzed} contracts analyzed`,
    score: results.score.value,
    grade: results.score.grade,
    severity: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
      info: infoCount
    },
    findings: results.analysis.findings.map(f => ({
      severity: f.severity,
      title: f.title,
      file: f.file + (f.line ? `:${f.line}` : ""),
      recommendation: f.recommendation
    })),
    recommendations: results.recommendations || [],
    executiveSummary: `This comprehensive smart contract audit was conducted using UatuAudit's advanced AI-powered analysis system. The audit identified ${totalFindings} total issues across severity levels. AI-generated tests executed: ${(results.tests_generated.behavioral?.count || 0) + (results.tests_generated.stride?.count || 0) + (results.tests_generated.owasp?.count || 0)} tests. The project achieved a security score of ${results.score.value}/100 (Grade: ${results.score.grade}).`,
    logoUrl: shieldLogoDataUri,
    mascotUrl: mascotDataUri
  };

  // Replace logo placeholder in template (shield logo for header)
  let html = template.replace("{{LOGO_BASE64}}", shieldLogoDataUri || "");
  // Replace mascot placeholder (owl mascot for badge)
  html = html.replace("{{MASCOT_BASE64}}", mascotDataUri || "");

  // Inject certificate data into template
  const payload = JSON.stringify(certData);
  html = html.replace("</head>",
    `<script id="cert-data">window.UATU_CERT_DATA=${payload};</script></head>`);

  // Write certificate
  const certPath = path.join(runPath, "certificate.html");
  await fs.writeFile(certPath, html, "utf8");

  return certPath;
}
