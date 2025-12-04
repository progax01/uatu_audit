import fs from "fs-extra";
import path from "node:path";
import { ProjectStructure } from "./projectAnalyzer.js";
import { TestPlan } from "./testPlanGenerator.js";
import { JourneyTestGenerator, JourneyType } from "./journeyTestGenerator.js";
import { logger } from "../utils/logger.js";

const log = logger.child({ module: 'testGapAnalyzer' });

export interface TestGap {
  category: "coverage" | "behavioral" | "stride" | "journey" | "security" | "performance";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  recommendation: string;
  affectedFiles: string[];
  estimatedEffort: "small" | "medium" | "large";
}

export interface TestDiscovery {
  existingTests: {
    files: string[];
    frameworks: string[];
    totalTests: number;
    coverage: {
      statements?: number;
      branches?: number;
      functions?: number;
    };
  };
  gaps: TestGap[];
  recommendations: {
    priority: "high" | "medium" | "low";
    action: string;
    rationale: string;
  }[];
  journeyOpportunities: JourneyType[];
  testabilityScore: number; // 0-100
}

export class TestGapAnalyzer {
  
  static async analyzeTestGaps(
    projectStructure: ProjectStructure,
    testPlans: TestPlan[],
    runPath: string
  ): Promise<TestDiscovery> {
    log.info('Starting test gap analysis');
    
    const existingTests = await this.discoverExistingTests(projectStructure);
    const gaps = await this.identifyGaps(projectStructure, testPlans, existingTests);
    const journeyOpportunities = JourneyTestGenerator.getRecommendedJourneys(projectStructure);
    const recommendations = this.generateRecommendations(gaps, journeyOpportunities);
    const testabilityScore = this.calculateTestabilityScore(projectStructure, existingTests, gaps);
    
    const discovery: TestDiscovery = {
      existingTests,
      gaps,
      recommendations,
      journeyOpportunities,
      testabilityScore
    };
    
    // Write gap analysis to run directory
    await fs.writeJson(path.join(runPath, "test-gap-analysis.json"), discovery, { spaces: 2 });
    
    log.info('Test gap analysis completed', {
      totalGaps: gaps.length,
      criticalGaps: gaps.filter(g => g.severity === "critical").length,
      testabilityScore
    });
    
    return discovery;
  }
  
  private static async discoverExistingTests(projectStructure: ProjectStructure) {
    const frameworks = new Set<string>();
    let totalTests = 0;
    
    // Analyze test files to detect frameworks and count tests
    for (const testFile of projectStructure.testFiles) {
      try {
        const content = await fs.readFile(testFile, 'utf8');
        
        // Detect test frameworks
        if (content.includes('describe(') || content.includes('it(')) {
          frameworks.add('mocha/jest');
        }
        if (content.includes('forge-std/Test.sol')) {
          frameworks.add('foundry');
        }
        if (content.includes('#[test]') || content.includes('#[tokio::test]')) {
          frameworks.add('rust-test');
        }
        if (content.includes('anchor.workspace')) {
          frameworks.add('anchor');
        }
        
        // Count test functions (rough estimation)
        const testMatches = content.match(/(?:test_|it\(|#\[test\])/g);
        if (testMatches) {
          totalTests += testMatches.length;
        }
      } catch (error) {
        log.debug('Failed to read test file', { testFile, error: String(error) });
      }
    }
    
    return {
      files: projectStructure.testFiles,
      frameworks: Array.from(frameworks),
      totalTests,
      coverage: {
        statements: 0, // Would be populated by coverage extraction
        branches: 0,
        functions: 0
      }
    };
  }
  
  private static async identifyGaps(
    projectStructure: ProjectStructure,
    testPlans: TestPlan[],
    existingTests: any
  ): Promise<TestGap[]> {
    const gaps: TestGap[] = [];
    
    // Check for basic test coverage gaps
    if (projectStructure.mainContracts.length > 0 && existingTests.files.length === 0) {
      gaps.push({
        category: "coverage",
        severity: "critical",
        description: "No tests found for smart contracts",
        recommendation: "Implement comprehensive test suite covering all public/external functions",
        affectedFiles: projectStructure.mainContracts,
        estimatedEffort: "large"
      });
    }
    
    // Check for security-specific test gaps
    if (projectStructure.securityConcerns.length > 0) {
      const hasSecurityTests = existingTests.files.some((file: string) => 
        file.toLowerCase().includes('security') || 
        file.toLowerCase().includes('attack') ||
        file.toLowerCase().includes('exploit')
      );
      
      if (!hasSecurityTests) {
        gaps.push({
          category: "security",
          severity: "high",
          description: "No security-focused tests detected despite security concerns",
          recommendation: "Add security test suite covering identified vulnerabilities",
          affectedFiles: projectStructure.criticalPaths,
          estimatedEffort: "medium"
        });
      }
    }
    
    // Check for behavioral test gaps
    const behavioralPlan = testPlans.find(p => p.style === "behavioral");
    if (behavioralPlan && behavioralPlan.matrix.length > existingTests.totalTests) {
      gaps.push({
        category: "behavioral",
        severity: "medium",
        description: "Insufficient behavioral test coverage (Happy/Negative/Sad/Neutral paths)",
        recommendation: "Implement behavioral tests for all identified scenarios",
        affectedFiles: behavioralPlan.matrix.map(m => m.target),
        estimatedEffort: "medium"
      });
    }
    
    // Check for STRIDE test gaps
    const stridePlan = testPlans.find(p => p.style === "stride");
    if (stridePlan && stridePlan.matrix.length > 0) {
      const hasStrideTests = existingTests.files.some((file: string) => 
        file.toLowerCase().includes('stride') ||
        file.toLowerCase().includes('threat') ||
        file.toLowerCase().includes('spoofing') ||
        file.toLowerCase().includes('tampering')
      );
      
      if (!hasStrideTests) {
        gaps.push({
          category: "stride",
          severity: "high",
          description: "No STRIDE threat modeling tests found",
          recommendation: "Implement STRIDE-based security tests",
          affectedFiles: stridePlan.matrix.map(m => m.target),
          estimatedEffort: "medium"
        });
      }
    }
    
    // Check for integration test gaps
    if (projectStructure.mainContracts.length > 1) {
      const hasIntegrationTests = existingTests.files.some((file: string) => 
        file.toLowerCase().includes('integration') ||
        file.toLowerCase().includes('e2e') ||
        file.toLowerCase().includes('end')
      );
      
      if (!hasIntegrationTests) {
        gaps.push({
          category: "coverage",
          severity: "medium",
          description: "No integration tests for multi-contract system",
          recommendation: "Add integration tests covering contract interactions",
          affectedFiles: projectStructure.mainContracts,
          estimatedEffort: "medium"
        });
      }
    }
    
    // Check for performance test gaps
    const hasPerformanceTests = existingTests.files.some((file: string) => 
      file.toLowerCase().includes('performance') ||
      file.toLowerCase().includes('gas') ||
      file.toLowerCase().includes('bench')
    );
    
    if (!hasPerformanceTests && projectStructure.ecosystems.includes('solidity')) {
      gaps.push({
        category: "performance",
        severity: "low",
        description: "No gas optimization or performance tests found",
        recommendation: "Add gas usage tests and optimization benchmarks",
        affectedFiles: projectStructure.mainContracts,
        estimatedEffort: "small"
      });
    }
    
    // Check ecosystem-specific gaps
    gaps.push(...this.checkEcosystemSpecificGaps(projectStructure, existingTests));
    
    return gaps;
  }
  
  private static checkEcosystemSpecificGaps(projectStructure: ProjectStructure, existingTests: any): TestGap[] {
    const gaps: TestGap[] = [];
    
    // Solidity-specific gaps
    if (projectStructure.ecosystems.includes('solidity')) {
      // Check for reentrancy tests
      const hasReentrancyTests = existingTests.files.some((file: string) => {
        // This would check file content for reentrancy test patterns
        return file.toLowerCase().includes('reentrancy');
      });
      
      if (!hasReentrancyTests) {
        gaps.push({
          category: "security",
          severity: "high",
          description: "No reentrancy attack tests found for Solidity contracts",
          recommendation: "Add comprehensive reentrancy tests for all external calls",
          affectedFiles: projectStructure.mainContracts,
          estimatedEffort: "medium"
        });
      }
      
      // Check for access control tests
      if (projectStructure.securityConcerns.some(concern => concern.toLowerCase().includes('owner'))) {
        const hasAccessTests = existingTests.files.some((file: string) => 
          file.toLowerCase().includes('access') || file.toLowerCase().includes('auth')
        );
        
        if (!hasAccessTests) {
          gaps.push({
            category: "security",
            severity: "high",
            description: "Access control patterns detected but no corresponding tests found",
            recommendation: "Add access control tests for all protected functions",
            affectedFiles: projectStructure.mainContracts,
            estimatedEffort: "small"
          });
        }
      }
    }
    
    // Anchor-specific gaps
    if (projectStructure.ecosystems.includes('anchor')) {
      gaps.push({
        category: "security",
        severity: "medium",
        description: "Anchor programs require PDA seed and constraint validation tests",
        recommendation: "Add tests for account validation, seeds, and constraints",
        affectedFiles: projectStructure.mainContracts,
        estimatedEffort: "medium"
      });
    }
    
    return gaps;
  }
  
  private static generateRecommendations(gaps: TestGap[], journeyOpportunities: JourneyType[]) {
    const recommendations = [];
    
    // Prioritize by severity
    const criticalGaps = gaps.filter(g => g.severity === "critical");
    const highGaps = gaps.filter(g => g.severity === "high");
    
    if (criticalGaps.length > 0) {
      recommendations.push({
        priority: "high" as const,
        action: "Immediately implement basic test coverage",
        rationale: `${criticalGaps.length} critical test gaps found that could lead to undetected vulnerabilities`
      });
    }
    
    if (highGaps.length > 0) {
      recommendations.push({
        priority: "high" as const,
        action: "Add security-focused test suites",
        rationale: `${highGaps.length} high-severity gaps in security testing detected`
      });
    }
    
    if (journeyOpportunities.length > 0) {
      recommendations.push({
        priority: "medium" as const,
        action: `Implement journey-based tests for: ${journeyOpportunities.slice(0, 3).join(', ')}`,
        rationale: "Complex user flows detected that would benefit from end-to-end testing"
      });
    }
    
    const behavioralGaps = gaps.filter(g => g.category === "behavioral");
    if (behavioralGaps.length > 0) {
      recommendations.push({
        priority: "medium" as const,
        action: "Implement behavioral test patterns (Happy/Negative/Sad/Neutral)",
        rationale: "Systematic behavioral coverage will improve edge case detection"
      });
    }
    
    const performanceGaps = gaps.filter(g => g.category === "performance");
    if (performanceGaps.length > 0) {
      recommendations.push({
        priority: "low" as const,
        action: "Add performance and gas optimization tests",
        rationale: "Performance testing will help optimize deployment costs and user experience"
      });
    }
    
    return recommendations;
  }
  
  private static calculateTestabilityScore(
    projectStructure: ProjectStructure,
    existingTests: any,
    gaps: TestGap[]
  ): number {
    let score = 0;
    
    // Base score for having tests at all
    if (existingTests.files.length > 0) score += 20;
    
    // Score for test-to-contract ratio
    if (projectStructure.mainContracts.length > 0) {
      const ratio = existingTests.files.length / projectStructure.mainContracts.length;
      score += Math.min(30, ratio * 15); // Up to 30 points
    }
    
    // Score for framework diversity
    score += Math.min(15, existingTests.frameworks.length * 7.5);
    
    // Score for total test count
    score += Math.min(20, existingTests.totalTests * 2);
    
    // Deduct for critical gaps
    const criticalGaps = gaps.filter(g => g.severity === "critical").length;
    score -= criticalGaps * 15;
    
    // Deduct for high-severity gaps
    const highGaps = gaps.filter(g => g.severity === "high").length;
    score -= highGaps * 5;
    
    // Bonus for security focus
    const hasSecurityTests = existingTests.files.some((file: string) => 
      file.toLowerCase().includes('security') || file.toLowerCase().includes('audit')
    );
    if (hasSecurityTests) score += 15;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }
}
