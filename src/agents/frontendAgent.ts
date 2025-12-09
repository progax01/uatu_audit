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

const log = logger.child({ service: 'frontend-agent' });

/**
 * Frontend Domain Agent
 * Specialized in client-side, SPA, and UI security
 */
export class FrontendAgent implements DomainAgent {
  readonly name = 'Frontend Agent';
  readonly domain: DomainType = 'frontend';
  readonly supportedEcosystems = [
    'React',
    'Vue',
    'Angular',
    'Svelte',
    'Next.js',
    'Nuxt.js'
  ];
  readonly methodologies = [
    'access-control'
  ];

  private promptCache = getPromptCacheManager();

  async initialize(context: AuditContext): Promise<void> {
    log.info(`🎯 Initializing Frontend Agent for ${context.jobId}`);

    if (!this.promptCache.isLayerCached(1)) {
      await this.promptCache.setSystemCore();
    }

    await this.promptCache.setMethodologies(this.methodologies, 'frontend');

    log.info('✅ Frontend Agent initialized');
  }

  async analyze(context: AuditContext): Promise<DomainFindings> {
    log.info('🔍 Starting Frontend analysis...');
    const startTime = Date.now();

    try {
      const query = this.buildAnalysisQuery(context);
      const fullPrompt = await this.promptCache.buildPrompt(query, {
        domain: 'frontend',
        methodologies: this.methodologies
      });

      log.info(`📤 Executing Frontend analysis (${fullPrompt.length} chars)`);

      const output = await executeClaude(fullPrompt, {
        timeout: 1800000,
        jobId: context.jobId,
        cwd: context.projectPath
      });

      const findings = this.parseFindings(output);
      const duration = Math.round((Date.now() - startTime) / 1000);

      const result: DomainFindings = {
        domain: 'frontend',
        findings,
        metrics: this.calculateMetrics(findings, duration),
        reasoning: []
      };

      log.info(`✅ Frontend analysis complete: ${findings.length} findings in ${duration}s`);
      return result;
    } catch (error: any) {
      log.error('❌ Frontend analysis failed:', error);
      throw error;
    }
  }

  async generateTests(findings: Finding[]): Promise<TestArtifacts> {
    log.info(`🧪 Generating Cypress tests for ${findings.length} findings`);

    const cypressTests = [];

    const criticalAndHigh = findings.filter(
      f => f.severity === 'CRITICAL' || f.severity === 'HIGH'
    );

    for (const finding of criticalAndHigh) {
      try {
        const test = await this.generateCypressTest(finding);
        if (test) {
          cypressTests.push(test);
        }
      } catch (error) {
        log.warn(`Failed to generate test for ${finding.id}:`, error);
      }
    }

    log.info(`✅ Generated ${cypressTests.length} Cypress tests`);

    return {
      cypress_tests: cypressTests
    };
  }

  async handleMessage(message: AgentMessage): Promise<void> {
    log.debug(`📨 Received message from ${message.from}: ${message.type}`);
  }

  getCapabilities(): AgentCapabilities {
    return {
      canGenerateTests: true,
      canAnalyzeCode: true,
      canDetectFrameworks: true,
      supportedLanguages: ['JavaScript', 'TypeScript', 'HTML', 'CSS'],
      supportedFrameworks: this.supportedEcosystems
    };
  }

  private buildAnalysisQuery(context: AuditContext): string {
    return `
# Frontend Security Audit

Analyze this frontend codebase for security vulnerabilities.

## Project Context

\`\`\`
${context.projectContext}
\`\`\`

## Focus Areas

1. **XSS**: DOM-based, reflected, stored XSS
2. **State Management**: Redux manipulation, client-side bypass
3. **Authentication**: Client-side auth checks, token storage
4. **Data Exposure**: Sensitive data in localStorage, hardcoded secrets
5. **Prototype Pollution**: Object manipulation, postMessage vulnerabilities

Output findings as JSON array.
`;
  }

  private parseFindings(output: string): Finding[] {
    try {
      const jsonMatch = output.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const findings = JSON.parse(jsonMatch[0]);
        return findings.map((f: any, index: number) => ({
          id: f.id || `FRONTEND-${String(index + 1).padStart(3, '0')}`,
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
          cwe: f.cwe
        }));
      }

      return [];
    } catch (error) {
      log.error('Failed to parse findings:', error);
      return [];
    }
  }

  private async generateCypressTest(finding: Finding): Promise<any> {
    const testName = finding.id.replace(/-/g, '_');
    const filename = `${testName}.cy.js`;

    const content = `
describe('${finding.title}', () => {
  it('should prevent ${finding.category}', () => {
    cy.visit('/');

    // Test scenario for ${finding.title}
    // Add test implementation here

    cy.window().then((win) => {
      // Assertions
    });
  });
});
`;

    return {
      filename,
      related_finding: finding.id,
      purpose: `Tests ${finding.title}`,
      run_command: `npx cypress run --spec cypress/e2e/${filename}`,
      content
    };
  }

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
