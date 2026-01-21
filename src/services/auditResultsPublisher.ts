import fs from 'fs-extra';
import path from 'node:path';
import simpleGit from 'simple-git';
import {
  createBranch,
  checkoutBranch,
  commitChanges,
  pushChanges,
  getCurrentBranch,
} from './gitService.js';
import { checkBranchExists } from './workspaceManager.js';
import { getDb } from '../db/index.js';
import { auditFindings, auditJobs } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

export interface AuditFinding {
  id: string;
  title: string;
  severity: string;
  description: string;
  location?: string;
  recommendation?: string;
  category?: string;
  filePath?: string;
  lineStart?: number;
  functionName?: string;
  contractName?: string;
}

export interface PublishOptions {
  includeTests?: boolean;
  testsPath?: string;
  incrementalUpdate?: boolean;
}

/**
 * Publish audit findings to audited_{branch} branch with continuity
 * This is the new preferred method that supports:
 * - Consistent branch naming (audited_{original_branch})
 * - Branch continuity (appends to existing audits)
 * - Test case publishing
 * - Incremental updates
 */
export async function publishAuditResults(
  auditJobId: string,
  options: PublishOptions = {}
): Promise<{ branchName: string; commitHash: string; repositoryUrl: string }> {
  const db = getDb();

  // Get job details
  const [job] = await db
    .select()
    .from(auditJobs)
    .where(eq(auditJobs.id, auditJobId))
    .limit(1);

  if (!job || !job.metadata) {
    throw new Error('Job not found or missing workspace metadata');
  }

  const workspace = (job.metadata as any).workspace;
  if (!workspace || !workspace.sourcePath) {
    throw new Error('Workspace metadata not found in job');
  }

  const sourcePath = workspace.sourcePath;
  const testsPath = options.testsPath || workspace.testsPath;
  const originalBranch = workspace.branch || 'main';
  const auditBranchName = `audited_${originalBranch}`;

  // Get access token from job metadata
  const accessToken = (job.metadata as any).accessToken;
  if (!accessToken) {
    throw new Error('Access token not found in job metadata');
  }

  console.log('Publishing audit results', {
    jobId: auditJobId,
    originalBranch,
    auditBranchName,
    sourcePath,
  });

  // Check if audit branch already exists (locally or remotely)
  const branchExists = await checkBranchExists(sourcePath, auditBranchName);

  if (branchExists) {
    console.log(`Audit branch exists, checking out: ${auditBranchName}`);
    // Branch exists - checkout and pull latest
    await checkoutBranch(sourcePath, auditBranchName);
    const git = simpleGit(sourcePath);
    try {
      await git.pull('origin', auditBranchName);
    } catch (error) {
      console.warn('Pull failed, branch may not exist remotely yet');
    }
  } else {
    console.log(`Creating new audit branch: ${auditBranchName}`);
    // First audit - create branch from original
    await checkoutBranch(sourcePath, originalBranch);
    await createBranch(sourcePath, auditBranchName);
  }

  // Get audit findings
  const findings = await getAuditFindings(auditJobId);

  // Copy generated tests if they exist
  let testFilesCopied = 0;
  if (options.includeTests && testsPath && (await fs.pathExists(testsPath))) {
    const testFiles = await fs.readdir(testsPath);
    const auditTestDir = path.join(sourcePath, 'test', 'audit');
    await fs.ensureDir(auditTestDir);

    for (const testFile of testFiles) {
      if (testFile.startsWith('test_finding_')) {
        const srcPath = path.join(testsPath, testFile);
        const destPath = path.join(auditTestDir, testFile);
        await fs.copy(srcPath, destPath);
        testFilesCopied++;
      }
    }

    console.log(`Copied ${testFilesCopied} test files to test/audit/`);
  }

  // Generate audit report with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const reportFileName = `AUDIT_REPORT_${timestamp}.md`;
  const reportPath = path.join(sourcePath, reportFileName);
  const markdown = generateAuditReport(findings, job, testFilesCopied);
  await fs.writeFile(reportPath, markdown, 'utf-8');

  // Generate README for test directory if tests were added
  if (testFilesCopied > 0) {
    const testReadmePath = path.join(sourcePath, 'test', 'audit', 'README.md');
    const testReadme = generateTestReadme(findings, testFilesCopied);
    await fs.writeFile(testReadmePath, testReadme, 'utf-8');
  }

  // Commit all changes
  const filesToCommit = [reportFileName];
  if (testFilesCopied > 0) {
    filesToCommit.push('test/audit/**');
  }

  const commitMessage = generateCommitMessage(auditJobId, findings, testFilesCopied);

  const commitHash = await commitChanges(sourcePath, commitMessage, filesToCommit);

  console.log('Committed audit results', { commitHash });

  // Push to remote
  await pushChanges(sourcePath, auditBranchName, accessToken);

  console.log('Pushed to remote', { branch: auditBranchName });

  // Return to original branch
  await checkoutBranch(sourcePath, originalBranch);

  return {
    branchName: auditBranchName,
    commitHash,
    repositoryUrl: `https://github.com/${workspace.owner}/${workspace.repo}/tree/${auditBranchName}`,
  };
}

/**
 * Legacy method for backward compatibility
 * @deprecated Use publishAuditResults instead
 */
export async function publishFindingsToBranch(
  auditJobId: string,
  repoPath: string,
  accessToken: string
): Promise<{ branchName: string; commitHash: string }> {
  // This method is kept for backward compatibility
  // but new code should use publishAuditResults
  const branchName = `uatu-audit-${auditJobId.slice(0, 8)}`;

  await createBranch(repoPath, branchName);

  const findings = await getAuditFindings(auditJobId);
  const markdown = generateFindingsMarkdown(findings, auditJobId);

  const reportPath = path.join(repoPath, 'UATU_AUDIT_REPORT.md');
  await fs.writeFile(reportPath, markdown, 'utf-8');

  const commitHash = await commitChanges(
    repoPath,
    `Add Uatu audit report for job ${auditJobId}\n\nGenerated audit report with ${findings.length} findings.`,
    ['UATU_AUDIT_REPORT.md']
  );

  await pushChanges(repoPath, branchName, accessToken);

  return { branchName, commitHash };
}

/**
 * Generate commit message
 */
function generateCommitMessage(
  auditJobId: string,
  findings: AuditFinding[],
  testCount: number
): string {
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const mediumCount = findings.filter((f) => f.severity === 'medium').length;

  let message = `Audit Report - ${new Date().toISOString().split('T')[0]}\n\n`;
  message += `Job ID: ${auditJobId}\n`;
  message += `Findings: ${findings.length}\n`;
  if (criticalCount > 0) message += `- Critical: ${criticalCount}\n`;
  if (highCount > 0) message += `- High: ${highCount}\n`;
  if (mediumCount > 0) message += `- Medium: ${mediumCount}\n`;

  if (testCount > 0) {
    message += `\nGenerated ${testCount} test cases to verify vulnerabilities.\n`;
    message += `Run: forge test --match-path test/audit/**\n`;
  }

  message += `\nGenerated by Uatu Audit (https://uatu.ai)`;

  return message;
}

/**
 * Generate audit report markdown
 */
function generateAuditReport(
  findings: AuditFinding[],
  job: any,
  testCount: number
): string {
  const timestamp = new Date().toISOString();
  const workspace = job.metadata?.workspace;

  let markdown = `# Uatu Audit Report\n\n`;
  markdown += `**Generated:** ${timestamp}\n`;
  markdown += `**Job ID:** ${job.id}\n`;
  markdown += `**Repository:** ${workspace?.owner}/${workspace?.repo}\n`;
  markdown += `**Branch:** ${workspace?.branch}\n`;
  markdown += `**Commit:** ${job.commitSha?.substring(0, 7)}\n`;
  markdown += `**Total Findings:** ${findings.length}\n`;
  if (testCount > 0) {
    markdown += `**Test Cases Generated:** ${testCount}\n`;
  }
  markdown += `\n`;

  // Summary by severity
  const severityCounts = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  markdown += `## Summary\n\n`;
  markdown += `| Severity | Count |\n`;
  markdown += `|----------|-------|\n`;
  for (const [severity, count] of Object.entries(severityCounts).sort((a, b) => {
    const order = ['critical', 'high', 'medium', 'low', 'info'];
    return order.indexOf(a[0]) - order.indexOf(b[0]);
  })) {
    markdown += `| ${capitalize(severity)} | ${count} |\n`;
  }
  markdown += `\n`;

  if (testCount > 0) {
    markdown += `## Running Tests\n\n`;
    markdown += `The generated test cases are located in \`test/audit/\` and can be run using:\n\n`;
    markdown += `\`\`\`bash\n`;
    markdown += `# Run all audit tests\n`;
    markdown += `forge test --match-path test/audit/**\n\n`;
    markdown += `# Run specific test\n`;
    markdown += `forge test --match-contract Test_Finding_<id>\n`;
    markdown += `\`\`\`\n\n`;
    markdown += `**Note:** These tests demonstrate the vulnerabilities. They should FAIL initially, `;
    markdown += `proving the vulnerability exists. After fixing the issues, the tests should PASS.\n\n`;
  }

  // Group findings by severity
  const groupedFindings = findings.reduce((acc, f) => {
    if (!acc[f.severity]) {
      acc[f.severity] = [];
    }
    acc[f.severity].push(f);
    return acc;
  }, {} as Record<string, AuditFinding[]>);

  // Output findings by severity
  const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];

  for (const severity of severityOrder) {
    const findingsInSeverity = groupedFindings[severity];
    if (!findingsInSeverity || findingsInSeverity.length === 0) {
      continue;
    }

    markdown += `## ${capitalize(severity)} Severity Findings\n\n`;

    for (let i = 0; i < findingsInSeverity.length; i++) {
      const finding = findingsInSeverity[i];
      markdown += `### ${i + 1}. ${finding.title}\n\n`;

      if (finding.category) {
        markdown += `**Category:** ${finding.category}\n\n`;
      }

      if (finding.location) {
        markdown += `**Location:** \`${finding.location}\`\n\n`;
      }

      markdown += `**Description:**\n\n${finding.description}\n\n`;

      if (finding.recommendation) {
        markdown += `**Recommendation:**\n\n${finding.recommendation}\n\n`;
      }

      markdown += `---\n\n`;
    }
  }

  markdown += `## About This Report\n\n`;
  markdown += `This audit report was automatically generated by [Uatu Audit](https://uatu.ai).\n\n`;
  markdown += `**Note:** This is an automated security audit. Please review all findings carefully and consult with your security team before making changes.\n`;

  return markdown;
}

/**
 * Generate README for test directory
 */
function generateTestReadme(findings: AuditFinding[], testCount: number): string {
  let markdown = `# Audit Test Cases\n\n`;
  markdown += `This directory contains ${testCount} test cases generated to verify security findings.\n\n`;

  markdown += `## Overview\n\n`;
  markdown += `These tests demonstrate the vulnerabilities found during the audit. `;
  markdown += `They are designed to FAIL initially, proving the vulnerability exists. `;
  markdown += `After fixing the issues, these tests should PASS.\n\n`;

  markdown += `## Running Tests\n\n`;
  markdown += `\`\`\`bash\n`;
  markdown += `# Run all audit tests\n`;
  markdown += `forge test --match-path test/audit/**\n\n`;
  markdown += `# Run with verbosity\n`;
  markdown += `forge test --match-path test/audit/** -vvv\n\n`;
  markdown += `# Run specific test\n`;
  markdown += `forge test --match-contract Test_Finding_<id>\n`;
  markdown += `\`\`\`\n\n`;

  markdown += `## Test Files\n\n`;
  markdown += `| Finding | Test File |\n`;
  markdown += `|---------|----------|\n`;

  // List high and critical findings with test files
  const testableFindings = findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high'
  );

  for (const finding of testableFindings) {
    const sanitizedId = finding.id.replace(/[^a-zA-Z0-9]/g, '_');
    markdown += `| ${finding.title} | \`test_finding_${sanitizedId}.t.sol\` |\n`;
  }

  markdown += `\n`;
  markdown += `## Notes\n\n`;
  markdown += `- Tests use Foundry's testing framework\n`;
  markdown += `- Failed tests indicate vulnerabilities still exist\n`;
  markdown += `- Passing tests indicate vulnerabilities have been fixed\n`;
  markdown += `- Review test code to understand the exploit\n\n`;

  markdown += `Generated by [Uatu Audit](https://uatu.ai)\n`;

  return markdown;
}

/**
 * Get audit findings from database
 */
async function getAuditFindings(auditJobId: string): Promise<AuditFinding[]> {
  const db = getDb();

  const results = await db
    .select()
    .from(auditFindings)
    .where(eq(auditFindings.jobId, auditJobId))
    .orderBy(desc(auditFindings.originalSeverity));

  return results.map((finding) => ({
    id: finding.id,
    title: finding.title || 'Untitled Finding',
    severity: finding.adjustedSeverity || finding.originalSeverity || 'info',
    description: finding.description || '',
    location: finding.filePath || undefined,
    recommendation: finding.recommendation || undefined,
    category: finding.tool || undefined,
  }));
}

/**
 * Generate markdown report from findings
 */
function generateFindingsMarkdown(findings: AuditFinding[], auditJobId: string): string {
  const timestamp = new Date().toISOString();

  let markdown = `# Uatu Audit Report\n\n`;
  markdown += `**Audit Job ID:** ${auditJobId}\n`;
  markdown += `**Generated:** ${timestamp}\n`;
  markdown += `**Total Findings:** ${findings.length}\n\n`;

  // Summary by severity
  const severityCounts = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  markdown += `## Summary\n\n`;
  markdown += `| Severity | Count |\n`;
  markdown += `|----------|-------|\n`;
  for (const [severity, count] of Object.entries(severityCounts).sort((a, b) => {
    const order = ['critical', 'high', 'medium', 'low', 'info'];
    return order.indexOf(a[0]) - order.indexOf(b[0]);
  })) {
    markdown += `| ${capitalize(severity)} | ${count} |\n`;
  }
  markdown += `\n`;

  // Group findings by severity
  const groupedFindings = findings.reduce((acc, f) => {
    if (!acc[f.severity]) {
      acc[f.severity] = [];
    }
    acc[f.severity].push(f);
    return acc;
  }, {} as Record<string, AuditFinding[]>);

  // Output findings by severity
  const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];

  for (const severity of severityOrder) {
    const findingsInSeverity = groupedFindings[severity];
    if (!findingsInSeverity || findingsInSeverity.length === 0) {
      continue;
    }

    markdown += `## ${capitalize(severity)} Severity Findings\n\n`;

    for (let i = 0; i < findingsInSeverity.length; i++) {
      const finding = findingsInSeverity[i];
      markdown += `### ${i + 1}. ${finding.title}\n\n`;

      if (finding.category) {
        markdown += `**Category:** ${finding.category}\n\n`;
      }

      if (finding.location) {
        markdown += `**Location:** \`${finding.location}\`\n\n`;
      }

      markdown += `**Description:**\n\n${finding.description}\n\n`;

      if (finding.recommendation) {
        markdown += `**Recommendation:**\n\n${finding.recommendation}\n\n`;
      }

      markdown += `---\n\n`;
    }
  }

  markdown += `## About This Report\n\n`;
  markdown += `This audit report was automatically generated by [Uatu Audit](https://uatu.ai).\n\n`;
  markdown += `**Note:** This is an automated security audit. Please review all findings carefully and consult with your security team before making changes.\n`;

  return markdown;
}

/**
 * Capitalize first letter of string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Publish findings as GitHub issues (optional feature)
 */
export async function publishFindingsAsIssues(
  auditJobId: string,
  owner: string,
  repo: string,
  accessToken: string
): Promise<string[]> {
  const findings = await getAuditFindings(auditJobId);
  const issueUrls: string[] = [];

  // Filter to only critical and high severity findings
  const criticalFindings = findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high'
  );

  for (const finding of criticalFindings) {
    try {
      const issueUrl = await createGitHubIssue(
        owner,
        repo,
        finding,
        accessToken,
        auditJobId
      );
      issueUrls.push(issueUrl);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to create issue for finding ${finding.id}:`, errorMessage);
    }
  }

  return issueUrls;
}

/**
 * Create a GitHub issue for a finding
 */
async function createGitHubIssue(
  owner: string,
  repo: string,
  finding: AuditFinding,
  accessToken: string,
  auditJobId: string
): Promise<string> {
  const severityLabel = `severity: ${finding.severity}`;
  const categoryLabel = finding.category ? `category: ${finding.category}` : 'audit';

  const issueBody = `${finding.description}\n\n`;
  const recommendation = finding.recommendation
    ? `## Recommendation\n\n${finding.recommendation}\n\n`
    : '';
  const location = finding.location ? `**Location:** \`${finding.location}\`\n\n` : '';

  const body = `${location}${issueBody}${recommendation}---\n\n*Generated by Uatu Audit (Job ID: ${auditJobId})*`;

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `token ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      title: `[Uatu Audit] ${finding.title}`,
      body,
      labels: [severityLabel, categoryLabel, 'security', 'uatu-audit'],
    }),
  });

  if (!response.ok) {
    const errorData: any = await response.json();
    throw new Error(`Failed to create GitHub issue: ${errorData.message || 'Unknown error'}`);
  }

  const issue: any = await response.json();
  return issue.html_url;
}
