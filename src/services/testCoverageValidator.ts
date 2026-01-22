/**
 * Test Coverage Validator
 *
 * Ensures generated tests actually cover the findings they claim to test.
 * This is critical for meaningful security validation.
 */

import type { AuditFinding, GeneratedTest } from './testCaseGenerator.js';

export interface TestCoverageReport {
  totalFindings: number;
  criticalFindings: number;
  highFindings: number;
  findingsWithTests: number;
  findingsWithoutTests: string[]; // Finding IDs that lack tests
  testCoverage: number; // Percentage
  testToFindingMap: Map<string, string>; // testId -> findingId
  findingToTestsMap: Map<string, string[]>; // findingId -> testIds[]
  coverageGaps: CoverageGap[];
}

export interface CoverageGap {
  findingId: string;
  findingTitle: string;
  severity: string;
  reason: string;
  recommendation: string;
}

/**
 * Validate that tests adequately cover findings
 */
export function validateTestCoverage(
  findings: AuditFinding[],
  tests: GeneratedTest[]
): TestCoverageReport {
  const testToFindingMap = new Map<string, string>();
  const findingToTestsMap = new Map<string, string[]>();
  const coverageGaps: CoverageGap[] = [];

  // Build mapping of tests to findings
  for (const test of tests) {
    testToFindingMap.set(test.testFileName, test.findingId);

    if (!findingToTestsMap.has(test.findingId)) {
      findingToTestsMap.set(test.findingId, []);
    }
    findingToTestsMap.get(test.findingId)!.push(test.testFileName);
  }

  // Filter to critical/high severity findings (these MUST have tests)
  const criticalHighFindings = findings.filter(
    f => f.severity === 'critical' || f.severity === 'high'
  );

  const findingsWithoutTests: string[] = [];

  // Check each critical/high finding has at least one test
  for (const finding of criticalHighFindings) {
    const testsForFinding = findingToTestsMap.get(finding.id);

    if (!testsForFinding || testsForFinding.length === 0) {
      findingsWithoutTests.push(finding.id);
      coverageGaps.push({
        findingId: finding.id,
        findingTitle: finding.title,
        severity: finding.severity,
        reason: 'No test generated for this finding',
        recommendation: 'Generate test case to validate this security issue',
      });
    } else {
      // Validate test quality (basic checks)
      const testQualityIssues = validateTestQuality(finding, testsForFinding, tests);
      if (testQualityIssues.length > 0) {
        coverageGaps.push({
          findingId: finding.id,
          findingTitle: finding.title,
          severity: finding.severity,
          reason: testQualityIssues.join('; '),
          recommendation: 'Improve test coverage for this finding',
        });
      }
    }
  }

  const testCoverage = criticalHighFindings.length > 0
    ? ((criticalHighFindings.length - findingsWithoutTests.length) / criticalHighFindings.length) * 100
    : 100;

  return {
    totalFindings: findings.length,
    criticalFindings: findings.filter(f => f.severity === 'critical').length,
    highFindings: findings.filter(f => f.severity === 'high').length,
    findingsWithTests: criticalHighFindings.length - findingsWithoutTests.length,
    findingsWithoutTests,
    testCoverage,
    testToFindingMap,
    findingToTestsMap,
    coverageGaps,
  };
}

/**
 * Validate test quality by checking test structure and content
 */
function validateTestQuality(
  finding: AuditFinding,
  testFileNames: string[],
  allTests: GeneratedTest[]
): string[] {
  const issues: string[] = [];

  for (const testFileName of testFileNames) {
    const test = allTests.find(t => t.testFileName === testFileName);
    if (!test) continue;

    const testCode = test.testCode.toLowerCase();

    // Check for positive testing
    if (!testCode.includes('test_positive') && !testCode.includes('legitimate')) {
      issues.push('Missing positive test cases (legitimate behavior)');
    }

    // Check for negative testing
    if (!testCode.includes('test_negative') && !testCode.includes('exploit') && !testCode.includes('attack')) {
      issues.push('Missing negative test cases (exploit scenarios)');
    }

    // Check for STRIDE coverage (at least one STRIDE test)
    const hasStride = testCode.includes('stride') ||
                      testCode.includes('spoofing') ||
                      testCode.includes('tampering') ||
                      testCode.includes('elevation');

    if (!hasStride) {
      issues.push('Missing STRIDE framework testing');
    }

    // Check for OWASP coverage
    const hasOwasp = testCode.includes('owasp') ||
                     testCode.includes('reentrancy') ||
                     testCode.includes('access control') ||
                     testCode.includes('arithmetic');

    if (!hasOwasp) {
      issues.push('Missing OWASP framework testing');
    }

    // Check test has proper documentation
    if (!testCode.includes('purpose') && !testCode.includes('goal')) {
      issues.push('Missing test documentation (PURPOSE/GOAL)');
    }

    // Check test maps to finding
    if (!testCode.includes(finding.id) && !testCode.includes(finding.findingId)) {
      issues.push('Test does not explicitly reference finding ID');
    }
  }

  // Remove duplicates
  return [...new Set(issues)];
}

/**
 * Generate coverage report markdown
 */
export function generateCoverageReport(report: TestCoverageReport): string {
  let markdown = `# Test Coverage Report\n\n`;

  markdown += `## Summary\n\n`;
  markdown += `- **Total Findings**: ${report.totalFindings}\n`;
  markdown += `- **Critical Findings**: ${report.criticalFindings}\n`;
  markdown += `- **High Findings**: ${report.highFindings}\n`;
  markdown += `- **Findings with Tests**: ${report.findingsWithTests}\n`;
  markdown += `- **Test Coverage**: ${report.testCoverage.toFixed(1)}%\n\n`;

  if (report.testCoverage >= 90) {
    markdown += `✅ **Excellent** - Test coverage exceeds 90%\n\n`;
  } else if (report.testCoverage >= 75) {
    markdown += `⚠️ **Good** - Test coverage is above 75% but could be improved\n\n`;
  } else {
    markdown += `❌ **Poor** - Test coverage is below 75% - critical gaps exist\n\n`;
  }

  if (report.coverageGaps.length > 0) {
    markdown += `## Coverage Gaps\n\n`;
    markdown += `The following findings lack adequate test coverage:\n\n`;

    for (const gap of report.coverageGaps) {
      markdown += `### ${gap.findingTitle}\n\n`;
      markdown += `- **Finding ID**: ${gap.findingId}\n`;
      markdown += `- **Severity**: ${gap.severity}\n`;
      markdown += `- **Issue**: ${gap.reason}\n`;
      markdown += `- **Recommendation**: ${gap.recommendation}\n\n`;
    }
  }

  markdown += `## Finding-to-Test Mapping\n\n`;
  markdown += `| Finding ID | Tests Generated |\n`;
  markdown += `|------------|----------------|\n`;

  report.findingToTestsMap.forEach((tests, findingId) => {
    markdown += `| ${findingId} | ${tests.length} test(s) |\n`;
  });

  return markdown;
}

/**
 * Ensure minimum test coverage threshold is met
 */
export function enforceMinimumCoverage(
  report: TestCoverageReport,
  minimumThreshold: number = 75
): { passed: boolean; message: string } {
  if (report.testCoverage >= minimumThreshold) {
    return {
      passed: true,
      message: `Test coverage (${report.testCoverage.toFixed(1)}%) meets minimum threshold (${minimumThreshold}%)`,
    };
  }

  return {
    passed: false,
    message: `Test coverage (${report.testCoverage.toFixed(1)}%) is below minimum threshold (${minimumThreshold}%). ${report.findingsWithoutTests.length} critical/high findings lack tests.`,
  };
}
