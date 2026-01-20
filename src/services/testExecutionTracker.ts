/**
 * Test Execution Tracker
 *
 * Generates clear, user-facing reports about test execution status.
 * Explains why tests didn't run with actionable messages.
 */

import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'test-execution-tracker' });

export interface TestExecutionReport {
  executed: boolean;
  reason: string;
  stats?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  duration?: number; // milliseconds
  framework?: 'hardhat' | 'foundry' | 'truffle' | 'brownie' | 'unknown';
}

/**
 * Generate a test execution report with clear explanations
 */
export function generateTestExecutionReport(
  testsExist: boolean,
  compilationSuccess: boolean,
  testResult: any,
  skipReason?: string,
  framework?: string
): TestExecutionReport {
  // Tests ran successfully
  if (testResult?.success !== undefined || testResult?.stats) {
    const stats = getTestStats(testResult);
    const passed = stats.passed;
    const total = stats.total;

    return {
      executed: true,
      reason: `Tests completed: ${passed}/${total} passed`,
      stats,
      duration: testResult.executionTimeMs || testResult.duration,
      framework: framework as any
    };
  }

  // Tests exist but didn't run - determine why
  if (testsExist) {
    if (!compilationSuccess) {
      return {
        executed: false,
        reason: 'Tests skipped: Compilation failed. Fix compilation errors to run tests.',
        framework: framework as any
      };
    }

    if (skipReason) {
      return {
        executed: false,
        reason: `Tests skipped: ${skipReason}`,
        framework: framework as any
      };
    }

    return {
      executed: false,
      reason: 'Tests skipped: Unknown error during test execution',
      framework: framework as any
    };
  }

  // No tests found
  return {
    executed: false,
    reason: 'No test files found in project (test/, tests/, *.t.sol)',
    framework: framework as any
  };
}

/**
 * Extract test statistics from test result object
 */
export function getTestStats(testResult: any): {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
} {
  // Handle different test result formats

  // Format 1: Direct stats object
  if (testResult.stats) {
    return {
      total: testResult.stats.total || 0,
      passed: testResult.stats.passed || testResult.stats.passing || 0,
      failed: testResult.stats.failed || testResult.stats.failures || 0,
      skipped: testResult.stats.skipped || testResult.stats.pending || 0,
    };
  }

  // Format 2: Hardhat/Mocha style (passing, failing, pending)
  if (testResult.passing !== undefined || testResult.failures !== undefined) {
    const passing = testResult.passing || 0;
    const failing = testResult.failures || 0;
    const pending = testResult.pending || 0;
    return {
      total: passing + failing + pending,
      passed: passing,
      failed: failing,
      skipped: pending,
    };
  }

  // Format 3: Foundry style (testsPassed, testsFailed)
  if (testResult.testsPassed !== undefined || testResult.testsFailed !== undefined) {
    const passed = testResult.testsPassed || 0;
    const failed = testResult.testsFailed || 0;
    const skipped = testResult.testsSkipped || 0;
    return {
      total: passed + failed + skipped,
      passed,
      failed,
      skipped,
    };
  }

  // Format 4: Count-based (total, passed, failed)
  if (testResult.total !== undefined) {
    return {
      total: testResult.total || 0,
      passed: testResult.passed || 0,
      failed: testResult.failed || 0,
      skipped: testResult.skipped || 0,
    };
  }

  // Default: assume no tests
  log.warn('Could not parse test stats from result', {
    resultKeys: Object.keys(testResult || {}),
  });

  return {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  };
}

/**
 * Generate user-friendly skip reason based on step data
 */
export function generateTestSkipReason(
  stepData: Map<string, any>,
  currentStepId: string
): string | undefined {
  // Check if compilation failed
  const compilationSuccess = stepData.get('compilationSuccess');
  if (compilationSuccess === false) {
    return 'Compilation failed. Fix compilation errors to enable tests.';
  }

  // Check if tests exist
  const testsExist = stepData.get('testsExist');
  if (testsExist === false) {
    return 'No test files found. Add tests in test/ or tests/ directory.';
  }

  // Check if framework tool is missing
  const frameworkDetected = stepData.get('detectedFramework');
  if (currentStepId.includes('hardhat') && !frameworkDetected?.includes('hardhat')) {
    return 'Hardhat not found. Install Hardhat to run tests.';
  }
  if (currentStepId.includes('foundry') && !frameworkDetected?.includes('foundry')) {
    return 'Foundry not found. Install Foundry to run tests.';
  }

  // Check for dependency issues
  const dependenciesInstalled = stepData.get('dependenciesInstalled');
  if (dependenciesInstalled === false) {
    return 'Dependencies not installed. Run npm install or yarn install.';
  }

  // Check if step timed out
  const timeout = stepData.get('timeout');
  if (timeout === true) {
    return 'Test execution timed out (exceeded 5 minutes).';
  }

  // Generic skip reason
  return 'Required preconditions not met for test execution.';
}

/**
 * Check if test step should be skipped based on audit depth
 */
export function shouldSkipTests(auditDepth: 'quick' | 'standard' | 'deep'): {
  skip: boolean;
  reason?: string;
} {
  if (auditDepth === 'quick') {
    return {
      skip: true,
      reason: 'Quick scan mode does not execute tests (use Standard or Deep scan).',
    };
  }

  return { skip: false };
}

/**
 * Format test duration for display
 */
export function formatTestDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
