import { logger } from '../utils/logger';
import { AuditContext, DomainType } from '../agents/types';
import { getMasterOrchestrator } from '../agents/masterOrchestrator';
import { getPromptCacheManager } from './promptCache';
import { CostControlService } from './costControl';

const log = logger.child({ service: 'dry-run' });

/**
 * Dry Run Mode
 * Previews audit execution without actually running AI analysis
 */

export interface DryRunResult {
  job_id: string;
  project_path: string;
  preview: {
    detected_domains: DomainType[];
    selected_agents: string[];
    milestones: MilestonePreview[];
    estimated_duration: number; // seconds
    estimated_cost: {
      min: number;
      max: number;
      typical: number;
    };
    file_count: number;
    total_lines: number;
  };
  warnings: string[];
  recommendations: string[];
}

export interface MilestonePreview {
  number: number;
  name: string;
  description: string;
  estimated_duration: number; // seconds
  operations: string[];
  methodologies: string[];
}

export class DryRunService {
  /**
   * Run audit preview without executing
   */
  async preview(context: AuditContext): Promise<DryRunResult> {
    log.info(`🔍 Starting dry run for ${context.jobId}`);

    const warnings: string[] = [];
    const recommendations: string[] = [];

    try {
      // 1. Detect domains
      const orchestrator = getMasterOrchestrator();
      const domains = await orchestrator.detectDomains(context.projectPath);

      log.info(`Detected domains: ${domains.join(', ')}`);

      if (domains.length === 0) {
        warnings.push('No domains detected - will use generic analysis');
      }

      if (domains.length > 1) {
        recommendations.push(
          `Multi-domain project detected (${domains.join(', ')}). Consider running separate audits per domain for better accuracy.`
        );
      }

      // 2. Determine which agents will be used
      const selectedAgents = domains.map(d => this.getAgentName(d));

      // 3. Preview milestones
      const milestones = this.getMilestonePreview(domains);

      // 4. Analyze project size
      const { fileCount, totalLines } = await this.analyzeProjectSize(
        context.projectPath
      );

      if (fileCount === 0) {
        warnings.push('No files detected in project');
      }

      if (fileCount > 500) {
        warnings.push(
          `Large project (${fileCount} files) - audit may take longer than estimated`
        );
        recommendations.push(
          'Consider using incremental audit mode for large projects'
        );
      }

      // 5. Estimate duration
      const estimatedDuration = this.estimateDuration(fileCount, totalLines, domains.length);

      // 6. Estimate cost
      const estimatedCost = this.estimateCost(fileCount, totalLines, domains.length);

      if (estimatedCost.typical > 5.0) {
        recommendations.push(
          `Estimated cost $${estimatedCost.typical.toFixed(2)} - consider setting a budget limit`
        );
      }

      // 7. Check for issues
      if (totalLines < 100) {
        warnings.push('Very small project - may not have enough code to analyze');
      }

      const result: DryRunResult = {
        job_id: context.jobId,
        project_path: context.projectPath,
        preview: {
          detected_domains: domains,
          selected_agents: selectedAgents,
          milestones,
          estimated_duration: estimatedDuration,
          estimated_cost: estimatedCost,
          file_count: fileCount,
          total_lines: totalLines
        },
        warnings,
        recommendations
      };

      log.info('✅ Dry run complete', {
        domains: domains.length,
        files: fileCount,
        duration: estimatedDuration,
        cost: estimatedCost.typical
      });

      return result;
    } catch (error: any) {
      log.error('Dry run failed:', error);
      throw error;
    }
  }

  /**
   * Get agent name for domain
   */
  private getAgentName(domain: DomainType): string {
    const names: Partial<Record<DomainType, string>> & Record<string, string> = {
      web3: 'Web3 Agent (EVM & Solidity)',
      backend: 'Backend Agent (API & Server)',
      frontend: 'Frontend Agent (Client-Side)'
    };
    return names[domain] || domain;
  }

  /**
   * Get milestone preview
   */
  private getMilestonePreview(domains: DomainType[]): MilestonePreview[] {
    const milestones: MilestonePreview[] = [
      {
        number: 1,
        name: 'Context Ingestion',
        description: 'Load project structure and dependencies',
        estimated_duration: 30,
        operations: [
          'Read all source files',
          'Build dependency graph',
          'Cache project context'
        ],
        methodologies: []
      },
      {
        number: 2,
        name: 'Static Analysis',
        description: 'Analyze code patterns and structure',
        estimated_duration: 120,
        operations: [
          'Map architecture',
          'Identify attack surfaces',
          'Detect static vulnerabilities'
        ],
        methodologies: this.getMethodologiesForDomains(domains)
      },
      {
        number: 3,
        name: 'Logic Simulation',
        description: 'Simulate execution paths and business logic',
        estimated_duration: 180,
        operations: [
          'Chain-of-Thought reasoning',
          'Simulate attack scenarios',
          'Cross-component analysis'
        ],
        methodologies: this.getMethodologiesForDomains(domains)
      },
      {
        number: 4,
        name: 'Test Generation',
        description: 'Generate PoC tests for vulnerabilities',
        estimated_duration: 90,
        operations: [
          'Generate exploit tests',
          'Create reproduction scripts',
          'Build attack PoCs'
        ],
        methodologies: []
      },
      {
        number: 5,
        name: 'Final Consolidation',
        description: 'Combine findings and generate report',
        estimated_duration: 30,
        operations: [
          'Aggregate all findings',
          'Calculate security score',
          'Generate recommendations'
        ],
        methodologies: []
      }
    ];

    return milestones;
  }

  /**
   * Get methodologies for domains
   */
  private getMethodologiesForDomains(domains: DomainType[]): string[] {
    const methodologies = new Set<string>();

    for (const domain of domains) {
      if (domain === 'web3') {
        methodologies.add('Reentrancy Detection');
        methodologies.add('Oracle Manipulation');
        methodologies.add('Access Control');
      } else if (domain === 'backend') {
        methodologies.add('Injection Attacks');
        methodologies.add('Access Control');
        methodologies.add('Race Conditions');
      } else if (domain === 'frontend') {
        methodologies.add('XSS Detection');
        methodologies.add('Access Control');
        methodologies.add('State Manipulation');
      }
    }

    return Array.from(methodologies);
  }

  /**
   * Analyze project size
   */
  private async analyzeProjectSize(
    projectPath: string
  ): Promise<{ fileCount: number; totalLines: number }> {
    const fs = require('fs/promises');
    const path = require('path');

    let fileCount = 0;
    let totalLines = 0;

    const relevantExtensions = [
      '.sol',
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.py',
      '.go',
      '.java',
      '.rs'
    ];

    const ignoreDirs = [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '.next',
      'out',
      'target'
    ];

    const walk = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!ignoreDirs.includes(entry.name)) {
              await walk(fullPath);
            }
          } else {
            const ext = path.extname(entry.name);
            if (relevantExtensions.includes(ext)) {
              fileCount++;

              // Count lines
              try {
                const content = await fs.readFile(fullPath, 'utf-8');
                totalLines += content.split('\n').length;
              } catch {
                // Skip if can't read
              }
            }
          }
        }
      } catch (error) {
        log.warn(`Failed to analyze directory ${dir}:`, error);
      }
    };

    await walk(projectPath);

    return { fileCount, totalLines };
  }

  /**
   * Estimate audit duration
   */
  private estimateDuration(
    fileCount: number,
    totalLines: number,
    domainCount: number
  ): number {
    // Base time per milestone
    const baseTime = 30 + 120 + 180 + 90 + 30; // 450 seconds = 7.5 minutes

    // Scale based on project size
    const sizeMultiplier = Math.max(1, Math.log10(fileCount + 1) * 0.5);

    // Scale based on domains (multi-domain takes longer)
    const domainMultiplier = domainCount > 1 ? 1.5 : 1.0;

    // Scale based on lines of code
    const linesMultiplier = Math.max(1, Math.log10(totalLines + 1) * 0.3);

    const estimated =
      baseTime * sizeMultiplier * domainMultiplier * linesMultiplier;

    return Math.round(estimated);
  }

  /**
   * Estimate audit cost
   */
  private estimateCost(
    fileCount: number,
    totalLines: number,
    domainCount: number
  ): { min: number; max: number; typical: number } {
    // Estimate based on tokens
    // Rough estimate: 1 line = 20 tokens average
    const estimatedTokens = totalLines * 20;

    // With 4-layer caching, expect ~80% cache hit rate
    const cacheHitRate = 0.8;

    // Input tokens (with caching)
    const normalInput = estimatedTokens * (1 - cacheHitRate);
    const cachedInput = estimatedTokens * cacheHitRate;

    // Output tokens (findings, reasoning, tests)
    const estimatedOutput = fileCount * 500; // ~500 tokens output per file

    // Pricing for Sonnet
    const inputCost = normalInput * (3.0 / 1_000_000);
    const cachedCost = cachedInput * (0.3 / 1_000_000);
    const outputCost = estimatedOutput * (15.0 / 1_000_000);

    const typical = inputCost + cachedCost + outputCost;

    // Min: small audit with high cache hit
    const min = typical * 0.5;

    // Max: large audit with low cache hit
    const max = typical * 2.0;

    return {
      min: Math.max(0.01, min),
      max,
      typical
    };
  }

  /**
   * Validate audit configuration
   */
  async validate(context: AuditContext): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check project path exists
    try {
      const fs = require('fs/promises');
      await fs.access(context.projectPath);
    } catch {
      errors.push(`Project path does not exist: ${context.projectPath}`);
    }

    // Check for empty context
    if (!context.projectContext || context.projectContext.trim().length === 0) {
      warnings.push('Project context is empty - may affect analysis quality');
    }

    // Check job ID
    if (!context.jobId || context.jobId.trim().length === 0) {
      errors.push('Job ID is required');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Singleton instance
let dryRunService: DryRunService | null = null;

export function getDryRunService(): DryRunService {
  if (!dryRunService) {
    dryRunService = new DryRunService();
  }
  return dryRunService;
}
