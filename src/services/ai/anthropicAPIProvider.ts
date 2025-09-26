import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../../utils/logger.js";
import { createLiveLogger } from "../liveLogger.js";
import type { AITestGenerationRequest, AITestGenerationResult } from "./claudeProvider.js";
import type { AIProvider } from "./aiProviderSelector.js";
import path from "node:path";
import fs from "fs-extra";
import { z } from "zod";

const log = logger.child({ service: 'anthropic-api-provider' });

// Zod schema for strict JSON validation
const TestFileSchema = z.object({
  path: z.string().min(1).max(200),
  content: z.string().min(1).max(100_000),
  description: z.string().optional(),
  type: z.enum(['test', 'spec', 'fixture']).default('test')
});

const TestGenerationSchema = z.object({
  success: z.boolean().default(true),
  tests: z.array(TestFileSchema).max(parseInt(process.env.UATU_AI_MAX_FILES || "10", 10)),
  summary: z.string().optional(),
  recommendations: z.array(z.string()).optional()
});

export class AnthropicAPIProvider implements AIProvider {
  public readonly name = "Anthropic API";
  public readonly available: boolean;
  private runPath: string;
  private liveLogger: any;
  private autoAccept: boolean;
  private client!: Anthropic;
  private model: string;
  private timeout: number;
  private maxFiles: number;

  constructor(runPath: string, autoAccept: boolean = false) {
    this.runPath = runPath;
    this.autoAccept = autoAccept;
    this.liveLogger = createLiveLogger(runPath, 'cli');
    
    const apiKey = process.env.ANTHROPIC_API_KEY || '';
    this.model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620';
    this.timeout = parseInt(process.env.CLAUDE_TIMEOUT_MS || '300000', 10);
    this.maxFiles = parseInt(process.env.UATU_AI_MAX_FILES || '10', 10);
    
    this.available = !!apiKey;
    
    if (this.available) {
      this.client = new Anthropic({ apiKey });
      log.debug('Anthropic API provider initialized', { model: this.model });
    } else {
      log.debug('Anthropic API provider not available - missing API key');
    }
  }

  async generateTests(request: AITestGenerationRequest): Promise<AITestGenerationResult> {
    if (!this.available) {
      return {
        success: false,
        testsGenerated: [],
        testFiles: [],
        recommendations: [],
        errors: ['Anthropic API key not available'],
        claudeInteractions: 0
      };
    }

    const result: AITestGenerationResult = {
      success: false,
      testsGenerated: [],
      testFiles: [],
      recommendations: [],
      errors: [],
      claudeInteractions: 0
    };

    try {
      this.liveLogger.info('Starting Anthropic API test generation', {
        model: this.model,
        contractFiles: request.contractFiles.length,
        existingTests: request.existingTests.length,
        timeout: this.timeout
      });

      // Generate the test generation prompt
      const prompt = await this.generateTestPrompt(request);
      
      // Call Anthropic API
      const response = await this.callAnthropicAPI(prompt);
      
      if (response) {
        result.claudeInteractions = 1;
        
        // Parse the response and extract test files
        const parsedResult = await this.parseTestResponse(response.text, request);
        
        result.success = parsedResult.success;
        result.testFiles = parsedResult.files;
        result.testsGenerated = parsedResult.tests;
        result.recommendations = parsedResult.recommendations || [];
        result.errors = parsedResult.errors;
        
        this.liveLogger.info('Anthropic API test generation completed', {
          success: result.success,
          testFiles: result.testFiles.length,
          testsGenerated: result.testsGenerated.length,
          errors: result.errors.length
        });
      } else {
        result.errors.push('Failed to get response from Anthropic API');
      }

    } catch (error: any) {
      log.error('Anthropic API test generation failed', { error: String(error) });
      result.errors.push(`Anthropic API error: ${error.message || String(error)}`);
      
      this.liveLogger.error('Anthropic API test generation failed', { 
        error: String(error),
        stack: error.stack 
      });
    }

    return result;
  }

  private async generateTestPrompt(request: AITestGenerationRequest): Promise<string> {
    const projectStructure = request.projectStructure;
    
    // Keep the prompt shorter to avoid token limits
    let prompt = `# Smart Contract Test Generation

## Project: ${request.contractFiles.length} contracts, ${request.existingTests.length} existing tests

**Top Contracts:**
${request.contractFiles.slice(0, 3).map(f => `- ${f}`).join('\n')}

## Request
Generate security-focused test files for this ${projectStructure?.ecosystems?.join(', ') || 'smart contract'} project.

**Focus Areas:**
- Access control & permissions
- Reentrancy protection  
- Input validation & edge cases
- State transitions
- Economic attacks

**Requirements:**
- Create working test files for Hardhat/Foundry
- Include setup, imports, and test cases
- Add comments explaining each test scenario
- Cover both positive and negative cases

**Output Format (IMPORTANT - respond with this exact JSON structure):**
\`\`\`json
{
  "success": true,
  "tests": [
    {
      "path": "test/security/ContractName.test.ts",
      "content": "import { expect } from \\"chai\\";\\nimport { ethers } from \\"hardhat\\";\\n\\ndescribe(\\"ContractName Security Tests\\", function() {\\n  // Test implementation here\\n});",
      "description": "Security tests for ContractName",
      "type": "security"
    }
  ],
  "summary": "Generated security tests covering access control and edge cases"
}
\`\`\`

Please generate 1-2 focused test files with complete, runnable test code.`;

    return prompt;
  }

  private async callAnthropicAPI(prompt: string): Promise<{ text: string; usage: any }> {
    try {
      this.liveLogger.info('Calling Anthropic API', {
        model: this.model,
        promptLength: prompt.length,
        timeout: this.timeout,
        maxFiles: this.maxFiles
      });

      const startTime = Date.now();

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 8000,
        temperature: 0.1,
        system: this.getSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const responseText = response.content
        .filter((c): c is Anthropic.TextBlock => c.type === 'text')
        .map(c => c.text)
        .join('\n');

      this.liveLogger.info('Anthropic API response received', {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
        responseLength: responseText.length,
        elapsedMs: Date.now() - startTime
      });

      return {
        text: responseText,
        usage: response.usage
      };

    } catch (error: any) {
      log.error('Anthropic API request failed', { error: String(error) });
      throw error;
    }
  }

  private getSystemPrompt(): string {
    return [
      "You are a senior smart contract security auditor and test engineer.",
      "Generate high-quality, executable test files for smart contract auditing.",
      "CRITICAL: Respond with ONLY valid JSON matching this exact schema:",
      '{"success": true, "tests": [{"path": "test/Contract.spec.ts", "content": "...", "description": "..."}], "summary": "..."}',
      "Never modify source code - only create test files.",
      "Focus on security testing: access control, reentrancy, edge cases.",
      "Make tests compile and run successfully.",
      `Generate up to ${this.maxFiles} focused, high-value test files.`
    ].join(" ");
  }

  private async parseTestResponse(response: string, request: AITestGenerationRequest): Promise<{
    success: boolean;
    files: string[];
    tests: string[];
    recommendations: string[];
    errors: string[];
  }> {
    const result = {
      success: false,
      files: [] as string[],
      tests: [] as string[],
      recommendations: [] as string[],
      errors: [] as string[]
    };

    try {
      // Use robust JSON extraction with schema validation
      const jsonData = await this.extractAndValidateJSON(response);
      
      if (!jsonData) {
        result.errors.push('No valid JSON found in Anthropic API output');
        return result;
      }

      return this.processTestData(jsonData, request);

    } catch (parseError: any) {
      log.error('Failed to parse Anthropic API response', { error: String(parseError) });
      result.errors.push(`Failed to parse response: ${parseError.message}`);
      
      // Save debug info
      await this.saveDebugResponse(response, parseError);
      
      return result;
    }
  }

  private async extractAndValidateJSON(response: string): Promise<z.infer<typeof TestGenerationSchema> | null> {
    // Strategy 1: Look for ```json blocks
    let jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (!jsonMatch) {
      // Strategy 2: Look for any JSON-like structure
      const start = response.indexOf('{');
      const end = response.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        jsonMatch = [response.substring(start, end + 1)];
      }
    }

    if (!jsonMatch) {
      return null;
    }

    let jsonText = Array.isArray(jsonMatch) ? jsonMatch[1] || jsonMatch[0] : jsonMatch;
    
    // Clean common JSON issues
    jsonText = jsonText
      .replace(/,\s*}/g, '}')  // Remove trailing commas
      .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .trim();

    // Try parsing with multiple strategies
    const parseStrategies = [
      () => JSON.parse(jsonText),
      () => JSON.parse(jsonText + '}'), // Add missing closing brace
      () => JSON.parse(jsonText + ']}'), // Add missing array/object close
      () => {
        // Try to fix common truncation issues
        if (jsonText.includes('"tests":[') && !jsonText.includes(']}')) {
          return JSON.parse(jsonText + ']}');
        }
        throw new Error('No fix strategy available');
      }
    ];

    for (const strategy of parseStrategies) {
      try {
        const parsed = strategy();
        const validated = TestGenerationSchema.parse(parsed);
        return validated;
      } catch (e) {
        // Continue to next strategy
      }
    }

    return null;
  }

  private async saveDebugResponse(response: string, error: any): Promise<void> {
    try {
      const debugPath = path.join(this.runPath, 'anthropic-response-debug.txt');
      const debugContent = [
        `Timestamp: ${new Date().toISOString()}`,
        `Error: ${error.message}`,
        `Response Length: ${response.length}`,
        '',
        'Response:',
        response,
        '',
        'Response Start (500 chars):',
        response.substring(0, 500),
        '',
        'Response End (500 chars):',
        response.substring(Math.max(0, response.length - 500))
      ].join('\n');
      
      await fs.writeFile(debugPath, debugContent, 'utf8');
      this.liveLogger.debug('Saved debug response', { debugPath });
    } catch (saveError) {
      log.debug('Could not save debug response', { error: saveError });
    }
  }

  private async processTestData(data: z.infer<typeof TestGenerationSchema>, request: AITestGenerationRequest): Promise<{
    success: boolean;
    files: string[];
    tests: string[];
    recommendations: string[];
    errors: string[];
  }> {
    const result = {
      success: false,
      files: [] as string[],
      tests: [] as string[],
      recommendations: data.recommendations || [],
      errors: [] as string[]
    };

    try {
      // Create test files directory
      const testDir = path.join(request.projectPath, '.uatu', 'ai_tests');
      await fs.ensureDir(testDir);

      for (const test of data.tests) {
        try {
          // Ensure safe file path
          const safePath = path.basename(test.path);
          const testPath = path.join(testDir, safePath);
          
          // Validate file extension
          const ext = path.extname(safePath).toLowerCase();
          const validExtensions = ['.ts', '.tsx', '.js', '.jsx', '.sol', '.rs'];
          if (!validExtensions.includes(ext)) {
            result.errors.push(`Invalid file extension for ${test.path}`);
            continue;
          }

          // Write file with content validation
          const content = test.content.slice(0, 100_000); // Enforce max size
          await fs.writeFile(testPath, content, 'utf8');
          
          result.files.push(testPath);
          result.tests.push(test.path);
          
          this.liveLogger.info('Generated test file', {
            path: testPath,
            type: test.type,
            description: test.description || 'AI generated test',
            size: content.length
          });
          
        } catch (writeError: any) {
          result.errors.push(`Failed to write test file ${test.path}: ${writeError.message}`);
        }
      }

      result.success = result.files.length > 0;
      
      if (data.summary) {
        result.recommendations.push(data.summary);
        this.liveLogger.info('Test generation summary', { summary: data.summary });
      }

    } catch (error: any) {
      log.error('Failed to process test data', { error: String(error) });
      result.errors.push(`Failed to process test data: ${error.message}`);
    }

    return result;
  }
}
