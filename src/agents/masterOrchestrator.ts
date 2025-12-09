import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import {
  DomainType,
  MasterOrchestrator,
  AuditContext,
  AgentResult,
  UnifiedAuditReport,
  AgentMessage,
  DomainAgent,
  Finding
} from './types';
import { Web3Agent } from './web3Agent';
import { BackendAgent } from './backendAgent';
import { FrontendAgent } from './frontendAgent';

const log = logger.child({ service: 'master-orchestrator' });

/**
 * Master Orchestrator
 * Routes audits to appropriate domain agents and combines results
 */
export class MasterOrchestratorImpl implements MasterOrchestrator {
  private agents: Map<DomainType, DomainAgent>;
  private messageQueue: AgentMessage[] = [];

  constructor() {
    this.agents = new Map();
    this.agents.set('web3', new Web3Agent());
    this.agents.set('backend', new BackendAgent());
    this.agents.set('frontend', new FrontendAgent());

    log.info('Master Orchestrator initialized with 3 domain agents');
  }

  /**
   * Detect which domains are present in the project
   */
  async detectDomains(projectPath: string): Promise<DomainType[]> {
    log.info(`🔍 Detecting domains in ${projectPath}`);

    const detected: DomainType[] = [];

    try {
      const files = await this.getAllFiles(projectPath);

      // Web3 indicators
      const hasWeb3 = files.some(f =>
        f.endsWith('.sol') ||
        f.includes('hardhat.config') ||
        f.includes('foundry.toml') ||
        f.includes('truffle-config')
      );

      if (hasWeb3) {
        detected.push('web3');
        log.info('✅ Web3 domain detected (Solidity files found)');
      }

      // Backend indicators
      const hasBackend = files.some(f =>
        f.includes('package.json') ||
        f.includes('requirements.txt') ||
        f.includes('go.mod') ||
        f.includes('pom.xml') ||
        f.includes('Cargo.toml') ||
        f.endsWith('.js') ||
        f.endsWith('.ts') ||
        f.endsWith('.py') ||
        f.endsWith('.go') ||
        f.endsWith('.java')
      );

      if (hasBackend) {
        detected.push('backend');
        log.info('✅ Backend domain detected (server-side code found)');
      }

      // Frontend indicators
      const hasFrontend = files.some(f =>
        f.includes('react') ||
        f.includes('vue') ||
        f.includes('angular') ||
        f.endsWith('.tsx') ||
        f.endsWith('.jsx') ||
        f.includes('next.config')
      );

      if (hasFrontend) {
        detected.push('frontend');
        log.info('✅ Frontend domain detected (UI framework found)');
      }

      if (detected.length === 0) {
        log.warn('⚠️  No domains detected, defaulting to backend');
        detected.push('backend');
      }

      log.info(`📋 Detected domains: ${detected.join(', ')}`);
      return detected;
    } catch (error) {
      log.error('Failed to detect domains:', error);
      return ['backend']; // Default fallback
    }
  }

  /**
   * Route audit to a specific agent
   */
  async routeToAgent(domain: DomainType, context: AuditContext): Promise<AgentResult> {
    log.info(`🎯 Routing to ${domain} agent`);

    const agent = this.agents.get(domain);
    if (!agent) {
      throw new Error(`No agent found for domain: ${domain}`);
    }

    const startTime = Date.now();

    try {
      // Initialize agent
      await agent.initialize(context);

      // Perform analysis
      const findings = await agent.analyze(context);

      // Generate tests if findings exist
      let testArtifacts;
      if (findings.findings.length > 0 && agent.getCapabilities().canGenerateTests) {
        log.info(`🧪 Generating tests for ${findings.findings.length} findings`);
        testArtifacts = await agent.generateTests(findings.findings);
      }

      const executionTime = Date.now() - startTime;

      log.info(`✅ ${domain} agent completed in ${(executionTime / 1000).toFixed(1)}s`);
      log.info(`   Found ${findings.findings.length} issues`);

      return {
        success: true,
        domain,
        findings,
        testArtifacts,
        executionTime
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      log.error(`❌ ${domain} agent failed:`, error);

      return {
        success: false,
        domain,
        findings: {
          domain,
          findings: [],
          metrics: {
            total_findings: 0,
            by_severity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
            by_category: {},
            analysis_duration: executionTime
          },
          reasoning: []
        },
        error: error.message,
        executionTime
      };
    }
  }

  /**
   * Route to all detected agents
   */
  async routeToAllAgents(context: AuditContext): Promise<AgentResult[]> {
    const domains = await this.detectDomains(context.projectPath);

    log.info(`\n${'='.repeat(80)}`);
    log.info(`🚀 Multi-Domain Audit: Routing to ${domains.length} agents`);
    log.info(`   Domains: ${domains.join(', ')}`);
    log.info(`${'='.repeat(80)}\n`);

    const results: AgentResult[] = [];

    // Execute agents sequentially (can be parallelized later)
    for (const domain of domains) {
      const result = await this.routeToAgent(domain, context);
      results.push(result);

      // Share findings with other agents via message bus
      if (result.success && result.findings.findings.length > 0) {
        await this.broadcastFindings(domain, result.findings.findings);
      }
    }

    return results;
  }

  /**
   * Combine results from multiple agents
   */
  combineResults(results: AgentResult[]): UnifiedAuditReport {
    log.info('📊 Combining results from all agents...');

    const allFindings: Finding[] = [];
    const allReasoning: any[] = [];
    const allTestArtifacts: any = {
      foundry_tests: [],
      k6_scripts: [],
      cypress_tests: [],
      curl_commands: []
    };

    let totalExecutionTime = 0;

    // Combine findings from all agents
    for (const result of results) {
      if (result.success) {
        allFindings.push(...result.findings.findings);
        allReasoning.push(...result.findings.reasoning);
        totalExecutionTime += result.executionTime;

        // Merge test artifacts
        if (result.testArtifacts) {
          if (result.testArtifacts.foundry_tests) {
            allTestArtifacts.foundry_tests.push(...result.testArtifacts.foundry_tests);
          }
          if (result.testArtifacts.k6_scripts) {
            allTestArtifacts.k6_scripts.push(...result.testArtifacts.k6_scripts);
          }
          if (result.testArtifacts.cypress_tests) {
            allTestArtifacts.cypress_tests.push(...result.testArtifacts.cypress_tests);
          }
          if (result.testArtifacts.curl_commands) {
            allTestArtifacts.curl_commands.push(...result.testArtifacts.curl_commands);
          }
        }
      }
    }

    // Calculate metrics
    const bySeverity = {
      critical: allFindings.filter(f => f.severity === 'CRITICAL').length,
      high: allFindings.filter(f => f.severity === 'HIGH').length,
      medium: allFindings.filter(f => f.severity === 'MEDIUM').length,
      low: allFindings.filter(f => f.severity === 'LOW').length,
      info: allFindings.filter(f => f.severity === 'INFO').length
    };

    const byCategory: Record<string, number> = {};
    for (const finding of allFindings) {
      byCategory[finding.category] = (byCategory[finding.category] || 0) + 1;
    }

    // Calculate score
    const score = this.calculateScore(bySeverity);

    // Determine domain
    const domains = results.map(r => r.domain);
    const auditDomain = domains.length > 1 ? 'Multi-Domain' :
      domains[0] === 'web3' ? 'Web3' :
      domains[0] === 'backend' ? 'Backend' : 'Frontend';

    // Build unified report
    const report: UnifiedAuditReport = {
      schema_version: '2.0.0',
      audit_report: {
        metadata: {
          target_system: 'Project',
          audit_domain: auditDomain,
          audit_depth: 'deep',
          auditor_model: 'claude-opus-4-5',
          timestamp: new Date().toISOString(),
          duration_seconds: Math.round(totalExecutionTime / 1000),
          milestones_completed: ['Agent Analysis Complete']
        },
        executive_summary: {
          overall_risk: this.calculateRisk(bySeverity),
          security_grade: score.grade,
          score: score.value,
          critical_count: bySeverity.critical,
          high_count: bySeverity.high,
          total_findings: allFindings.length,
          key_concerns: this.extractKeyConcerns(allFindings),
          business_impact: this.calculateBusinessImpact(allFindings),
          recommendation: this.generateRecommendation(score.value, bySeverity)
        },
        findings: {
          summary: {
            total: allFindings.length,
            by_severity: bySeverity,
            by_category: byCategory
          },
          critical: allFindings.filter(f => f.severity === 'CRITICAL'),
          high: allFindings.filter(f => f.severity === 'HIGH'),
          medium: allFindings.filter(f => f.severity === 'MEDIUM'),
          low: allFindings.filter(f => f.severity === 'LOW'),
          info: allFindings.filter(f => f.severity === 'INFO')
        },
        reasoning: allReasoning,
        tooling_artifacts: allTestArtifacts,
        score: {
          value: score.value,
          grade: score.grade,
          calculation: score.calculation,
          breakdown: bySeverity
        }
      }
    };

    log.info(`✅ Combined report generated:`);
    log.info(`   Total findings: ${allFindings.length}`);
    log.info(`   Score: ${score.value}/100 (Grade: ${score.grade})`);
    log.info(`   Risk: ${report.audit_report.executive_summary.overall_risk}`);

    return report;
  }

  /**
   * Send message between agents
   */
  async sendMessage(message: AgentMessage): Promise<void> {
    this.messageQueue.push(message);

    // If broadcast, send to all agents except sender
    if (message.to === 'broadcast') {
      for (const [domain, agent] of this.agents.entries()) {
        if (domain !== message.from && agent.handleMessage) {
          await agent.handleMessage(message);
        }
      }
    } else {
      // Send to specific agent
      const targetAgent = this.agents.get(message.to);
      if (targetAgent && targetAgent.handleMessage) {
        await targetAgent.handleMessage(message);
      }
    }
  }

  /**
   * Broadcast findings to other agents
   */
  private async broadcastFindings(from: DomainType, findings: Finding[]): Promise<void> {
    const message: AgentMessage = {
      from,
      to: 'broadcast',
      type: 'finding',
      payload: findings,
      timestamp: new Date()
    };

    await this.sendMessage(message);
  }

  /**
   * Calculate security score
   */
  private calculateScore(bySeverity: Record<string, number>): {
    value: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    calculation: string;
  } {
    const score = Math.max(
      0,
      100 - (bySeverity.critical * 25 + bySeverity.high * 10 + bySeverity.medium * 3 + bySeverity.low * 1)
    );

    const grade =
      score >= 90 ? 'A' :
      score >= 75 ? 'B' :
      score >= 60 ? 'C' :
      score >= 40 ? 'D' : 'F';

    const calculation = `100 - (${bySeverity.critical}×25 + ${bySeverity.high}×10 + ${bySeverity.medium}×3 + ${bySeverity.low}×1) = ${score}`;

    return { value: score, grade, calculation };
  }

  /**
   * Calculate overall risk level
   */
  private calculateRisk(bySeverity: Record<string, number>): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (bySeverity.critical > 0) return 'CRITICAL';
    if (bySeverity.high > 2) return 'HIGH';
    if (bySeverity.high > 0 || bySeverity.medium > 5) return 'HIGH';
    if (bySeverity.medium > 0) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Extract top concerns
   */
  private extractKeyConcerns(findings: Finding[]): string[] {
    const critical = findings.filter(f => f.severity === 'CRITICAL').slice(0, 3);
    const high = findings.filter(f => f.severity === 'HIGH').slice(0, 2);

    return [...critical, ...high].map(f => f.title);
  }

  /**
   * Calculate business impact
   */
  private calculateBusinessImpact(findings: Finding[]): string {
    const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
    const highCount = findings.filter(f => f.severity === 'HIGH').length;

    if (criticalCount > 0) {
      return `${criticalCount} critical vulnerabilities pose immediate risk of fund loss or system compromise. Immediate remediation required before deployment.`;
    } else if (highCount > 0) {
      return `${highCount} high-severity issues found. Address before production deployment to prevent security incidents.`;
    } else {
      return 'No critical issues found. Standard security improvements recommended.';
    }
  }

  /**
   * Generate deployment recommendation
   */
  private generateRecommendation(score: number, bySeverity: Record<string, number>): string {
    if (bySeverity.critical > 0) {
      return 'DO NOT DEPLOY - Critical vulnerabilities must be fixed first';
    } else if (score < 60) {
      return 'NOT READY - Multiple security issues require attention';
    } else if (score < 75) {
      return 'NEEDS WORK - Address high-severity findings before deployment';
    } else if (score < 90) {
      return 'GOOD - Minor improvements recommended';
    } else {
      return 'EXCELLENT - Ready for deployment with standard monitoring';
    }
  }

  /**
   * Get all files recursively
   */
  private async getAllFiles(dirPath: string, fileList: string[] = []): Promise<string[]> {
    try {
      const files = await fs.readdir(dirPath);

      for (const file of files) {
        const filePath = path.join(dirPath, file);

        // Skip common directories
        if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build') {
          continue;
        }

        const stat = await fs.stat(filePath);

        if (stat.isDirectory()) {
          await this.getAllFiles(filePath, fileList);
        } else {
          fileList.push(filePath);
        }
      }

      return fileList;
    } catch (error) {
      log.error(`Error reading directory ${dirPath}:`, error);
      return fileList;
    }
  }
}

// Singleton instance
let orchestrator: MasterOrchestratorImpl | null = null;

export function getMasterOrchestrator(): MasterOrchestratorImpl {
  if (!orchestrator) {
    orchestrator = new MasterOrchestratorImpl();
  }
  return orchestrator;
}
