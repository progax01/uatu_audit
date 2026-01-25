/**
 * Testing Step Executors
 *
 * Steps that generate and run test cases for audit findings.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import type {
  StepDefinition,
  StepContext,
  StepResult,
  DeterministicStepConfig,
} from '../../definitions/types';
import { logger } from '../../../utils/logger';
import {
  generateTestForFinding,
  detectTestFramework,
  type AuditFinding,
  type GeneratedTest,
} from '../../../services/testCaseGenerator.js';
import { publishAuditResults } from '../../../services/auditResultsPublisher.js';
import { getDb } from '../../../db/index.js';
import { auditJobs } from '../../../db/schema.js';
import { eq } from 'drizzle-orm';

const log = logger.child({ module: 'testing-steps' });

// ============================================================================
// Main Executor
// ============================================================================

/**
 * Execute a testing step
 */
export async function executeTestingStep(
  step: StepDefinition,
  config: DeterministicStepConfig,
  context: StepContext
): Promise<StepResult> {
  const executor = TESTING_EXECUTORS[config.function];

  if (!executor) {
    return {
      success: false,
      error: `Unknown testing function: ${config.function}`,
      findings: [],
    };
  }

  return executor(step, config, context);
}

// ============================================================================
// Step Executor Type
// ============================================================================

type TestingExecutor = (
  step: StepDefinition,
  config: DeterministicStepConfig,
  context: StepContext
) => Promise<StepResult>;

// ============================================================================
// Generate Tests Step
// ============================================================================

/**
 * Generate test cases for audit findings
 * Only generates tests for high/critical severity findings
 */
const generateTests: TestingExecutor = async (step, config, context) => {
  const { projectPath, job } = context;
  const jobId = job.id;

  log.info('Generating test cases for findings', { jobId });

  await context.onProgress?.(5, 'Loading audit findings...');

  // Get job metadata to find workspace info
  const db = getDb();
  const [jobRecord] = await db
    .select()
    .from(auditJobs)
    .where(eq(auditJobs.id, jobId))
    .limit(1);

  if (!jobRecord || !jobRecord.metadata) {
    return {
      success: false,
      error: 'Job metadata not found',
      findings: [],
    };
  }

  const workspace = (jobRecord.metadata as any).workspace;
  if (!workspace) {
    return {
      success: false,
      error: 'Workspace info not found in job metadata',
      findings: [],
    };
  }

  const sourcePath = workspace.sourcePath;
  const testsPath = workspace.testsPath;

  // Ensure tests directory exists
  await fs.ensureDir(testsPath);

  await context.onProgress?.(10, 'Loading findings...');

  // Get all findings from audit_results.findings JSONB
  const { auditResults } = await import('../../../db/schema.js');
  const [results] = await db
    .select()
    .from(auditResults)
    .where(eq(auditResults.jobId, jobId));

  if (!results || !results.findings) {
    await context.onProgress?.(100, 'No findings to test');
    return { success: true, findings: [] };
  }

  const findingsData = results.findings as any[];

  // Convert to AuditFinding format
  const allFindings: AuditFinding[] = findingsData.map((f: any) => ({
    id: f.id || f.findingId,
    findingId: f.findingId || f.id,
    title: f.title || 'Untitled Finding',
    description: f.description || '',
    recommendation: f.recommendation || undefined,
    severity: f.severity || 'info',
    filePath: f.location?.file || undefined,
    lineStart: f.location?.line || undefined,
    lineEnd: f.location?.lineEnd || undefined,
    functionName: f.location?.function || undefined,
    contractName: f.location?.contract || undefined,
    tool: f.tool || undefined,
  }));

  // Filter to high/critical findings for test generation
  const testableFindings = allFindings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high'
  );

  log.info('Found testable findings', {
    total: allFindings.length,
    testable: testableFindings.length,
  });

  if (testableFindings.length === 0) {
    return {
      success: true,
      output: {
        testsGenerated: 0,
        message: 'No high/critical findings to generate tests for',
      },
      findings: [],
    };
  }

  await context.onProgress?.(20, `Generating tests for ${testableFindings.length} findings...`);

  // Detect test framework
  const framework = await detectTestFramework(sourcePath);
  log.info('Detected test framework', { framework });

  const generatedTests: GeneratedTest[] = [];
  const errors: Array<{ findingId: string; error: string }> = [];

  // Generate tests for each finding
  for (let i = 0; i < testableFindings.length; i++) {
    const finding = testableFindings[i];
    const progress = 20 + (i / testableFindings.length) * 70;

    await context.onProgress?.(
      progress,
      `Generating test ${i + 1}/${testableFindings.length}: ${finding.title.substring(0, 50)}...`
    );

    try {
      log.info('Generating test for finding', {
        findingId: finding.findingId,
        title: finding.title,
        severity: finding.severity,
      });

      const test = await generateTestForFinding(finding, sourcePath, framework);

      // Write test file to workspace tests directory
      const testFilePath = path.join(testsPath, test.testFileName);
      await fs.writeFile(testFilePath, test.testCode, 'utf-8');

      generatedTests.push(test);

      log.info('Generated test case', {
        findingId: finding.findingId,
        testFile: test.testFileName,
        type: test.testType,
      });
    } catch (error: any) {
      log.error('Failed to generate test for finding', {
        findingId: finding.findingId,
        error: error.message,
      });

      errors.push({
        findingId: finding.findingId,
        error: error.message,
      });
    }
  }

  await context.onProgress?.(95, 'Validating test coverage...');

  // Validate test coverage
  const { validateTestCoverage, generateCoverageReport } = await import('../../../services/testCoverageValidator.js');

  const coverageReport = validateTestCoverage(testableFindings, generatedTests);

  log.info('Test generation complete', {
    generated: generatedTests.length,
    failed: errors.length,
    coverage: `${coverageReport.testCoverage.toFixed(1)}%`,
    coverageGaps: coverageReport.coverageGaps.length,
    testsPath,
  });

  // Generate coverage report markdown
  const coverageMarkdown = generateCoverageReport(coverageReport);

  // Save coverage report to .uatu folder
  const coverageReportPath = path.join(testsPath, '..', '.uatu', 'test-coverage-report.md');
  await fs.ensureDir(path.dirname(coverageReportPath));
  await fs.writeFile(coverageReportPath, coverageMarkdown, 'utf-8');

  log.info('Saved test coverage report', { path: coverageReportPath });

  return {
    success: true,
    output: {
      testsGenerated: generatedTests.length,
      testsFailed: errors.length,
      testsPath,
      framework,
      testCoverage: coverageReport.testCoverage,
      coverageGaps: coverageReport.coverageGaps.length,
      errors: errors.length > 0 ? errors : undefined,
    },
    data: {
      generatedTests,
      testCoverageReport: coverageReport,
      errors,
    },
    findings: [],
  };
};

// ============================================================================
// Publish to GitHub Step
// ============================================================================

/**
 * Publish audit results to audited_{branch} branch
 * Includes findings, test cases, and reports
 */
const publishToGitHub: TestingExecutor = async (step, config, context) => {
  const { job } = context;
  const jobId = job.id;

  log.info('Publishing audit results to GitHub', { jobId });

  await context.onProgress?.(10, 'Preparing audit report...');

  try {
    // Get job to check workspace info
    const db = getDb();
    const [jobRecord] = await db
      .select()
      .from(auditJobs)
      .where(eq(auditJobs.id, jobId))
      .limit(1);

    if (!jobRecord || !jobRecord.metadata) {
      return {
        success: false,
        error: 'Job metadata not found',
        findings: [],
      };
    }

    const workspace = (jobRecord.metadata as any).workspace;
    if (!workspace) {
      return {
        success: false,
        error: 'Workspace info not found',
        findings: [],
      };
    }

    await context.onProgress?.(30, 'Publishing to GitHub...');

    // Publish audit results (includes tests if they exist)
    const result = await publishAuditResults(jobId, {
      includeTests: true,
      testsPath: workspace.testsPath,
      incrementalUpdate: true,
    });

    await context.onProgress?.(90, 'Published successfully');

    log.info('Published audit results to GitHub', {
      jobId,
      branch: result.branchName,
      commit: result.commitHash,
      url: result.repositoryUrl,
    });

    return {
      success: true,
      output: {
        branchName: result.branchName,
        commitHash: result.commitHash,
        repositoryUrl: result.repositoryUrl,
      },
      findings: [],
    };
  } catch (error: any) {
    log.error('Failed to publish to GitHub', {
      jobId,
      error: error.message,
    });

    return {
      success: false,
      error: `GitHub publish failed: ${error.message}`,
      findings: [],
    };
  }
};

// ============================================================================
// Executor Registry
// ============================================================================

const TESTING_EXECUTORS: Record<string, TestingExecutor> = {
  'generate-tests': generateTests,
  'publish-to-github': publishToGitHub,
};
