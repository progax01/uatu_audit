import fs from "fs-extra";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "../../utils/logger.js";
import { ProjectStructure } from "../projectAnalyzer.js";
import { createLiveLogger } from "../liveLogger.js";
import { claudeChat } from "./claudeRunner.js";

const execAsync = promisify(exec);
const log = logger.child({ module: 'claudeProvider' });

export interface AITestGenerationRequest {
  projectPath: string;
  runPath: string;
  contractFiles: string[];
  existingTests: string[];
  projectStructure: ProjectStructure;
  securityFocus: boolean;
  testTypes: ('unit' | 'integration' | 'fuzz' | 'invariant')[];
}

export interface AITestGenerationResult {
  success: boolean;
  testsGenerated: string[];
  testFiles: string[];
  recommendations: string[];
  errors: string[];
  claudeInteractions: number;
}

export class ClaudeAIProvider {
  public readonly name = "Claude CLI";
  public readonly available = true; // Will be checked by provider selector
  private runPath: string;
  private liveLogger: any;
  private autoAccept: boolean;

  constructor(runPath: string, autoAccept: boolean = false) {
    this.runPath = runPath;
    this.autoAccept = autoAccept;
    this.liveLogger = createLiveLogger(runPath, 'cli');
  }

  public async generateTests(request: AITestGenerationRequest): Promise<AITestGenerationResult> {
    this.liveLogger.info('Starting AI test generation with Claude CLI', {
      contractFiles: request.contractFiles.length,
      existingTests: request.existingTests.length,
      testTypes: request.testTypes
    });

    const result: AITestGenerationResult = {
      success: false,
      testsGenerated: [],
      testFiles: [],
      recommendations: [],
      errors: [],
      claudeInteractions: 0
    };

    try {
      // Check if Claude CLI is available
      await this.checkClaudeAvailability();

      // Generate project analysis prompt
      const analysisPrompt = await this.generateAnalysisPrompt(request);
      
      // Interact with Claude for project analysis
      const analysisResult = await this.claudeInteraction(analysisPrompt, 'project-analysis');
      result.claudeInteractions++;

      // Generate tests for each critical contract
      for (const contractFile of request.contractFiles) {
        try {
          const testResult = await this.generateTestForContract(contractFile, request, analysisResult);
          result.testsGenerated.push(...testResult.tests);
          result.testFiles.push(...testResult.files);
          result.recommendations.push(...testResult.recommendations);
          result.claudeInteractions += testResult.interactions;
        } catch (error) {
          const errorMsg = `Failed to generate tests for ${contractFile}: ${error}`;
          result.errors.push(errorMsg);
          this.liveLogger.error(errorMsg);
        }
      }

      // Generate integration tests if requested
      if (request.testTypes.includes('integration')) {
        const integrationResult = await this.generateIntegrationTests(request);
        result.testsGenerated.push(...integrationResult.tests);
        result.testFiles.push(...integrationResult.files);
        result.claudeInteractions += integrationResult.interactions;
      }

      // Generate security-focused tests if requested
      if (request.securityFocus) {
        const securityResult = await this.generateSecurityTests(request);
        result.testsGenerated.push(...securityResult.tests);
        result.testFiles.push(...securityResult.files);
        result.claudeInteractions += securityResult.interactions;
      }

      result.success = result.testsGenerated.length > 0;
      
      this.liveLogger.info('AI test generation completed', {
        success: result.success,
        testsGenerated: result.testsGenerated.length,
        claudeInteractions: result.claudeInteractions
      });

    } catch (error) {
      const errorMsg = `AI test generation failed: ${error}`;
      result.errors.push(errorMsg);
      this.liveLogger.error(errorMsg);
    }

    return result;
  }

  private async checkClaudeAvailability(): Promise<void> {
    try {
      // Try default claude command
      await execAsync('claude --version');
      this.liveLogger.info('Claude CLI is available');
      return;
    } catch (error) {
      // Try with explicit path if provided
      const claudePath = process.env.CLAUDE_CLI_PATH;
      if (claudePath) {
        try {
          await execAsync(`${claudePath} --version`);
          this.liveLogger.info('Claude CLI is available via custom path');
          return;
        } catch (pathError) {
          this.liveLogger.warn('Claude CLI not found at custom path', { path: claudePath });
        }
      }
      
      // Check if Anthropic API key is available as fallback
      if (process.env.ANTHROPIC_API_KEY) {
        this.liveLogger.warn('Claude CLI not found, but Anthropic API key is available for fallback');
        throw new Error('Claude CLI not found. Please install Claude CLI: https://github.com/anthropics/claude-cli, or ensure ANTHROPIC_API_KEY is set for API fallback');
      }
      
      throw new Error('Claude CLI not found and no Anthropic API key available. Please install Claude CLI: https://github.com/anthropics/claude-cli');
    }
  }

  private async generateAnalysisPrompt(request: AITestGenerationRequest): Promise<string> {
    const projectSummary = await this.generateProjectSummary(request.projectStructure);
    const contractAnalysis = await this.analyzeContracts(request.contractFiles);
    
    return `
# Smart Contract Audit Test Generation Request

## Project Overview
${projectSummary}

## Contract Analysis
${contractAnalysis}

## Existing Tests
${request.existingTests.length > 0 ? request.existingTests.map(t => `- ${path.basename(t)}`).join('\n') : 'No existing tests found'}

## Test Generation Requirements
- Test Types: ${request.testTypes.join(', ')}
- Security Focus: ${request.securityFocus ? 'Yes' : 'No'}
- Framework: Detect from project (Hardhat/Foundry/Anchor)

## Request
**IMPORTANT: You have full sandbox access with Bash, Edit, Read, and Write tools. You can create and execute test files directly.**

Please analyze this smart contract project and provide:
1. A comprehensive testing strategy with executable tests
2. Critical security test scenarios as working test files
3. Specific test cases for each contract function
4. Edge cases and invariant tests
5. Integration test scenarios

**Required Actions:**
1. Create test files in the appropriate directory structure
2. Generate working test code for Hardhat/Foundry framework
3. Include setup scripts and dependencies
4. Test your generated code by running it
5. Fix any compilation or runtime issues

Focus on:
- Access control testing
- State transition validation
- Economic attack vectors
- Reentrancy protection
- Integer overflow/underflow
- Gas optimization issues
- Front-running scenarios

**Output Requirements:**
- Use appropriate test framework syntax (Hardhat/Foundry)
- Include proper imports and setup
- Add detailed comments explaining test scenarios
- Create helper functions for common patterns
- Generate both positive and negative test cases
- Include gas usage assertions where relevant

Please create and test the files directly in the sandbox environment.
`;
  }

  private async generateProjectSummary(structure: ProjectStructure): Promise<string> {
    return `
**Project Structure:**
- Total Files: ${structure.totalFiles}
- Ecosystems: ${structure.ecosystems.join(', ')}
- Main Contracts: ${structure.mainContracts.length}
- Test Files: ${structure.testFiles.length}
- Security Concerns: ${structure.securityConcerns.length}

**Critical Files:**
${structure.criticalPaths.slice(0, 10).map(p => `- ${path.relative(structure.rootPath, p)}`).join('\n')}

**Security Concerns:**
${structure.securityConcerns.map(c => `- ${c}`).join('\n')}
`;
  }

  private async analyzeContracts(contractFiles: string[]): Promise<string> {
    const analyses = [];
    
    for (const contractFile of contractFiles.slice(0, 5)) { // Limit to first 5 contracts
      try {
        const content = await fs.readFile(contractFile, 'utf8');
        const analysis = this.quickContractAnalysis(content, contractFile);
        analyses.push(`**${path.basename(contractFile)}:**\n${analysis}`);
      } catch (error) {
        analyses.push(`**${path.basename(contractFile)}:** Failed to read file`);
      }
    }
    
    return analyses.join('\n\n');
  }

  private quickContractAnalysis(content: string, filePath: string): string {
    const lines = content.split('\n');
    const functions = lines.filter(line => 
      line.trim().startsWith('function') || 
      line.includes('external') || 
      line.includes('public')
    ).map(line => line.trim().substring(0, 100));
    
    const modifiers = lines.filter(line => 
      line.trim().startsWith('modifier')
    ).map(line => line.trim().substring(0, 50));
    
    const events = lines.filter(line => 
      line.trim().startsWith('event')
    ).map(line => line.trim().substring(0, 50));
    
    return `
- Functions: ${functions.length}
${functions.slice(0, 5).map(f => `  - ${f}`).join('\n')}
- Modifiers: ${modifiers.length}
${modifiers.map(m => `  - ${m}`).join('\n')}
- Events: ${events.length}
${events.slice(0, 3).map(e => `  - ${e}`).join('\n')}
`;
  }

  private async claudeInteraction(prompt: string, sessionId: string): Promise<string> {
    this.liveLogger.info(`Starting Claude interaction: ${sessionId}`);
    
    try {
      // Create a temporary prompt file
      const promptFile = path.join(this.runPath, `claude-prompt-${sessionId}.txt`);
      await fs.writeFile(promptFile, prompt);
      
      // Use robust Claude CLI runner with timeout
      const timeout = parseInt(process.env.CLAUDE_TIMEOUT_MS || '300000'); // 5 minutes default for AI operations
      this.liveLogger.info('Executing Claude CLI command', { 
        command: `claude --print (with ${timeout/1000}s timeout)`,
        promptFile: path.basename(promptFile),
        promptSize: prompt.length
      });
      
      // Execute Claude CLI with configurable timeout for AI operations
      const claudePromise = claudeChat(this.runPath, promptFile);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Claude CLI timeout after ${timeout}ms`)), timeout);
      });
      
      const stdout = await Promise.race([claudePromise, timeoutPromise]);
      
      // Check if response is meaningful
      if (!stdout || stdout.trim().length < 10) {
        throw new Error('Claude CLI returned empty or minimal response');
      }
      
      // Save response
      const responseFile = path.join(this.runPath, `claude-response-${sessionId}.txt`);
      await fs.writeFile(responseFile, stdout);
      
      this.liveLogger.info('Claude interaction completed', { 
        sessionId, 
        responseLength: stdout.length,
        preview: stdout.substring(0, 200) + '...'
      });
      
      // Clean up prompt file
      await fs.remove(promptFile);
      
      return stdout;
      
    } catch (error: any) {
      // Extract detailed error information
      const errorDetails = {
        sessionId,
        message: error.message,
        stderr: error.stderr || 'No stderr available',
        stdout: error.stdout || 'No stdout available',
        code: error.code || 'Unknown exit code'
      };
      
      this.liveLogger.error('Claude interaction failed', errorDetails);
      
      // Save error details for debugging
      const errorFile = path.join(this.runPath, `claude-error-${sessionId}.json`);
      await fs.writeFile(errorFile, JSON.stringify(errorDetails, null, 2));
      
      throw new Error(`Claude CLI failed for ${sessionId}: ${error.message}${error.stderr ? ` | STDERR: ${error.stderr}` : ''}`);
    }
  }

  private async generateTestForContract(
    contractFile: string, 
    request: AITestGenerationRequest,
    analysisResult: string
  ): Promise<{ tests: string[], files: string[], recommendations: string[], interactions: number }> {
    
    const contractContent = await fs.readFile(contractFile, 'utf8');
    const contractName = path.basename(contractFile, '.sol');
    
    const testPrompt = `
# Test Generation for ${contractName}

## Contract Source Code
\`\`\`solidity
${contractContent}
\`\`\`

## Previous Analysis
${analysisResult}

## Request
**IMPORTANT: Create and execute working tests in the sandbox environment.**

Generate comprehensive tests for this contract including:
1. Unit tests for all public/external functions
2. Access control tests
3. State transition tests
4. Edge case scenarios
5. Security vulnerability tests

**Required Actions:**
1. Create a test file at: test/${contractName}.test.sol or test/${contractName}.test.js
2. Include proper setup and deployment code
3. Test compilation by running: npx hardhat compile or forge build
4. Execute tests with: npx hardhat test or forge test
5. Fix any issues found during execution

**Test Requirements:**
- Include beforeEach setup with proper contract deployment
- Test all public/external functions with various inputs
- Include negative test cases (should revert scenarios)
- Add gas usage assertions for optimization checks
- Test events emission where applicable
- Include fuzzing tests for edge cases

**Security Test Cases:**
- Reentrancy attack scenarios
- Access control bypass attempts
- Integer overflow/underflow tests
- Front-running simulations
- Economic attack vectors

Please create the test file and verify it works by running it in the sandbox.
`;

    const response = await this.claudeInteraction(testPrompt, `test-${contractName}`);
    
    // Extract and save test code from response
    const testCode = this.extractTestCode(response);
    const testFiles = [];
    
    if (testCode) {
      const testFile = path.join(request.runPath, 'ai-generated-tests', `${contractName}.test.sol`);
      await fs.ensureDir(path.dirname(testFile));
      await fs.writeFile(testFile, testCode);
      testFiles.push(testFile);
    }
    
    const recommendations = this.extractRecommendations(response);
    
    return {
      tests: [contractName],
      files: testFiles,
      recommendations,
      interactions: 1
    };
  }

  private async generateIntegrationTests(request: AITestGenerationRequest): Promise<{ tests: string[], files: string[], interactions: number }> {
    const integrationPrompt = `
# Integration Test Generation

## Project Contracts
${request.contractFiles.map(f => path.basename(f)).join('\n')}

## Request
Generate integration tests that verify:
1. Cross-contract interactions
2. End-to-end user workflows
3. System-wide state consistency
4. Multi-contract scenarios

Provide working integration test code.
`;

    const response = await this.claudeInteraction(integrationPrompt, 'integration-tests');
    const testCode = this.extractTestCode(response);
    const testFiles = [];
    
    if (testCode) {
      const testFile = path.join(request.runPath, 'ai-generated-tests', 'Integration.test.sol');
      await fs.ensureDir(path.dirname(testFile));
      await fs.writeFile(testFile, testCode);
      testFiles.push(testFile);
    }
    
    return {
      tests: ['Integration'],
      files: testFiles,
      interactions: 1
    };
  }

  private async generateSecurityTests(request: AITestGenerationRequest): Promise<{ tests: string[], files: string[], interactions: number }> {
    const securityPrompt = `
# Security Test Generation

## Security Concerns Identified
${request.projectStructure.securityConcerns.join('\n')}

## Request
Generate security-focused tests including:
1. Reentrancy attack simulations
2. Access control bypass attempts
3. Economic attack scenarios
4. Gas manipulation tests
5. Front-running scenarios

Provide comprehensive security test code.
`;

    const response = await this.claudeInteraction(securityPrompt, 'security-tests');
    const testCode = this.extractTestCode(response);
    const testFiles = [];
    
    if (testCode) {
      const testFile = path.join(request.runPath, 'ai-generated-tests', 'Security.test.sol');
      await fs.ensureDir(path.dirname(testFile));
      await fs.writeFile(testFile, testCode);
      testFiles.push(testFile);
    }
    
    return {
      tests: ['Security'],
      files: testFiles,
      interactions: 1
    };
  }

  private extractTestCode(response: string): string | null {
    // Extract code blocks from Claude response
    const codeBlocks = response.match(/```(?:solidity|javascript|typescript)?\n([\s\S]*?)```/g);
    if (codeBlocks && codeBlocks.length > 0) {
      // Return the first substantial code block
      const code = codeBlocks[0].replace(/```(?:solidity|javascript|typescript)?\n|```/g, '').trim();
      return code.length > 100 ? code : null;
    }
    return null;
  }

  private extractRecommendations(response: string): string[] {
    const recommendations = [];
    const lines = response.split('\n');
    
    for (const line of lines) {
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        recommendations.push(line.trim().substring(2));
      }
    }
    
    return recommendations.slice(0, 10); // Limit to 10 recommendations
  }

  public async close() {
    if (this.liveLogger) {
      await this.liveLogger.close();
    }
  }
}
