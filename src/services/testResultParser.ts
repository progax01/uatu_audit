/**
 * Test Result Parser
 *
 * Parses test framework output (Forge, Hardhat) into structured TestCase objects.
 * Used in Deep Scan to display individual test results in UI tables.
 */

import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'test-result-parser' });

// ============================================================================
// TYPES
// ============================================================================

export interface TestCase {
  id: string;
  name: string;
  contract: string;
  function: string;
  type: 'behavioral' | 'stride' | 'owasp' | 'fuzzing' | 'unit';
  status: 'passed' | 'failed' | 'skipped';
  duration: number; // milliseconds
  gasUsed?: number;
  error?: string;
  severity?: 'critical' | 'high' | 'medium';
  file?: string;
  line?: number;
}

export interface TestExecutionStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number; // total milliseconds
}

export interface ParsedTestResults {
  framework: 'foundry' | 'hardhat';
  testCases: TestCase[];
  stats: TestExecutionStats;
  rawOutput: string;
}

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parse test output from Forge or Hardhat
 */
export function parseTestOutput(
  output: string,
  framework: 'foundry' | 'hardhat'
): ParsedTestResults | null {
  if (!output || output.trim().length === 0) {
    log.warn('Empty test output provided');
    return null;
  }

  try {
    if (framework === 'foundry') {
      return parseForgeTestOutput(output);
    } else {
      return parseHardhatTestOutput(output);
    }
  } catch (error: any) {
    log.error('Failed to parse test output', { framework, error: error.message });
    return null;
  }
}

// ============================================================================
// FORGE/FOUNDRY PARSER
// ============================================================================

/**
 * Parse Foundry/Forge test output
 *
 * Format examples:
 * [PASS] testTransfer() (gas: 28532)
 * [FAIL. Reason: Arithmetic underflow] testOverflow() (gas: 15234)
 * [SKIP] testPendingFeature()
 *
 * Test result: FAILED. 5 passed; 2 failed; finished in 3.21s
 */
function parseForgeTestOutput(output: string): ParsedTestResults {
  const testCases: TestCase[] = [];

  // Regex to match test results
  // Captures: [STATUS] contractName::functionName (gas: XXXX)
  const testRegex = /\[(PASS|FAIL|SKIP)[^\]]*\]\s+([^:]+)::(\w+)\s*\(gas:\s*(\d+)\)?/g;

  // Alternative regex for simpler format without contract name
  const simpleTestRegex = /\[(PASS|FAIL|SKIP)[^\]]*\]\s+(\w+)\s*\(gas:\s*(\d+)\)?/g;

  let match;
  let testId = 0;

  // Try detailed format first
  while ((match = testRegex.exec(output)) !== null) {
    const [, status, contract, functionName, gas] = match;

    // Extract error message if failed
    let errorMessage: string | undefined;
    if (status === 'FAIL') {
      const reasonMatch = match[0].match(/Reason:\s*([^\]]+)/);
      if (reasonMatch) {
        errorMessage = reasonMatch[1].trim();
      }
    }

    // Determine test type from function name
    const testType = inferTestType(functionName);

    // Determine severity for failed tests
    const severity = status === 'FAIL' ? inferSeverity(functionName, errorMessage) : undefined;

    testCases.push({
      id: `test-${testId++}`,
      name: functionName,
      contract: contract.trim(),
      function: functionName,
      type: testType,
      status: mapForgeStatus(status),
      duration: 0, // Forge doesn't provide individual test duration
      gasUsed: parseInt(gas),
      error: errorMessage,
      severity,
    });
  }

  // If no matches, try simple format
  if (testCases.length === 0) {
    while ((match = simpleTestRegex.exec(output)) !== null) {
      const [, status, functionName, gas] = match;

      let errorMessage: string | undefined;
      if (status === 'FAIL') {
        const reasonMatch = match[0].match(/Reason:\s*([^\]]+)/);
        if (reasonMatch) {
          errorMessage = reasonMatch[1].trim();
        }
      }

      const testType = inferTestType(functionName);
      const severity = status === 'FAIL' ? inferSeverity(functionName, errorMessage) : undefined;

      testCases.push({
        id: `test-${testId++}`,
        name: functionName,
        contract: 'Unknown',
        function: functionName,
        type: testType,
        status: mapForgeStatus(status),
        duration: 0,
        gasUsed: parseInt(gas),
        error: errorMessage,
        severity,
      });
    }
  }

  // Parse summary line for stats
  const stats = parseForgeStats(output, testCases.length);

  return {
    framework: 'foundry',
    testCases,
    stats,
    rawOutput: output,
  };
}

function mapForgeStatus(status: string): 'passed' | 'failed' | 'skipped' {
  if (status === 'PASS') return 'passed';
  if (status === 'FAIL') return 'failed';
  return 'skipped';
}

function parseForgeStats(output: string, testCount: number): TestExecutionStats {
  // Look for summary: "Test result: FAILED. 5 passed; 2 failed; finished in 3.21s"
  const summaryMatch = output.match(/Test result:\s+\w+\.\s+(\d+)\s+passed;\s+(\d+)\s+failed(?:;\s+(\d+)\s+skipped)?.*?finished in\s+([\d.]+)s/);

  if (summaryMatch) {
    const passed = parseInt(summaryMatch[1]);
    const failed = parseInt(summaryMatch[2]);
    const skipped = summaryMatch[3] ? parseInt(summaryMatch[3]) : 0;
    const duration = parseFloat(summaryMatch[4]) * 1000; // convert to ms

    return {
      total: passed + failed + skipped,
      passed,
      failed,
      skipped,
      duration,
    };
  }

  // Fallback: count from test cases
  const passed = testCount - (output.match(/\[FAIL/g) || []).length;
  const failed = (output.match(/\[FAIL/g) || []).length;
  const skipped = (output.match(/\[SKIP/g) || []).length;

  return {
    total: testCount,
    passed,
    failed,
    skipped,
    duration: 0,
  };
}

// ============================================================================
// HARDHAT PARSER
// ============================================================================

/**
 * Parse Hardhat test output
 *
 * Format examples:
 *   ✓ should transfer tokens (234ms)
 *   1) should fail on overflow
 *   - should skip this test
 *
 * Summary: 10 passing (3s), 2 failing, 1 pending
 */
function parseHardhatTestOutput(output: string): ParsedTestResults {
  const testCases: TestCase[] = [];

  // Regex to match Hardhat test results
  // ✓ testName (duration)
  const passRegex = /✓\s+(.+?)\s*\((\d+)ms\)/g;

  // 1) testName or ✗ testName
  const failRegex = /(?:\d+\)|✗)\s+(.+)/g;

  // - testName
  const skipRegex = /-\s+(.+)/g;

  let testId = 0;
  let currentContract = 'Unknown';

  // Extract contract/describe blocks
  const lines = output.split('\n');

  for (const line of lines) {
    // Check for contract/describe block
    const contractMatch = line.match(/^\s*([\w\s]+)$/);
    if (contractMatch && !line.includes('✓') && !line.includes('✗') && !line.includes('-')) {
      const potentialContract = contractMatch[1].trim();
      if (potentialContract.length > 0 && potentialContract.length < 50) {
        currentContract = potentialContract;
      }
    }
  }

  // Parse passing tests
  let match;
  while ((match = passRegex.exec(output)) !== null) {
    const [, testName, duration] = match;

    const testType = inferTestType(testName);

    testCases.push({
      id: `test-${testId++}`,
      name: testName.trim(),
      contract: currentContract,
      function: extractFunctionName(testName),
      type: testType,
      status: 'passed',
      duration: parseInt(duration),
      gasUsed: undefined, // Hardhat doesn't report gas in test output by default
    });
  }

  // Parse failing tests
  while ((match = failRegex.exec(output)) !== null) {
    const testName = match[1].trim();

    // Extract error message (usually on next lines)
    const errorMatch = output.substring(match.index).match(/Error:\s*(.+?)(?:\n\s*at|$)/s);
    const errorMessage = errorMatch ? errorMatch[1].trim() : undefined;

    const testType = inferTestType(testName);
    const severity = inferSeverity(testName, errorMessage);

    testCases.push({
      id: `test-${testId++}`,
      name: testName,
      contract: currentContract,
      function: extractFunctionName(testName),
      type: testType,
      status: 'failed',
      duration: 0,
      error: errorMessage,
      severity,
    });
  }

  // Parse skipped tests
  while ((match = skipRegex.exec(output)) !== null) {
    const testName = match[1].trim();
    const testType = inferTestType(testName);

    testCases.push({
      id: `test-${testId++}`,
      name: testName,
      contract: currentContract,
      function: extractFunctionName(testName),
      type: testType,
      status: 'skipped',
      duration: 0,
    });
  }

  // Parse summary
  const stats = parseHardhatStats(output, testCases.length);

  return {
    framework: 'hardhat',
    testCases,
    stats,
    rawOutput: output,
  };
}

function parseHardhatStats(output: string, testCount: number): TestExecutionStats {
  // Look for summary: "10 passing (3s), 2 failing, 1 pending"
  const summaryMatch = output.match(/(\d+)\s+passing\s*\(([\d.]+)s\)(?:,\s*(\d+)\s+failing)?(?:,\s*(\d+)\s+pending)?/);

  if (summaryMatch) {
    const passed = parseInt(summaryMatch[1]);
    const duration = parseFloat(summaryMatch[2]) * 1000; // convert to ms
    const failed = summaryMatch[3] ? parseInt(summaryMatch[3]) : 0;
    const skipped = summaryMatch[4] ? parseInt(summaryMatch[4]) : 0;

    return {
      total: passed + failed + skipped,
      passed,
      failed,
      skipped,
      duration,
    };
  }

  // Fallback: count from test cases
  const passed = testCount - (output.match(/✗/g) || []).length;
  const failed = (output.match(/✗/g) || []).length;
  const skipped = (output.match(/^\s*-\s+/gm) || []).length;

  return {
    total: testCount,
    passed,
    failed,
    skipped,
    duration: 0,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Infer test type from function/test name
 */
function inferTestType(testName: string): TestCase['type'] {
  const lower = testName.toLowerCase();

  if (lower.includes('fuzz') || lower.includes('invariant')) {
    return 'fuzzing';
  }

  if (lower.includes('stride') || lower.includes('spoofing') || lower.includes('tampering') ||
      lower.includes('repudiation') || lower.includes('disclosure') || lower.includes('denial') ||
      lower.includes('elevation')) {
    return 'stride';
  }

  if (lower.includes('owasp') || lower.includes('injection') || lower.includes('xss') ||
      lower.includes('csrf') || lower.includes('broken')) {
    return 'owasp';
  }

  if (lower.includes('behavior') || lower.includes('scenario') || lower.includes('workflow')) {
    return 'behavioral';
  }

  return 'unit';
}

/**
 * Infer severity for failed tests
 */
function inferSeverity(testName: string, errorMessage?: string): 'critical' | 'high' | 'medium' {
  const lower = testName.toLowerCase();
  const errorLower = errorMessage?.toLowerCase() || '';

  // Critical indicators
  if (lower.includes('critical') || lower.includes('auth') || lower.includes('owner') ||
      lower.includes('reentrancy') || lower.includes('selfdestruct') ||
      errorLower.includes('underflow') || errorLower.includes('overflow')) {
    return 'critical';
  }

  // High indicators
  if (lower.includes('security') || lower.includes('access') || lower.includes('permission') ||
      lower.includes('vulnerability') || errorLower.includes('revert') || errorLower.includes('assert')) {
    return 'high';
  }

  return 'medium';
}

/**
 * Extract function name from test description
 */
function extractFunctionName(testName: string): string {
  // Remove common prefixes
  let name = testName
    .replace(/^(should|test|it)\s+/i, '')
    .replace(/\s+/g, '_')
    .toLowerCase();

  // Truncate if too long
  if (name.length > 50) {
    name = name.substring(0, 47) + '...';
  }

  return name;
}

/**
 * Generate unique test ID
 */
function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  parseTestOutput,
  parseForgeTestOutput,
  parseHardhatTestOutput,
};
