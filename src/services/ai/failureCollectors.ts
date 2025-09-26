import fs from "fs-extra";
import path from "node:path";
import { logger } from "../../utils/logger.js";
import type { AiFailure } from "./aiRefiner.js";

const log = logger.child({ service: 'failure-collectors' });

/**
 * Collect failures from Hardhat test execution logs
 */
export async function collectHardhatFailures(runPath: string, sandbox: string): Promise<AiFailure[]> {
  try {
    const logPath = path.join(runPath, "execute.log");
    const logContent = await fs.readFile(logPath, "utf8");
    const failures: AiFailure[] = [];

    // Parse Hardhat/Mocha test output for failures
    const lines = logContent.split(/\r?\n/);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for test failures that mention AI test files
      if (/test\/ai\/.*\.(ts|tsx|js|jsx)/.test(line) && /(\d+\)|failing|Error:|TypeError:|ReferenceError:)/.test(line)) {
        const context = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 10)).join('\n');
        
        // Extract file path
        const fileMatch = context.match(/(test\/ai\/[^\s:]+\.(ts|tsx|js|jsx))/);
        const file = fileMatch ? fileMatch[1] : 'unknown';
        
        // Extract test name
        const testNameMatch = context.match(/(?:✗|×|\d+\))\s*(.+?)(?:\n|$)/);
        const name = testNameMatch ? testNameMatch[1].trim() : 'Unknown test';
        
        // Extract error message
        const errorMatch = context.match(/(Error:[^\n]+|TypeError:[^\n]+|ReferenceError:[^\n]+|AssertionError:[^\n]+)/);
        const message = errorMatch ? errorMatch[1] : context.slice(0, 400);
        
        failures.push({
          file,
          name,
          message: message.trim(),
          toolchain: 'hardhat'
        });
      }
    }

    // Also look for compilation errors
    const compilationErrors = logContent.match(/TypeScript error in [^\n]*test\/ai\/[^\n]*/g) || [];
    for (const error of compilationErrors) {
      const fileMatch = error.match(/(test\/ai\/[^\s:]+)/);
      if (fileMatch) {
        failures.push({
          file: fileMatch[1],
          name: 'Compilation Error',
          message: error,
          toolchain: 'hardhat'
        });
      }
    }

    await fs.writeJson(path.join(runPath, "ai_failures_hardhat.json"), failures, { spaces: 2 });
    
    log.debug(`Collected ${failures.length} Hardhat AI test failures`);
    return failures;

  } catch (error) {
    log.error("Failed to collect Hardhat failures", { error: String(error) });
    return [];
  }
}

/**
 * Collect failures from Foundry test execution logs
 */
export async function collectFoundryFailures(runPath: string, sandbox: string): Promise<AiFailure[]> {
  try {
    const logPath = path.join(runPath, "execute.log");
    const logContent = await fs.readFile(logPath, "utf8");
    const failures: AiFailure[] = [];

    // Parse Foundry test output for failures
    const lines = logContent.split(/\r?\n/);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for Foundry test failures
      if (/test\/ai\/.*\.t\.sol/.test(line) && /(FAIL|FAILED|Error|revert)/.test(line)) {
        const context = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 15)).join('\n');
        
        // Extract file path
        const fileMatch = context.match(/(test\/ai\/[^\s:]+\.t\.sol)/);
        const file = fileMatch ? fileMatch[1] : 'unknown';
        
        // Extract test function name
        const functionMatch = context.match(/(?:Running \d+ tests for|function)\s+([A-Za-z0-9_]+)/);
        const name = functionMatch ? functionMatch[1] : 'Unknown test';
        
        // Extract error/revert reason
        const errorMatch = context.match(/(revert[^\n]*|Error[^\n]*|Failure[^\n]*)/i);
        const message = errorMatch ? errorMatch[1] : context.slice(0, 400);
        
        failures.push({
          file,
          name,
          message: message.trim(),
          toolchain: 'foundry'
        });
      }
    }

    // Look for compilation errors
    const compilerErrors = logContent.match(/Compiler run failed[\s\S]*?test\/ai\/[^\n]*/g) || [];
    for (const error of compilerErrors) {
      const fileMatch = error.match(/(test\/ai\/[^\s:]+\.sol)/);
      if (fileMatch) {
        failures.push({
          file: fileMatch[1],
          name: 'Compilation Error',
          message: error.slice(0, 400),
          toolchain: 'foundry'
        });
      }
    }

    await fs.writeJson(path.join(runPath, "ai_failures_foundry.json"), failures, { spaces: 2 });
    
    log.debug(`Collected ${failures.length} Foundry AI test failures`);
    return failures;

  } catch (error) {
    log.error("Failed to collect Foundry failures", { error: String(error) });
    return [];
  }
}

/**
 * Collect failures from Jest test execution logs
 */
export async function collectJestFailures(runPath: string, sandbox: string): Promise<AiFailure[]> {
  try {
    const logPath = path.join(runPath, "execute.log");
    const logContent = await fs.readFile(logPath, "utf8");
    const failures: AiFailure[] = [];

    // Parse Jest test output for failures
    const lines = logContent.split(/\r?\n/);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for Jest test failures
      if (/test\/ai\/.*\.(test|spec)\.(ts|tsx|js|jsx)/.test(line) && /(FAIL|●|✕|Error:|TypeError:|ReferenceError:)/.test(line)) {
        const context = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 10)).join('\n');
        
        // Extract file path
        const fileMatch = context.match(/(test\/ai\/[^\s:]+\.(test|spec)\.(ts|tsx|js|jsx))/);
        const file = fileMatch ? fileMatch[1] : 'unknown';
        
        // Extract test name (Jest format: "  ● TestSuite › test name")
        const testNameMatch = context.match(/●\s*([^›\n]+)(?:\s*›\s*([^\n]+))?/);
        const name = testNameMatch ? 
          (testNameMatch[2] ? `${testNameMatch[1]} › ${testNameMatch[2]}` : testNameMatch[1]).trim() :
          'Unknown test';
        
        // Extract error message
        const errorMatch = context.match(/(Error:[^\n]+|TypeError:[^\n]+|ReferenceError:[^\n]+|Expected[^\n]+|Received[^\n]+)/);
        const message = errorMatch ? errorMatch[1] : context.slice(0, 400);
        
        failures.push({
          file,
          name,
          message: message.trim(),
          toolchain: 'jest'
        });
      }
    }

    // Look for module resolution errors
    const moduleErrors = logContent.match(/Cannot find module[^\n]*test\/ai\/[^\n]*/g) || [];
    for (const error of moduleErrors) {
      const fileMatch = error.match(/(test\/ai\/[^\s'"`]+)/);
      if (fileMatch) {
        failures.push({
          file: fileMatch[1],
          name: 'Module Resolution Error',
          message: error,
          toolchain: 'jest'
        });
      }
    }

    await fs.writeJson(path.join(runPath, "ai_failures_jest.json"), failures, { spaces: 2 });
    
    log.debug(`Collected ${failures.length} Jest AI test failures`);
    return failures;

  } catch (error) {
    log.error("Failed to collect Jest failures", { error: String(error) });
    return [];
  }
}

/**
 * Collect failures from Anchor test execution logs
 */
export async function collectAnchorFailures(runPath: string, sandbox: string): Promise<AiFailure[]> {
  try {
    const logPath = path.join(runPath, "execute.log");
    const logContent = await fs.readFile(logPath, "utf8");
    const failures: AiFailure[] = [];

    // Parse Anchor test output for failures
    const lines = logContent.split(/\r?\n/);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for Anchor test failures
      if (/test\/ai\/.*\.(ts|tsx|js|jsx)/.test(line) && /(Error|Failed|✗|×)/.test(line)) {
        const context = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 10)).join('\n');
        
        // Extract file path
        const fileMatch = context.match(/(test\/ai\/[^\s:]+\.(ts|tsx|js|jsx))/);
        const file = fileMatch ? fileMatch[1] : 'unknown';
        
        // Extract test name
        const testNameMatch = context.match(/(?:✗|×)\s*(.+?)(?:\n|$)/);
        const name = testNameMatch ? testNameMatch[1].trim() : 'Unknown test';
        
        // Extract error message
        const errorMatch = context.match(/(Error:[^\n]+|failed to send transaction[^\n]*|Program log:[^\n]*)/i);
        const message = errorMatch ? errorMatch[1] : context.slice(0, 400);
        
        failures.push({
          file,
          name,
          message: message.trim(),
          toolchain: 'anchor'
        });
      }
    }

    await fs.writeJson(path.join(runPath, "ai_failures_anchor.json"), failures, { spaces: 2 });
    
    log.debug(`Collected ${failures.length} Anchor AI test failures`);
    return failures;

  } catch (error) {
    log.error("Failed to collect Anchor failures", { error: String(error) });
    return [];
  }
}

/**
 * Collect all failures from all supported toolchains
 */
export async function collectAllAiFailures(runPath: string, sandbox: string): Promise<AiFailure[]> {
  const [hardhatFailures, foundryFailures, jestFailures, anchorFailures] = await Promise.all([
    collectHardhatFailures(runPath, sandbox),
    collectFoundryFailures(runPath, sandbox),
    collectJestFailures(runPath, sandbox),
    collectAnchorFailures(runPath, sandbox)
  ]);

  const allFailures = [
    ...hardhatFailures,
    ...foundryFailures,
    ...jestFailures,
    ...anchorFailures
  ];

  // Deduplicate based on file and name
  const unique = allFailures.filter((failure, index, array) => 
    array.findIndex(f => f.file === failure.file && f.name === failure.name) === index
  );

  await fs.writeJson(path.join(runPath, "ai_failures_all.json"), unique, { spaces: 2 });
  
  log.info(`Collected ${unique.length} unique AI test failures across all toolchains`, {
    hardhat: hardhatFailures.length,
    foundry: foundryFailures.length,
    jest: jestFailures.length,
    anchor: anchorFailures.length,
    total: unique.length
  });

  return unique;
}
