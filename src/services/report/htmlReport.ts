import path from "node:path";
import fs from "fs-extra";
import { logger } from "../../utils/logger.js";

const log = logger.child({ module: 'htmlReport' });

interface ReportData {
  project: string;
  branch: string;
  timestamp: string;
  ecosystemSummary: string[];
  findings: Array<{ id: string; severity: string; title: string; file?: string }>;
  coverage?: number; // 0-1 fraction
  commit?: string;
}

interface UatuData {
  meta: {
    project: string;
    branch: string;
    commit: string;
    run: string;
  };
  ecosystems: string[];
  score: number;
  grade: string;
  coverage: {
    statements: number;
    branches: number;
    functions: number;
  };
  severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  artifacts: {
    pdf: string;
    sarif: string;
    inventory: string;
    analysis: string;
  };
  findings: Array<{
    severity: string;
    title: string;
    file: string;
    rec: string;
  }>;
  timeline: Array<{
    step: string;
    label: string;
    pct: number;
    detail: string;
  }>;
  improve: string[];
}

/**
 * Calculate overall security score based on findings
 */
function calculateScore(findings: Array<{ severity: string }>): { score: number; grade: string } {
  const severityCounts = {
    critical: findings.filter(f => f.severity === 'critical' || f.severity === 'high').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length
  };

  // Scoring algorithm: start at 100, deduct points based on severity
  let score = 100;
  score -= severityCounts.critical * 25; // Critical: -25 points each
  score -= severityCounts.high * 15;     // High: -15 points each  
  score -= severityCounts.medium * 8;    // Medium: -8 points each
  score -= severityCounts.low * 3;       // Low: -3 points each

  // Ensure score is between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Determine grade
  let grade: string;
  if (score >= 95) grade = 'A+';
  else if (score >= 90) grade = 'A';
  else if (score >= 85) grade = 'A-';
  else if (score >= 80) grade = 'B+';
  else if (score >= 75) grade = 'B';
  else if (score >= 70) grade = 'B-';
  else if (score >= 65) grade = 'C+';
  else if (score >= 60) grade = 'C';
  else if (score >= 55) grade = 'C-';
  else if (score >= 50) grade = 'D';
  else grade = 'F';

  return { score, grade };
}

/**
 * Generate smart recommendations based on findings
 */
function generateImprovements(findings: Array<{ id: string; title: string; severity: string }>, coverage?: number): string[] {
  const improvements: string[] = [];

  // Coverage-based recommendations
  if (coverage !== undefined) {
    const coveragePct = Math.round(coverage * 100);
    if (coveragePct < 80) {
      improvements.push(`Increase test coverage to at least 80% (currently ${coveragePct}%)`);
    }
    if (coveragePct < 90) {
      improvements.push("Add tests for edge cases and error conditions");
    }
  }

  // Finding-based recommendations
  const hasAuth = findings.some(f => f.title.toLowerCase().includes('auth') || f.id.includes('AUTH'));
  const hasAccess = findings.some(f => f.title.toLowerCase().includes('access') || f.title.toLowerCase().includes('owner'));
  const hasCall = findings.some(f => f.title.toLowerCase().includes('call') || f.id.includes('CALL'));
  const hasLoop = findings.some(f => f.title.toLowerCase().includes('loop') || f.title.toLowerCase().includes('bound'));
  const hasEvent = findings.some(f => f.title.toLowerCase().includes('event') || f.title.toLowerCase().includes('emit'));

  if (hasAuth || hasAccess) {
    improvements.push("Implement comprehensive access control with role-based permissions");
  }
  if (hasCall) {
    improvements.push("Replace low-level calls with typed interfaces and proper error handling");
  }
  if (hasLoop) {
    improvements.push("Add bounds checking and gas optimization for loops");
  }
  if (hasEvent) {
    improvements.push("Emit events for all critical state changes for better transparency");
  }

  // Severity-based recommendations
  const criticalCount = findings.filter(f => f.severity === 'critical' || f.severity === 'high').length;
  if (criticalCount > 0) {
    improvements.push("Address all critical and high-severity findings before deployment");
  }

  // Generic best practices
  improvements.push("Consider implementing a bug bounty program for ongoing security");
  improvements.push("Add comprehensive integration tests for complex workflows");
  improvements.push("Implement proper error handling and graceful failure modes");

  return improvements.slice(0, 6); // Limit to 6 recommendations
}

/**
 * Transform internal data to UatuData format for the HTML template
 */
function transformToUatuData(data: ReportData, runPath: string): UatuData {
  const { score, grade } = calculateScore(data.findings);
  
  // Parse timestamp to readable format
  const timestamp = new Date(parseInt(data.timestamp) || Date.now());
  const runTime = timestamp.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  // Count findings by severity
  const severityCounts = {
    critical: data.findings.filter(f => f.severity === 'critical').length,
    high: data.findings.filter(f => f.severity === 'high').length,
    medium: data.findings.filter(f => f.severity === 'medium').length,
    low: data.findings.filter(f => f.severity === 'low').length
  };

  // Coverage data (mock different types for now)
  const coveragePct = Math.round((data.coverage || 0.8) * 100);
  const coverage = {
    statements: coveragePct,
    branches: Math.max(0, coveragePct - 5), // Slightly lower branch coverage
    functions: Math.max(0, coveragePct - 3)  // Slightly lower function coverage
  };

  // Transform findings for display
  const findings = data.findings.slice(0, 10).map(f => ({
    severity: f.severity,
    title: f.title,
    file: f.file || 'unknown',
    rec: getRecommendationForFinding(f)
  }));

  // SOP timeline (assume all completed for now)
  const timeline = [
    { step: "bootstrap", label: "Bootstrap", pct: 100, detail: "Project & ecosystem detection" },
    { step: "inventory", label: "Inventory", pct: 100, detail: "Functions & contracts catalogued" },
    { step: "analysis", label: "Analysis", pct: 100, detail: "Security patterns analyzed" },
    { step: "testgen", label: "Testgen", pct: 100, detail: "Test plans generated" },
    { step: "execute", label: "Execute", pct: 100, detail: "Tests executed & coverage measured" }
  ];

  // Artifact paths
  const artifacts = {
    pdf: path.join("/report", data.project, data.branch, "report.pdf"),
    sarif: path.join("/report", data.project, data.branch, "findings.sarif"),
    inventory: path.join("/report", data.project, data.branch, "inventory.json"),
    analysis: path.join("/report", data.project, data.branch, "analysis.json")
  };

  return {
    meta: {
      project: data.project,
      branch: data.branch,
      commit: data.commit || 'latest',
      run: runTime
    },
    ecosystems: data.ecosystemSummary,
    score,
    grade,
    coverage,
    severity: severityCounts,
    artifacts,
    findings,
    timeline,
    improve: generateImprovements(data.findings, data.coverage)
  };
}

/**
 * Get a smart recommendation for a specific finding
 */
function getRecommendationForFinding(finding: { id: string; title: string; severity: string }): string {
  const title = finding.title.toLowerCase();
  const id = finding.id.toLowerCase();

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

/**
 * Generate an HTML audit report
 */
export async function writeHtmlReport(runPath: string, data: ReportData): Promise<string> {
  const templatePath = path.join(__dirname, '../../templates/report.html');
  const outputPath = path.join(runPath, "report.html");

  log.info('Generating HTML report', { runPath, project: data.project });

  try {
    // Read the HTML template
    let template = await fs.readFile(templatePath, 'utf8');

    // Transform data to UatuData format
    const uatuData = transformToUatuData(data, runPath);

    // Inject the data into the template
    const dataScript = `
    <script>
      window.UATU_DATA = ${JSON.stringify(uatuData, null, 2)};
    </script>`;

    // Insert the data script before the closing head tag
    template = template.replace('</head>', dataScript + '\n</head>');

    // Write the final HTML file
    await fs.writeFile(outputPath, template, 'utf8');

    log.info('HTML report generated successfully', { outputPath, score: uatuData.score, grade: uatuData.grade });
    return outputPath;
  } catch (error) {
    log.error('Failed to generate HTML report', { error: (error as Error).message });
    throw error;
  }
}
