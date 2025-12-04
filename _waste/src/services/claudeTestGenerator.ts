import fs from "fs-extra";
import path from "node:path";
import { logger } from "../utils/logger.js";
import { ToolchainInfo } from "./sandboxProvisioner.js";
import { InsightGenerator } from "./insightGenerator.js";
import { claudeChat } from "./ai/claudeRunner.js";

const log = logger.child({ module: 'claudeTestGenerator' });

export interface TestGenerationRequest {
  sandboxPath: string;
  runPath: string;
  inventoryPath: string;
  analysisPath: string;
  testStyles: string[];
  securityFocus: boolean;
}

export interface TestGenerationResult {
  success: boolean;
  testsGenerated: string[];
  testFiles: string[];
  behavioralPlan?: any;
  stridePlan?: any;
  errors: string[];
}

export class ClaudeTestGenerator {
  private runPath: string;
  private insights: InsightGenerator;

  constructor(runPath: string, insights: InsightGenerator) {
    this.runPath = runPath;
    this.insights = insights;
  }

  public async generateTests(request: TestGenerationRequest, toolchain: ToolchainInfo): Promise<TestGenerationResult> {
    log.info('Starting AI test generation with Claude CLI', {
      styles: request.testStyles,
      securityFocus: request.securityFocus,
      framework: toolchain.detectedFramework
    });

    const result: TestGenerationResult = {
      success: false,
      testsGenerated: [],
      testFiles: [],
      errors: []
    };

    try {
      // Check Claude CLI capabilities
      const claudeCapabilities = await this.checkClaudeCapabilities();
      if (!claudeCapabilities.available) {
        throw new Error('Claude CLI not available for test generation');
      }

      // Load project context
      const projectContext = await this.buildProjectContext(request);
      
      // Generate behavioral tests if requested
      if (request.testStyles.includes('behavioral')) {
        try {
          const behavioralResult = await this.generateBehavioralTests(projectContext, toolchain);
          result.behavioralPlan = behavioralResult.plan;
          result.testFiles.push(...behavioralResult.files);
          result.testsGenerated.push(...behavioralResult.tests);
        } catch (error) {
          const errorMsg = `Behavioral test generation failed: ${error}`;
          result.errors.push(errorMsg);
          await this.insights.addClaudeFailure('behavioral-tests', errorMsg, claudeCapabilities);
        }
      }

      // Generate STRIDE tests if requested
      if (request.testStyles.includes('stride')) {
        try {
          const strideResult = await this.generateStrideTests(projectContext, toolchain);
          result.stridePlan = strideResult.plan;
          result.testFiles.push(...strideResult.files);
          result.testsGenerated.push(...strideResult.tests);
        } catch (error) {
          const errorMsg = `STRIDE test generation failed: ${error}`;
          result.errors.push(errorMsg);
          await this.insights.addClaudeFailure('stride-tests', errorMsg, claudeCapabilities);
        }
      }

      // Write test plan metrics
      await this.writeTestPlanMetrics(result, request.runPath);

      result.success = result.testFiles.length > 0;
      log.info('AI test generation completed', {
        success: result.success,
        testsGenerated: result.testsGenerated.length,
        testFiles: result.testFiles.length,
        errors: result.errors.length
      });

    } catch (error) {
      const errorMsg = `AI test generation failed: ${error}`;
      result.errors.push(errorMsg);
      log.error(errorMsg);
      
      await this.insights.addClaudeFailure('test-generation', errorMsg, {});
    }

    return result;
  }

  private async checkClaudeCapabilities(): Promise<any> {
    const claudeConfigPath = path.join(this.runPath, 'sandbox', '.claude.json');
    if (await fs.pathExists(claudeConfigPath)) {
      return await fs.readJson(claudeConfigPath);
    }
    return { available: false };
  }

  private async buildProjectContext(request: TestGenerationRequest): Promise<any> {
    const context: any = {};

    // Load inventory if available
    if (await fs.pathExists(request.inventoryPath)) {
      context.inventory = await fs.readJson(request.inventoryPath);
    }

    // Load analysis if available
    if (await fs.pathExists(request.analysisPath)) {
      context.analysis = await fs.readJson(request.analysisPath);
    }

    // Build project tree (limited depth to avoid huge prompts)
    context.projectTree = await this.buildProjectTree(request.sandboxPath, 3);

    return context;
  }

  private async buildProjectTree(dirPath: string, maxDepth: number, currentDepth = 0): Promise<any> {
    if (currentDepth >= maxDepth) return null;

    const tree: any = {};
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items.slice(0, 20)) { // Limit items to prevent huge trees
        if (item.startsWith('.') && item !== '.env') continue;
        
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          tree[item] = await this.buildProjectTree(itemPath, maxDepth, currentDepth + 1);
        } else if (stats.isFile() && this.isImportantFile(item)) {
          tree[item] = 'file';
        }
      }
    } catch (error) {
      log.debug('Error building project tree', { error, dirPath });
    }

    return tree;
  }

  private isImportantFile(filename: string): boolean {
    const important = [
      '.sol', '.ts', '.js', '.toml', '.json', '.md', '.rs', '.py'
    ];
    return important.some(ext => filename.endsWith(ext));
  }

  private async generateBehavioralTests(context: any, toolchain: ToolchainInfo): Promise<any> {
    const prompt = this.buildBehavioralTestPrompt(context, toolchain);
    const response = await this.claudeInteraction(prompt, 'behavioral-tests');
    
    const result = {
      plan: { type: 'behavioral', generated: new Date().toISOString() },
      files: [] as string[],
      tests: [] as string[]
    };

    // Extract and save test files
    const testFiles = await this.extractTestFiles(response, 'behavioral', toolchain);
    result.files = testFiles;
    result.tests = testFiles.map(f => path.basename(f));

    // Save behavioral plan
    const planPath = path.join(this.runPath, 'testplan.behavioral.json');
    await fs.writeJson(planPath, result.plan, { spaces: 2 });

    return result;
  }

  private async generateStrideTests(context: any, toolchain: ToolchainInfo): Promise<any> {
    const prompt = this.buildStrideTestPrompt(context, toolchain);
    const response = await this.claudeInteraction(prompt, 'stride-tests');
    
    const result = {
      plan: { 
        type: 'stride', 
        generated: new Date().toISOString(),
        categories: ['Spoofing', 'Tampering', 'Repudiation', 'Information Disclosure', 'Denial of Service', 'Elevation of Privilege']
      },
      files: [] as string[],
      tests: [] as string[]
    };

    // Extract and save test files
    const testFiles = await this.extractTestFiles(response, 'stride', toolchain);
    result.files = testFiles;
    result.tests = testFiles.map(f => path.basename(f));

    // Save STRIDE plan
    const planPath = path.join(this.runPath, 'testplan.stride.json');
    await fs.writeJson(planPath, result.plan, { spaces: 2 });

    return result;
  }

  private buildBehavioralTestPrompt(context: any, toolchain: ToolchainInfo): string {
    return `
# Behavioral Test Generation Request

## Project Context
Framework: ${toolchain.detectedFramework}
Has Tests: ${toolchain.hasNode}

## Project Structure
${JSON.stringify(context.projectTree, null, 2)}

## Existing Analysis
${context.analysis ? JSON.stringify(context.analysis, null, 2) : 'No analysis available'}

## Request
**IMPORTANT: You have full sandbox access with Bash, Edit, Read, and Write tools.**

Generate behavioral tests focusing on:
1. User workflow scenarios
2. Happy path testing
3. Business logic validation
4. State transitions
5. Integration scenarios

**Required Actions:**
1. Create test files in .uatu/ai_tests/behavioral/ directory
2. Use ${toolchain.detectedFramework} test syntax
3. Generate executable test code with proper setup
4. Include descriptive test names and comments
5. Test your generated code by running it

**Test File Requirements:**
- Maximum 150 lines per file
- Include proper imports and setup
- Use describe/it blocks for organization
- Add before/after hooks for setup/cleanup
- Include positive test scenarios

Please create working test files that can be executed immediately.
`;
  }

  private buildStrideTestPrompt(context: any, toolchain: ToolchainInfo): string {
    return `
# STRIDE Security Test Generation Request

## Project Context
Framework: ${toolchain.detectedFramework}
Security Focus: High Priority

## Project Structure
${JSON.stringify(context.projectTree, null, 2)}

## Security Concerns
${context.analysis?.securityConcerns ? JSON.stringify(context.analysis.securityConcerns, null, 2) : 'General smart contract security'}

## Request
**IMPORTANT: You have full sandbox access with Bash, Edit, Read, and Write tools.**

Generate STRIDE security tests covering:

### Spoofing
- Identity verification tests
- Authentication bypass attempts
- Signature validation

### Tampering
- Data integrity checks
- Input validation tests
- State manipulation attempts

### Repudiation
- Event logging verification
- Transaction traceability
- Audit trail tests

### Information Disclosure
- Access control tests
- Private data exposure
- View function security

### Denial of Service
- Gas limit tests
- Resource exhaustion
- Infinite loop protection

### Elevation of Privilege
- Role-based access control
- Admin function protection
- Ownership transfer security

**Required Actions:**
1. Create test files in .uatu/ai_tests/stride/ directory
2. Use ${toolchain.detectedFramework} test syntax
3. Generate attack scenario simulations
4. Include both positive and negative test cases
5. Test your generated code by running it

**Test File Requirements:**
- Maximum 150 lines per file
- Organize by STRIDE category
- Include attack vectors and edge cases
- Add detailed comments explaining security implications
- Include helper functions for common attack patterns

Please create comprehensive security test files targeting the STRIDE model.
`;
  }

  private async claudeInteraction(prompt: string, sessionId: string): Promise<string> {
    log.info(`Starting Claude interaction: ${sessionId}`);
    
    try {
      // Create prompt file
      const promptFile = path.join(this.runPath, `claude-prompt-${sessionId}.txt`);
      await fs.writeFile(promptFile, prompt);
      
      // Execute Claude CLI with timeout
      const timeout = parseInt(process.env.CLAUDE_TIMEOUT_MS || '300000');
      const claudePromise = claudeChat(this.runPath, promptFile);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Claude CLI timeout after ${timeout}ms`)), timeout);
      });
      
      const response = await Promise.race([claudePromise, timeoutPromise]);
      
      // Save response
      const responseFile = path.join(this.runPath, `claude-response-${sessionId}.txt`);
      await fs.writeFile(responseFile, response);
      
      // Cleanup prompt file
      await fs.remove(promptFile);
      
      log.info(`Claude interaction completed: ${sessionId}`, { 
        responseLength: response.length 
      });
      
      return response;
      
    } catch (error) {
      log.error(`Claude interaction failed: ${sessionId}`, { error: String(error) });
      throw error;
    }
  }

  private async extractTestFiles(response: string, testType: string, toolchain: ToolchainInfo): Promise<string[]> {
    const testFiles: string[] = [];
    
    // Extract code blocks from Claude response
    const codeBlocks = response.match(/```(?:solidity|javascript|typescript|rust)?\n([\s\S]*?)```/g) || [];
    
    let fileIndex = 0;
    for (const block of codeBlocks) {
      const code = block.replace(/```(?:solidity|javascript|typescript|rust)?\n|```/g, '').trim();
      
      if (code.length > 50) { // Only substantial code blocks
        const extension = this.getTestFileExtension(toolchain);
        const fileName = `${testType}_${fileIndex + 1}.test${extension}`;
        const testDir = path.join(this.runPath, '..', '..', '.uatu', 'ai_tests', testType);
        
        await fs.ensureDir(testDir);
        const filePath = path.join(testDir, fileName);
        await fs.writeFile(filePath, code);
        
        testFiles.push(filePath);
        fileIndex++;
      }
    }
    
    return testFiles;
  }

  private getTestFileExtension(toolchain: ToolchainInfo): string {
    if (toolchain.hasFoundry) return '.sol';
    if (toolchain.hasHardhat) return '.ts';
    if (toolchain.hasAnchor) return '.ts';
    if (toolchain.hasSoroban) return '.rs';
    return '.js';
  }

  private async writeTestPlanMetrics(result: TestGenerationResult, runPath: string): Promise<void> {
    const metrics = {
      behavioral: {
        testsGenerated: result.behavioralPlan ? result.testsGenerated.filter(t => t.includes('behavioral')).length : 0,
        coverage: 0 // Would need to calculate based on contract functions
      },
      stride: {
        testsGenerated: result.stridePlan ? result.testsGenerated.filter(t => t.includes('stride')).length : 0,
        categoryCoverage: result.stridePlan ? 6 : 0 // STRIDE has 6 categories
      },
      overall: {
        totalTests: result.testsGenerated.length,
        totalFiles: result.testFiles.length,
        errors: result.errors.length,
        success: result.success
      },
      generated: new Date().toISOString()
    };

    const metricsPath = path.join(runPath, 'testplan.metrics.json');
    await fs.writeJson(metricsPath, metrics, { spaces: 2 });
  }
}
