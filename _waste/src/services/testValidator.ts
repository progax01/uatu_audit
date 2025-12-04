import fs from "fs-extra";
import path from "node:path";
import { TestPlan } from "./testPlanGenerator.js";
import { logger } from "../utils/logger.js";

const log = logger.child({ module: 'testValidator' });

export interface TestValidationResult {
  passed: number;
  failed: number;
  skipped: number;
  coverage: {
    behavioral: number; // 0-1
    stride: number; // 0-1
  };
  details: {
    testStyle: string;
    target: string;
    cases: Array<{
      name: string;
      status: "passed" | "failed" | "skipped";
      duration?: number;
      error?: string;
    }>;
  }[];
}

export class TestValidator {
  
  static async validateTestExecution(runPath: string, testPlans: TestPlan[]): Promise<TestValidationResult> {
    log.info('Starting test execution validation');
    
    const result: TestValidationResult = {
      passed: 0,
      failed: 0,
      skipped: 0,
      coverage: { behavioral: 0, stride: 0 },
      details: []
    };
    
    // Load execution logs
    const executeLog = await this.loadExecuteLog(runPath);
    
    for (const plan of testPlans) {
      const styleResult = await this.validateTestStyle(plan, executeLog);
      result.details.push(styleResult);
      
      // Aggregate counts
      styleResult.cases.forEach(c => {
        if (c.status === "passed") result.passed++;
        else if (c.status === "failed") result.failed++;
        else result.skipped++;
      });
      
      // Calculate coverage for this style
      const totalTests = styleResult.cases.length;
      const passedTests = styleResult.cases.filter(c => c.status === "passed").length;
      const coverage = totalTests > 0 ? passedTests / totalTests : 0;
      
      if (plan.style === "behavioral") {
        result.coverage.behavioral = coverage;
      } else if (plan.style === "stride") {
        result.coverage.stride = coverage;
      }
    }
    
    log.info('Test validation completed', {
      passed: result.passed,
      failed: result.failed,
      skipped: result.skipped,
      behavioralCoverage: result.coverage.behavioral,
      strideCoverage: result.coverage.stride
    });
    
    return result;
  }
  
  private static async loadExecuteLog(runPath: string): Promise<string> {
    try {
      const logPath = path.join(runPath, "execute.log");
      if (await fs.pathExists(logPath)) {
        return await fs.readFile(logPath, 'utf8');
      }
      
      // Fallback to execute.json outputs
      const executeJsonPath = path.join(runPath, "execute.json");
      if (await fs.pathExists(executeJsonPath)) {
        const executeData = await fs.readJson(executeJsonPath);
        return executeData.outputs?.testResults || "";
      }
      
      return "";
    } catch (error) {
      log.warn('Failed to load execute log', { error: String(error) });
      return "";
    }
  }
  
  private static async validateTestStyle(plan: TestPlan, executeLog: string) {
    const cases = [];
    let targets: string[] = [];
    
    for (const testMatrix of plan.matrix) {
      targets.push(testMatrix.target);
      if (testMatrix.cases) {
        for (const testCase of testMatrix.cases) {
          const testName = typeof testCase === 'string' ? testCase : testCase.toString();
          const status = this.inferTestStatus(testName, executeLog);
          cases.push({
            name: testName,
            status,
            duration: this.extractDuration(testName, executeLog),
            error: status === "failed" ? this.extractError(testName, executeLog) : undefined
          });
        }
      }
    }
    
    return {
      testStyle: plan.style,
      target: targets.join(", "),
      cases
    };
  }
  
  private static inferTestStatus(testCase: string, executeLog: string): "passed" | "failed" | "skipped" {
    // Look for test patterns in logs
    const lowerLog = executeLog.toLowerCase();
    const lowerCase = testCase.toLowerCase();
    
    // Positive indicators
    const passPatterns = [
      `✓ ${lowerCase}`,
      `pass.*${lowerCase}`,
      `ok.*${lowerCase}`,
      `success.*${lowerCase}`,
      `${lowerCase}.*✓`,
      `${lowerCase}.*pass`
    ];
    
    // Negative indicators  
    const failPatterns = [
      `✗ ${lowerCase}`,
      `fail.*${lowerCase}`,
      `error.*${lowerCase}`,
      `${lowerCase}.*✗`,
      `${lowerCase}.*fail`,
      `${lowerCase}.*error`
    ];
    
    // Skip indicators
    const skipPatterns = [
      `skip.*${lowerCase}`,
      `pending.*${lowerCase}`,
      `${lowerCase}.*skip`,
      `${lowerCase}.*pending`
    ];
    
    // Check for explicit patterns
    for (const pattern of passPatterns) {
      if (new RegExp(pattern).test(lowerLog)) return "passed";
    }
    
    for (const pattern of failPatterns) {
      if (new RegExp(pattern).test(lowerLog)) return "failed";
    }
    
    for (const pattern of skipPatterns) {
      if (new RegExp(pattern).test(lowerLog)) return "skipped";
    }
    
    // If test case is mentioned but no clear status, assume skipped
    if (lowerLog.includes(lowerCase)) {
      return "skipped";
    }
    
    // Default: test was not found/executed
    return "skipped";
  }
  
  private static extractDuration(testCase: string, executeLog: string): number | undefined {
    try {
      const lowerLog = executeLog.toLowerCase();
      const lowerCase = testCase.toLowerCase();
      
      // Look for duration patterns near the test case
      const durationPatterns = [
        new RegExp(`${lowerCase}.*?(\\d+(?:\\.\\d+)?)\\s*ms`, 'i'),
        new RegExp(`${lowerCase}.*?(\\d+(?:\\.\\d+)?)\\s*s`, 'i'),
        new RegExp(`(\\d+(?:\\.\\d+)?)\\s*ms.*?${lowerCase}`, 'i'),
        new RegExp(`(\\d+(?:\\.\\d+)?)\\s*s.*?${lowerCase}`, 'i')
      ];
      
      for (const pattern of durationPatterns) {
        const match = lowerLog.match(pattern);
        if (match) {
          const value = parseFloat(match[1]);
          // Convert to milliseconds if needed
          return lowerLog.includes('ms') ? value : value * 1000;
        }
      }
    } catch (error) {
      // Ignore extraction errors
    }
    
    return undefined;
  }
  
  private static extractError(testCase: string, executeLog: string): string | undefined {
    try {
      const lines = executeLog.split('\n');
      const lowerCase = testCase.toLowerCase();
      
      // Find lines mentioning the test case
      const relevantLines = lines.filter(line => 
        line.toLowerCase().includes(lowerCase)
      );
      
      // Look for error indicators in relevant lines
      for (const line of relevantLines) {
        if (line.includes('Error:') || line.includes('Failed:') || line.includes('✗')) {
          return line.trim();
        }
      }
      
      // Look for lines immediately after test case mentions
      for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i].toLowerCase().includes(lowerCase)) {
          const nextLine = lines[i + 1];
          if (nextLine.includes('Error') || nextLine.includes('Failed') || nextLine.includes('AssertionError')) {
            return nextLine.trim();
          }
        }
      }
    } catch (error) {
      // Ignore extraction errors
    }
    
    return undefined;
  }
}
