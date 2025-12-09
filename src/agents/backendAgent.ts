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

const log = logger.child({ service: 'backend-agent' });

/**
 * Backend Domain Agent
 * Specialized in API, server-side, and backend security
 */
export class BackendAgent implements DomainAgent {
  readonly name = 'Backend Agent';
  readonly domain: DomainType = 'backend';
  readonly supportedEcosystems = [
    'Express',
    'FastAPI',
    'Django',
    'Flask',
    'NestJS',
    'Spring Boot',
    'Gin',
    'Echo'
  ];
  readonly methodologies = [
    'injection',
    'access-control'
  ];

  private promptCache = getPromptCacheManager();

  async initialize(context: AuditContext): Promise<void> {
    log.info(`🎯 Initializing Backend Agent for ${context.jobId}`);

    if (!this.promptCache.isLayerCached(1)) {
      await this.promptCache.setSystemCore();
    }

    await this.promptCache.setMethodologies(this.methodologies, 'backend');

    log.info('✅ Backend Agent initialized');
  }

  async analyze(context: AuditContext): Promise<DomainFindings> {
    log.info('🔍 Starting Backend analysis...');
    const startTime = Date.now();

    try {
      const query = this.buildAnalysisQuery(context);
      const fullPrompt = await this.promptCache.buildPrompt(query, {
        domain: 'backend',
        methodologies: this.methodologies
      });

      log.info(`📤 Executing Backend analysis (${fullPrompt.length} chars)`);

      const output = await executeClaude(fullPrompt, {
        timeout: 1800000,
        jobId: parseInt(context.jobId) || undefined,
        cwd: context.projectPath
      });

      const findings = this.parseFindings(output);
      const duration = Math.round((Date.now() - startTime) / 1000);

      const result: DomainFindings = {
        domain: 'backend',
        findings,
        metrics: this.calculateMetrics(findings, duration),
        reasoning: []
      };

      log.info(`✅ Backend analysis complete: ${findings.length} findings in ${duration}s`);
      return result;
    } catch (error: any) {
      log.error('❌ Backend analysis failed:', error);
      throw error;
    }
  }

  async generateTests(findings: Finding[]): Promise<TestArtifacts> {
    log.info(`🧪 Generating K6/curl tests for ${findings.length} findings`);

    const k6Scripts = [];
    const curlCommands = [];

    const criticalAndHigh = findings.filter(
      f => f.severity === 'CRITICAL' || f.severity === 'HIGH'
    );

    for (const finding of criticalAndHigh) {
      try {
        // Generate curl command for injection/API vulnerabilities
        if (finding.category.toLowerCase().includes('injection') ||
            finding.category.toLowerCase().includes('api')) {
          const curlCmd = this.generateCurlCommand(finding);
          if (curlCmd) {
            curlCommands.push(curlCmd);
          }
        }

        // Generate K6 script for race conditions/concurrency issues
        if (finding.category.toLowerCase().includes('race') ||
            finding.category.toLowerCase().includes('concurrency')) {
          const k6Script = await this.generateK6Script(finding);
          if (k6Script) {
            k6Scripts.push(k6Script);
          }
        }
      } catch (error) {
        log.warn(`Failed to generate test for ${finding.id}:`, error);
      }
    }

    log.info(`✅ Generated ${k6Scripts.length} K6 scripts and ${curlCommands.length} curl commands`);

    return {
      k6_scripts: k6Scripts,
      curl_commands: curlCommands
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
      supportedLanguages: ['JavaScript', 'TypeScript', 'Python', 'Go', 'Java'],
      supportedFrameworks: this.supportedEcosystems
    };
  }

  private buildAnalysisQuery(context: AuditContext): string {
    return `
# Backend Security Audit

Analyze this backend codebase for security vulnerabilities.

## Project Context

\`\`\`
${context.projectContext}
\`\`\`

## Focus Areas

1. **Injection Attacks**: SQL, NoSQL, Command injection
2. **Authentication**: JWT, session management, OAuth
3. **Authorization**: Access control, IDOR, privilege escalation
4. **API Security**: Rate limiting, input validation, CORS
5. **Business Logic**: Race conditions, TOCTOU, workflow bypass

Output findings as JSON array.
`;
  }

  private parseFindings(output: string): Finding[] {
    try {
      const jsonMatch = output.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const findings = JSON.parse(jsonMatch[0]);
        return findings.map((f: any, index: number) => ({
          id: f.id || `BACKEND-${String(index + 1).padStart(3, '0')}`,
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

  private generateCurlCommand(finding: Finding): any {
    // Generate basic curl command structure
    const endpoint = finding.location.endpoint || '/api/endpoint';

    return {
      finding: finding.id,
      vulnerability: finding.title,
      command: `curl -X POST '${endpoint}' -H 'Content-Type: application/json' -d '{"malicious": "payload"}'`,
      expected_result: 'Should return 400 Bad Request but may return 200 OK (vulnerability)'
    };
  }

  private async generateK6Script(finding: Finding): Promise<any> {
    const testName = finding.id.replace(/-/g, '_');
    const filename = `${testName}_test.js`;

    const content = `
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 100,
  duration: '30s',
};

export default function() {
  // Test for ${finding.title}
  const res = http.post('http://api.example.com/endpoint', JSON.stringify({
    // Payload here
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

  check(res, {
    'status is 200 or 400': (r) => r.status === 200 || r.status === 400
  });
}
`;

    return {
      filename,
      related_finding: finding.id,
      purpose: `Tests ${finding.title}`,
      run_command: `k6 run ${filename}`,
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
