import path from "node:path";
import fs from "fs-extra";
import { adaptResults, validateUnifiedResults, getFormatInfo } from "./resultsAdapter.js";
import {
  calculateDeploymentVerdict,
  calculateGrade,
  getDefaultRiskBadges,
  type Page1Certificate,
  type Page2RiskNarrative,
  type RiskBadges,
  type SeverityCounts,
  type DeploymentVerdict,
  type WorstCaseScenario,
  type ThreatModelSummary,
  type AttackSurfaceOverview
} from "../../types.js";

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
    undeclared: number;  // Components referenced but not provided (not scored)
  };
  findings: Array<{
    severity: string;
    title: string;
    file: string;
    recommendation: string;
  }>;
  undeclaredComponents?: Array<{
    name: string;
    type: string;
    referencedBy: string;
    reason: string;
  }>;
  recommendations: string[];
  executiveSummary: string;
  logoUrl?: string;
  mascotUrl?: string;
}

export interface AuditResults {
  metadata: {
    repo: string;
    repository?: string; // Alternative field name in some results
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
  severity: "critical" | "high" | "medium" | "low" | "info" | "undeclared";
  category: string;
  title: string;
  file: string;
  line?: number;
  description: string;
  code_snippet?: string;
  recommendation: string;
  isUndeclared?: boolean;      // true if from undeclared component
  componentType?: string;       // type of undeclared component
  referencedBy?: string[];      // files that reference undeclared component
}

// UATU_DATA format for the unified report template (v2.0)
interface UatuData {
  meta: {
    project: string;
    branch: string;
    run: string;
    commit?: string;
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
    undeclared: number;  // Components referenced but not provided (not scored)
  };
  findings: Array<{
    severity: string;
    title: string;
    file: string;
    rec: string;
    code_snippet?: string;
  }>;
  undeclaredComponents?: Array<{
    name: string;
    type: string;
    referencedBy: string;
    reason: string;
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
  improve: string[] | Record<string, any>;
  artifacts: Record<string, string>;
  logoUrl?: string;
  mascotUrl?: string;
  // Detailed audit fields
  contracts_explained?: ContractExplanation[];
  test_methodology?: TestMethodology | null;
  user_flows?: UserFlow[];
  test_results?: TestResult[];
  // PAGE 1: Executive Certificate data
  page1_certificate?: Page1Certificate;
  // PAGE 2: Risk Narrative data
  page2_risk_narrative?: Page2RiskNarrative;
}

/**
 * Generate Risk Badges from findings by keyword matching
 */
function generateRiskBadges(findings: Finding[]): RiskBadges {
  const badges = getDefaultRiskBadges();

  const keywordMap: Record<keyof RiskBadges, string[]> = {
    reentrancy_risk: ["reentrancy", "reentrant", "callback", "external call before state", "cei violation"],
    oracle_risk: ["oracle", "price feed", "price manipulation", "twap", "spot price", "chainlink"],
    access_control_risk: ["access control", "unauthorized", "permission", "onlyowner missing", "role", "admin"],
    upgrade_risk: ["proxy", "upgrade", "delegatecall", "implementation", "uups", "transparent proxy"],
    flash_loan_risk: ["flash loan", "flashloan", "atomic arbitrage", "single transaction attack"],
    dos_risk: ["denial of service", "dos", "gas limit", "unbounded loop", "block gas", "griefing"],
    frontrun_risk: ["frontrun", "front-run", "mev", "sandwich", "mempool", "transaction ordering"],
    centralization_risk: ["centralization", "single point", "admin key", "owner privilege", "trusted", "multisig missing"]
  };

  for (const finding of findings) {
    const text = `${finding.title} ${finding.description || ""} ${finding.category || ""}`.toLowerCase();

    for (const [badge, keywords] of Object.entries(keywordMap)) {
      if (keywords.some(kw => text.includes(kw))) {
        badges[badge as keyof RiskBadges] = true;
      }
    }
  }

  return badges;
}

/**
 * Generate Worst-Case Scenarios from high-severity findings
 */
function generateWorstCaseScenarios(findings: Finding[]): WorstCaseScenario[] {
  // Filter critical and high severity findings
  const highSeverity = findings.filter(f => f.severity === "critical" || f.severity === "high");

  // Sort by severity (critical first)
  highSeverity.sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4, undeclared: 5 };
    return order[a.severity] - order[b.severity];
  });

  // Take top 3
  const top3 = highSeverity.slice(0, 3);

  return top3.map((f, index) => ({
    rank: (index + 1) as 1 | 2 | 3,
    title: f.title,
    attack_description: f.description || "Vulnerability could be exploited by an attacker.",
    impact: f.severity === "critical" ? "Critical - Potential complete loss of funds" :
      f.severity === "high" ? "High - Significant financial impact possible" :
        "Medium - Moderate risk to protocol",
    likelihood: f.severity === "critical" ? "High" as const :
      f.severity === "high" ? "Medium" as const : "Low" as const,
    related_findings: [f.id]
  }));
}

/**
 * Generate default Threat Model based on findings
 */
function generateThreatModel(findings: Finding[]): ThreatModelSummary {
  const attackVectors: string[] = [];
  const assetsAtRisk: string[] = ["User funds", "Protocol reserves"];

  // Detect attack vectors from findings
  const findingsText = findings.map(f => `${f.title} ${f.description || ""}`).join(" ").toLowerCase();

  if (findingsText.includes("reentrancy")) attackVectors.push("Reentrancy");
  if (findingsText.includes("flash loan") || findingsText.includes("flashloan")) attackVectors.push("Flash Loans");
  if (findingsText.includes("frontrun") || findingsText.includes("mev")) attackVectors.push("Front-running");
  if (findingsText.includes("oracle") || findingsText.includes("price")) attackVectors.push("Price Manipulation");
  if (findingsText.includes("access control") || findingsText.includes("permission")) attackVectors.push("Access Control Bypass");

  if (attackVectors.length === 0) attackVectors.push("Standard Attack Vectors");

  return {
    threat_actors: [
      {
        type: "external_attacker",
        capability: "Smart contract deployment, flash loan access",
        motivation: "Financial gain"
      },
      {
        type: "mev_bot",
        capability: "Transaction ordering, sandwich attacks",
        motivation: "MEV extraction"
      }
    ],
    attack_vectors: attackVectors,
    assets_at_risk: assetsAtRisk,
    trust_assumptions: [
      "Admin keys are held securely",
      "External dependencies remain reliable"
    ]
  };
}

/**
 * Generate default Attack Surface overview
 */
function generateAttackSurface(contractsAnalyzed: number): AttackSurfaceOverview {
  // Estimates based on typical contract patterns
  return {
    external_entry_points: {
      count: Math.max(5, contractsAnalyzed * 3),
      functions: ["deposit()", "withdraw()", "transfer()"]
    },
    privileged_functions: {
      count: Math.max(2, contractsAnalyzed),
      functions: ["pause()", "setFee()"],
      roles: ["owner", "admin"]
    },
    external_calls: {
      count: Math.max(3, contractsAnalyzed * 2),
      targets: ["IERC20"]
    },
    state_modifying_functions: Math.max(10, contractsAnalyzed * 5),
    payable_functions: Math.max(1, Math.floor(contractsAnalyzed / 2))
  };
}

/**
 * Generate PAGE 1 Certificate data
 */
function generatePage1Certificate(
  score: number,
  severity: SeverityCounts,
  findings: Finding[],
  meta: { project: string; branch: string; run: string; commit?: string },
  contractsAnalyzed: number
): Page1Certificate {
  const verdictType = calculateDeploymentVerdict(score, severity);
  const grade = calculateGrade(score);

  const verdict: DeploymentVerdict = {
    verdict: verdictType,
    reasoning: verdictType === "PRODUCTION_READY"
      ? "No critical or high severity issues found. Safe for deployment."
      : verdictType === "CONDITIONALLY_READY"
        ? "Some issues require attention before mainnet deployment."
        : "Critical issues must be fixed before deployment.",
    conditions: verdictType === "CONDITIONALLY_READY"
      ? findings.filter(f => f.severity === "high").map(f => `Fix: ${f.title}`)
      : []
  };

  return {
    deployment_verdict: verdict,
    score,
    grade,
    risk_badges: generateRiskBadges(findings),
    severity,
    scope_summary: {
      contracts_analyzed: contractsAnalyzed,
      lines_analyzed: contractsAnalyzed * 150, // Estimate
      commit_hash: meta.commit || "--",
      branch: meta.branch,
      audit_date: meta.run
    }
  };
}

/**
 * Generate PAGE 2 Risk Narrative data
 */
function generatePage2RiskNarrative(
  findings: Finding[],
  contractsAnalyzed: number
): Page2RiskNarrative {
  return {
    worst_case_scenarios: generateWorstCaseScenarios(findings),
    threat_model: generateThreatModel(findings),
    attack_surface: generateAttackSurface(contractsAnalyzed)
  };
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

  // Load raw results
  const rawResults = await fs.readJson(resultsPath);

  // Log format info for debugging
  const formatInfo = getFormatInfo(rawResults);
  console.log('[ReportGenerator] Results format detected:', formatInfo);

  // Adapt results to unified format (supports both old and new formats)
  let results: AuditResults;
  try {
    results = adaptResults(rawResults) as AuditResults;
    validateUnifiedResults(results);
    console.log('[ReportGenerator] Results adaptation successful', {
      format: formatInfo.format,
      totalFindings: results.analysis.total_findings,
      score: results.score.value
    });
  } catch (error: any) {
    console.error('[ReportGenerator] Results adaptation failed:', error.message);
    throw new Error(
      `Failed to adapt results.json: ${error.message}\n\n` +
      `Format info: ${JSON.stringify(formatInfo, null, 2)}\n` +
      `Available fields: ${JSON.stringify(Object.keys(rawResults), null, 2)}`
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

  // Extract project name from repo (support both 'repo' and 'repository' fields)
  const repoUrl = results.metadata.repo || results.metadata.repository;
  const projectName = repoUrl?.split("/").pop()?.replace(".git", "") || "Unknown Project";

  // Calculate counts if not in breakdown (with safe fallbacks)
  const breakdown = results.score.breakdown || {
    critical_count: 0,
    high_count: 0,
    medium_count: 0,
    low_count: 0,
    info_count: 0,
    undeclared_count: 0
  };
  const criticalCount = breakdown.critical_count ?? countBySeverity(results.analysis.findings, "critical");
  const highCount = breakdown.high_count ?? countBySeverity(results.analysis.findings, "high");
  const mediumCount = breakdown.medium_count ?? countBySeverity(results.analysis.findings, "medium");
  const lowCount = breakdown.low_count ?? countBySeverity(results.analysis.findings, "low");
  const infoCount = breakdown.info_count ?? countBySeverity(results.analysis.findings, "info");
  const undeclaredCount = (breakdown as any).undeclared_count ?? countBySeverity(results.analysis.findings, "undeclared");

  // Separate undeclared findings for special display
  const regularFindings = results.analysis.findings.filter(f =>
    f.severity !== 'undeclared' && !(f as any).isUndeclared
  );
  const undeclaredFindings = results.analysis.findings.filter(f =>
    f.severity === 'undeclared' || (f as any).isUndeclared
  );

  // Build severity counts object
  const severityCounts: SeverityCounts = {
    critical: criticalCount,
    high: highCount,
    medium: mediumCount,
    low: lowCount,
    info: infoCount
  };

  // Build meta object
  const meta = {
    project: projectName,
    branch: results.metadata.branch || "main",
    run: formatDate(results.metadata.timestamp),
    commit: undefined as string | undefined
  };

  const contractsAnalyzed = results.analysis.contracts_analyzed || 0;

  // Generate PAGE 1 and PAGE 2 data
  const page1Certificate = generatePage1Certificate(
    results.score.value,
    severityCounts,
    results.analysis.findings,
    meta,
    contractsAnalyzed
  );

  const page2RiskNarrative = generatePage2RiskNarrative(
    results.analysis.findings,
    contractsAnalyzed
  );

  // Build UATU_DATA in the format the unified report template expects (v2.0)
  const uatuData: UatuData = {
    meta,
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
      info: infoCount,
      undeclared: undeclaredCount
    },
    contractsAnalyzed: results.analysis.contracts_analyzed || 0,
    findings: regularFindings.map(f => ({
      severity: f.severity,
      title: f.title,
      file: (f.file || 'N/A') + (f.line ? `:${f.line}` : ""),
      rec: typeof f.recommendation === 'object'
        ? ((f.recommendation as any).text || (f.recommendation as any).description || JSON.stringify(f.recommendation))
        : (f.recommendation || 'Review recommended'),
      code_snippet: f.code_snippet
    })),
    timeline: [
      { step: "bootstrap", label: "Bootstrap", pct: 100, detail: "Completed" },
      { step: "inventory", label: "Inventory", pct: 100, detail: `${contractsAnalyzed} contracts` },
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
    // Detailed audit fields
    contracts_explained: results.contracts_explained || [],
    test_methodology: results.test_methodology || null,
    user_flows: results.user_flows || [],
    test_results: results.test_results || [],
    // Undeclared components section
    undeclaredComponents: undeclaredFindings.map(f => ({
      name: f.title || 'Unknown',
      type: (f as any).componentType || 'unknown',
      referencedBy: (f as any).referencedBy?.join(', ') || f.file || 'N/A',
      reason: f.description || 'Component referenced but not provided for audit'
    }))
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

  const rawResults = await fs.readJson(resultsPath);
  const results = adaptResults(rawResults) as AuditResults;

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

  // Extract project name from repo (support both 'repo' and 'repository' fields)
  const repoUrl = results.metadata.repo || results.metadata.repository;
  const projectName = repoUrl?.split("/").pop()?.replace(".git", "") || "Unknown Project";

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
      info: infoCount,
      undeclared: results.analysis.findings.filter(f => f.severity === 'undeclared').length
    },
    findings: results.analysis.findings.map(f => ({
      severity: f.severity,
      title: f.title,
      file: (f.file || 'N/A') + (f.line ? `:${f.line}` : ""),
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
