import { logger } from '../utils/logger';
import {
  DomainAgent,
  DomainType,
  AuditContext,
  DomainFindings,
  Finding,
  TestArtifacts,
  AgentCapabilities,
  AgentMessage
} from './types';
import { getPromptCacheManager } from '../services/promptCache';
import { executeClaude } from '../services/ai/claudeCLIProvider';

const log = logger.child({ service: 'web3-agent' });

/**
 * Web3 Domain Agent
 * Specialized in EVM, Solidity, and smart contract security
 */
export class Web3Agent implements DomainAgent {
  readonly name = 'Web3 Agent';
  readonly domain: DomainType = 'web3';
  readonly supportedEcosystems = [
    'Hardhat',
    'Foundry',
    'Truffle',
    'Brownie',
    'Ape'
  ];
  readonly methodologies = [
    'reentrancy',
    'oracle-manipulation',
    'access-control'
  ];

  private promptCache = getPromptCacheManager();

  async initialize(context: AuditContext): Promise<void> {
    log.info(`🎯 Initializing Web3 Agent for ${context.jobId}`);

    // Load system core if not already loaded
    if (!this.promptCache.isLayerCached(1)) {
      await this.promptCache.setSystemCore();
    }

    // Load Web3-specific methodologies
    await this.promptCache.setMethodologies(this.methodologies, 'web3');

    log.info('✅ Web3 Agent initialized');
  }

  async analyze(context: AuditContext): Promise<DomainFindings> {
    log.info('🔍 Starting Web3 analysis...');
    const startTime = Date.now();

    try {
      // Build analysis prompt
      const query = this.buildAnalysisQuery(context);

      // Build full prompt with caching
      const fullPrompt = await this.promptCache.buildPrompt(query, {
        domain: 'web3',
        methodologies: this.methodologies
      });

      log.info(`📤 Executing Web3 analysis (${fullPrompt.length} chars)`);

      // Execute via Claude
      const output = await executeClaude(fullPrompt, {
        timeout: 1800000, // 30 minutes
        jobId: context.jobId,
        cwd: context.projectPath
      });

      // Parse findings
      const findings = this.parseFindings(output);
      const duration = Math.round((Date.now() - startTime) / 1000);

      const result: DomainFindings = {
        domain: 'web3',
        findings,
        metrics: this.calculateMetrics(findings, duration),
        reasoning: []
      };

      log.info(`✅ Web3 analysis complete: ${findings.length} findings in ${duration}s`);
      return result;
    } catch (error: any) {
      log.error('❌ Web3 analysis failed:', error);
      throw error;
    }
  }

  async generateTests(findings: Finding[]): Promise<TestArtifacts> {
    log.info(`🧪 Generating Foundry tests for ${findings.length} findings`);

    const foundryTests = [];

    // Generate tests only for CRITICAL and HIGH findings
    const criticalAndHigh = findings.filter(
      f => f.severity === 'CRITICAL' || f.severity === 'HIGH'
    );

    for (const finding of criticalAndHigh) {
      try {
        const test = await this.generateFoundryTest(finding);
        if (test) {
          foundryTests.push(test);
        }
      } catch (error) {
        log.warn(`Failed to generate test for ${finding.id}:`, error);
      }
    }

    log.info(`✅ Generated ${foundryTests.length} Foundry tests`);

    return {
      foundry_tests: foundryTests
    };
  }

  async handleMessage(message: AgentMessage): Promise<void> {
    log.debug(`📨 Received message from ${message.from}: ${message.type}`);

    // Handle cross-agent findings (e.g., backend finding API endpoint called from contract)
    if (message.type === 'finding') {
      // Could enhance analysis based on findings from other agents
      log.debug('Processing cross-domain finding...');
    }
  }

  getCapabilities(): AgentCapabilities {
    return {
      canGenerateTests: true,
      canAnalyzeCode: true,
      canDetectFrameworks: true,
      supportedLanguages: ['Solidity', 'Vyper'],
      supportedFrameworks: this.supportedEcosystems
    };
  }

  /**
   * Build analysis query
   */
  private buildAnalysisQuery(context: AuditContext): string {
    return `
# Web3 Security Audit

You are analyzing a Web3 project for security vulnerabilities.

## Project Context

\`\`\`
${context.projectContext}
\`\`\`

## Your Task

Perform a comprehensive security audit of the above smart contracts. Focus on:

1. **Reentrancy Vulnerabilities**: Classic, cross-function, read-only, and cross-contract
2. **Oracle Manipulation**: Flash loan attacks, TWAP manipulation, Chainlink misuse
3. **Access Control**: Missing modifiers, tx.origin issues, unprotected initializers
4. **Logic Flaws**: Business logic errors, invariant violations
5. **Economic Exploits**: MEV opportunities, arbitrage vulnerabilities

For each finding, provide:
- Severity (CRITICAL, HIGH, MEDIUM, LOW, INFO)
- Confidence score (0.0 - 1.0)
- Detailed description
- Exploit scenario
- Recommendation

Output your findings as a JSON array of findings following the schema.
`;
  }

  /**
   * Parse findings from Claude's output
   */
  private parseFindings(output: string): Finding[] {
    try {
      // Extract JSON from output
      const jsonMatch = output.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const findings = JSON.parse(jsonMatch[0]);
        return findings.map((f: any, index: number) => ({
          id: f.id || `WEB3-${String(index + 1).padStart(3, '0')}`,
          severity: f.severity || 'MEDIUM',
          confidence: f.confidence || 0.8,
          title: f.title || 'Unnamed vulnerability',
          category: f.category || 'General',
          location: f.location || { file: 'unknown' },
          description: f.description || '',
          impact: f.impact || '',
          exploit_scenario: f.exploit_scenario,
          recommendation: f.recommendation || 'Review and fix',
          references: f.references || [],
          swc: f.swc,
          cwe: f.cwe
        }));
      }

      log.warn('No JSON array found in output, returning empty findings');
      return [];
    } catch (error) {
      log.error('Failed to parse findings:', error);
      return [];
    }
  }

  /**
   * Generate Foundry test for a finding
   */
  private async generateFoundryTest(finding: Finding): Promise<any> {
    const testName = finding.id.replace(/-/g, '_');
    const filename = `${testName}_Exploit.t.sol`;

    // Build test generation prompt
    const query = `
Generate a Foundry test that demonstrates the vulnerability: ${finding.title}

Description: ${finding.description}
Exploit Scenario: ${finding.exploit_scenario}

Generate a complete Foundry test file (.t.sol) that:
1. Imports forge-std/Test.sol
2. Sets up the vulnerable contract
3. Implements the attack scenario
4. Asserts that the exploit succeeds

Output only the Solidity code for the test file.
`;

    try {
      const testCode = await executeClaude(query, {
        timeout: 300000, // 5 minutes
        cwd: process.cwd()
      });

      return {
        filename,
        related_finding: finding.id,
        purpose: `Demonstrates ${finding.title}`,
        run_command: `forge test --match-test test${testName} -vvv`,
        content: testCode
      };
    } catch (error) {
      log.error(`Failed to generate test for ${finding.id}:`, error);
      return null;
    }
  }

  /**
   * Calculate metrics
   */
  private calculateMetrics(findings: Finding[], duration: number) {
    const bySeverity = {
      critical: findings.filter(f => f.severity === 'CRITICAL').length,
      high: findings.filter(f => f.severity === 'HIGH').length,
      medium: findings.filter(f => f.severity === 'MEDIUM').length,
      low: findings.filter(f => f.severity === 'LOW').length,
      info: findings.filter(f => f.severity === 'INFO').length
    };

    const byCategory: Record<string, number> = {};
    for (const finding of findings) {
      byCategory[finding.category] = (byCategory[finding.category] || 0) + 1;
    }

    return {
      total_findings: findings.length,
      by_severity: bySeverity,
      by_category: byCategory,
      analysis_duration: duration
    };
  }
}
