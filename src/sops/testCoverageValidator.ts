/**
 * Test Coverage Validator SOP
 * 
 * Analyzes existing test files to:
 * - Identify test categories (positive, negative, edge, security)
 * - Detect test frameworks (Jest, Vitest, Foundry, Hardhat)
 * - Report coverage gaps
 * - Generate suggestions for missing tests
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'node:path';
import fs from 'fs-extra';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);
const log = logger.child({ service: 'test-coverage-validator' });

// ============================================================================
// TYPES
// ============================================================================

export type TestCategory = 'positive' | 'negative' | 'edge' | 'security' | 'integration' | 'unit' | 'unknown';
export type TestFramework = 'foundry' | 'hardhat' | 'jest' | 'vitest' | 'mocha' | 'anchor' | 'rust' | 'unknown';

export interface TestFile {
    path: string;
    relativePath: string;
    framework: TestFramework;
    testCount: number;
    categories: TestCategory[];
    testNames: string[];
}

export interface CoverageGap {
    category: TestCategory;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    suggestion: string;
}

export interface TestCoverageReport {
    analyzedAt: string;
    projectPath: string;
    testFiles: TestFile[];
    frameworks: TestFramework[];
    summary: {
        totalTestFiles: number;
        totalTests: number;
        byCategory: Record<TestCategory, number>;
        byFramework: Record<TestFramework, number>;
    };
    coverageGaps: CoverageGap[];
    recommendations: string[];
}

// ============================================================================
// SHELL HELPERS
// ============================================================================

async function runShell(cmd: string, cwd: string, timeoutMs = 30000): Promise<string> {
    try {
        const { stdout } = await execAsync(cmd, {
            cwd,
            maxBuffer: 10 * 1024 * 1024,
            timeout: timeoutMs,
        });
        return stdout.trim();
    } catch {
        return '';
    }
}

// ============================================================================
// TEST FILE DETECTION
// ============================================================================

async function findTestFiles(projectPath: string): Promise<string[]> {
    log.debug('Finding test files via shell');

    const patterns = [
        // Foundry
        '-name "*.t.sol"',
        // JS/TS
        '-name "*.test.ts" -o -name "*.test.js"',
        '-name "*.spec.ts" -o -name "*.spec.js"',
        // Rust
        '-path "*/tests/*.rs"',
    ];

    const excludes = '-not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/target/*"';
    const cmd = `find . \\( ${patterns.join(' -o ')} \\) ${excludes} 2>/dev/null`;
    const output = await runShell(cmd, projectPath);

    return output.split('\n').filter(Boolean).map(f => f.replace(/^\.\//, ''));
}

// ============================================================================
// TEST ANALYSIS
// ============================================================================

function detectFramework(filePath: string, content: string): TestFramework {
    const ext = path.extname(filePath);

    if (ext === '.sol') {
        if (content.includes('forge-std')) return 'foundry';
        return 'foundry'; // Most .t.sol files are Foundry
    }

    if (filePath.includes('.rs') || ext === '.rs') {
        return 'rust';
    }

    if (content.includes('import { describe, it, expect } from')) return 'vitest';
    if (content.includes('vitest')) return 'vitest';
    if (content.includes('@jest')) return 'jest';
    if (content.includes('describe(') && content.includes('it(')) {
        if (content.includes('hardhat') || content.includes('ethers')) return 'hardhat';
        return 'mocha';
    }
    if (content.includes('anchor')) return 'anchor';

    return 'unknown';
}

function detectCategories(testNames: string[], content: string): TestCategory[] {
    const categories = new Set<TestCategory>();

    // Analyze test names
    for (const name of testNames) {
        const lower = name.toLowerCase();

        if (/revert|fail|error|invalid|reject|throw|panic/.test(lower)) {
            categories.add('negative');
        } else if (/edge|boundary|overflow|underflow|zero|max|min/.test(lower)) {
            categories.add('edge');
        } else if (/reentr|attack|exploit|hack|malicious|security|vuln/.test(lower)) {
            categories.add('security');
        } else if (/integration|e2e|end.?to.?end/.test(lower)) {
            categories.add('integration');
        } else if (/unit|should|can|does|basic|simple/.test(lower)) {
            categories.add('unit');
        } else {
            categories.add('positive');
        }
    }

    // Content-based detection
    if (/expectRevert|expect\(.+\)\.to\.be\.revertedWith|vm\.expectRevert/i.test(content)) {
        categories.add('negative');
    }
    if (/reentrancy|delegatecall\s*\(|selfdestruct/i.test(content)) {
        categories.add('security');
    }

    return Array.from(categories);
}

function extractTestNames(content: string, framework: TestFramework): string[] {
    const names: string[] = [];

    switch (framework) {
        case 'foundry':
            // function test_xxx() or function testXxx()
            const foundryMatches = content.matchAll(/function\s+(test[\w_]+)\s*\(/g);
            for (const m of foundryMatches) {
                names.push(m[1]);
            }
            break;

        case 'jest':
        case 'vitest':
        case 'mocha':
        case 'hardhat':
            // it('description', ...) or test('description', ...)
            const jsMatches = content.matchAll(/(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]/g);
            for (const m of jsMatches) {
                names.push(m[1]);
            }
            break;

        case 'rust':
            // #[test] fn test_name
            const rustMatches = content.matchAll(/#\[test\]\s*(?:async\s+)?fn\s+(\w+)/g);
            for (const m of rustMatches) {
                names.push(m[1]);
            }
            break;

        case 'anchor':
            // it("description")
            const anchorMatches = content.matchAll(/it\s*\(\s*['"`]([^'"`]+)['"`]/g);
            for (const m of anchorMatches) {
                names.push(m[1]);
            }
            break;
    }

    return names;
}

async function analyzeTestFile(projectPath: string, relativePath: string): Promise<TestFile> {
    const fullPath = path.join(projectPath, relativePath);
    const content = await fs.readFile(fullPath, 'utf-8');

    const framework = detectFramework(relativePath, content);
    const testNames = extractTestNames(content, framework);
    const categories = detectCategories(testNames, content);

    return {
        path: fullPath,
        relativePath,
        framework,
        testCount: testNames.length,
        categories,
        testNames,
    };
}

// ============================================================================
// GAP ANALYSIS
// ============================================================================

function identifyCoverageGaps(
    testFiles: TestFile[],
    projectHasContracts: boolean
): CoverageGap[] {
    const gaps: CoverageGap[] = [];
    const allCategories = testFiles.flatMap(f => f.categories);

    // Check for completely missing categories
    if (!allCategories.includes('negative') && testFiles.length > 0) {
        gaps.push({
            category: 'negative',
            description: 'No negative test cases found (revert/error scenarios)',
            severity: 'high',
            suggestion: 'Add tests that verify proper reversion on invalid inputs',
        });
    }

    if (!allCategories.includes('edge') && testFiles.length > 0) {
        gaps.push({
            category: 'edge',
            description: 'No edge case tests found (boundary conditions)',
            severity: 'medium',
            suggestion: 'Add tests for zero values, max values, and boundary conditions',
        });
    }

    if (!allCategories.includes('security') && projectHasContracts) {
        gaps.push({
            category: 'security',
            description: 'No security-focused tests found',
            severity: 'critical',
            suggestion: 'Add tests for reentrancy, access control, and common vulnerabilities',
        });
    }

    if (testFiles.length === 0) {
        gaps.push({
            category: 'unit',
            description: 'No test files found in the project',
            severity: 'critical',
            suggestion: 'Create a comprehensive test suite covering all major functions',
        });
    }

    return gaps;
}

function generateRecommendations(summary: TestCoverageReport['summary'], gaps: CoverageGap[]): string[] {
    const recs: string[] = [];

    if (summary.totalTestFiles === 0) {
        recs.push('Create a test suite using your preferred framework (Foundry, Hardhat, or Vitest)');
        return recs;
    }

    if (gaps.some(g => g.category === 'security')) {
        recs.push('Add security tests: reentrancy guards, access control, input validation');
    }

    if (gaps.some(g => g.category === 'negative')) {
        recs.push('Add revert tests: verify functions fail correctly on invalid inputs');
    }

    if (gaps.some(g => g.category === 'edge')) {
        recs.push('Add edge case tests: zero values, max uint256, empty arrays');
    }

    const positiveRatio = (summary.byCategory['positive'] || 0) / Math.max(summary.totalTests, 1);
    if (positiveRatio > 0.8) {
        recs.push('Consider balancing test types: add more negative and edge case tests');
    }

    return recs;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Validate test coverage for a project
 */
export async function validateTestCoverage(
    projectPath: string,
    hasContracts = true
): Promise<TestCoverageReport> {
    log.info('Starting test coverage validation', { projectPath });

    const testFilePaths = await findTestFiles(projectPath);
    const testFiles: TestFile[] = [];

    for (const relativePath of testFilePaths) {
        try {
            const analysis = await analyzeTestFile(projectPath, relativePath);
            testFiles.push(analysis);
        } catch (err) {
            log.warn('Failed to analyze test file', { relativePath, error: String(err) });
        }
    }

    // Aggregate frameworks
    const frameworks = [...new Set(testFiles.map(f => f.framework))];

    // Build summary
    const byCategory: Record<TestCategory, number> = {
        positive: 0, negative: 0, edge: 0, security: 0,
        integration: 0, unit: 0, unknown: 0,
    };
    const byFramework: Record<TestFramework, number> = {
        foundry: 0, hardhat: 0, jest: 0, vitest: 0,
        mocha: 0, anchor: 0, rust: 0, unknown: 0,
    };

    for (const f of testFiles) {
        byFramework[f.framework] = (byFramework[f.framework] || 0) + f.testCount;
        for (const cat of f.categories) {
            byCategory[cat] = (byCategory[cat] || 0) + f.testCount;
        }
    }

    const summary = {
        totalTestFiles: testFiles.length,
        totalTests: testFiles.reduce((sum, f) => sum + f.testCount, 0),
        byCategory,
        byFramework,
    };

    // Identify gaps
    const coverageGaps = identifyCoverageGaps(testFiles, hasContracts);
    const recommendations = generateRecommendations(summary, coverageGaps);

    const report: TestCoverageReport = {
        analyzedAt: new Date().toISOString(),
        projectPath,
        testFiles,
        frameworks,
        summary,
        coverageGaps,
        recommendations,
    };

    log.info('Test coverage validation complete', {
        totalTestFiles: summary.totalTestFiles,
        totalTests: summary.totalTests,
        gaps: coverageGaps.length,
    });

    return report;
}

export default { validateTestCoverage };
