import fs from "fs-extra";
import path from "node:path";
import { logger } from "../utils/logger.js";

const log = logger.child({ module: 'insightGenerator' });

export type InsightArea = 'Build' | 'Tests' | 'Security' | 'Coverage' | 'AI' | 'Dependencies';
export type InsightPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export interface Insight {
  area: InsightArea;
  summary: string;
  evidence: {
    command?: string;
    exitCode?: number;
    logExcerpt?: string;
    additionalContext?: Record<string, any>;
  };
  rootCause: string;
  suggestedRemediation: {
    preferred: string;
    alternatives?: string[];
    patches?: string[]; // Code snippets as patches (do not apply)
  };
  priority: InsightPriority;
  timestamp: string;
}

export class InsightGenerator {
  private runPath: string;
  private insights: Insight[] = [];

  constructor(runPath: string) {
    this.runPath = runPath;
  }

  public async addInsight(insight: Omit<Insight, 'timestamp'>): Promise<void> {
    const fullInsight: Insight = {
      ...insight,
      timestamp: new Date().toISOString()
    };

    this.insights.push(fullInsight);
    await this.writeInsightsToFile();
    
    log.info('Added insight', { 
      area: insight.area, 
      priority: insight.priority, 
      summary: insight.summary 
    });
  }

  public async addCompileFailure(
    command: string, 
    exitCode: number, 
    errorOutput: string, 
    toolchain: string
  ): Promise<void> {
    const topLines = errorOutput.split('\n').slice(0, 20).join('\n');
    const summary = this.generateCompileFailureSummary(errorOutput, toolchain);
    const remediation = this.generateCompileRemediation(errorOutput, toolchain);

    await this.addInsight({
      area: 'Build',
      summary,
      evidence: {
        command,
        exitCode,
        logExcerpt: topLines
      },
      rootCause: this.analyzeCompileFailure(errorOutput, toolchain),
      suggestedRemediation: remediation,
      priority: 'High'
    });
  }

  public async addTestFailure(
    command: string,
    exitCode: number,
    errorOutput: string,
    toolchain: string
  ): Promise<void> {
    const topLines = errorOutput.split('\n').slice(0, 20).join('\n');
    const summary = this.generateTestFailureSummary(errorOutput, toolchain);

    await this.addInsight({
      area: 'Tests',
      summary,
      evidence: {
        command,
        exitCode,
        logExcerpt: topLines
      },
      rootCause: this.analyzeTestFailure(errorOutput, toolchain),
      suggestedRemediation: {
        preferred: this.generateTestRemediation(errorOutput, toolchain)
      },
      priority: 'Medium'
    });
  }

  public async addClaudeFailure(
    sessionId: string,
    error: string,
    capabilities: any
  ): Promise<void> {
    await this.addInsight({
      area: 'AI',
      summary: `Claude CLI failed during ${sessionId}`,
      evidence: {
        command: 'claude CLI invocation',
        logExcerpt: error,
        additionalContext: { sessionId, capabilities }
      },
      rootCause: this.analyzeClaudeFailure(error, capabilities),
      suggestedRemediation: {
        preferred: this.generateClaudeRemediation(error, capabilities)
      },
      priority: 'Medium'
    });
  }

  public async addDependencyFailure(
    command: string,
    exitCode: number,
    errorOutput: string,
    toolchain: string
  ): Promise<void> {
    await this.addInsight({
      area: 'Dependencies',
      summary: `Dependency installation failed for ${toolchain}`,
      evidence: {
        command,
        exitCode,
        logExcerpt: errorOutput.split('\n').slice(0, 15).join('\n')
      },
      rootCause: this.analyzeDependencyFailure(errorOutput, toolchain),
      suggestedRemediation: {
        preferred: this.generateDependencyRemediation(errorOutput, toolchain)
      },
      priority: 'High'
    });
  }

  public async addCoverageIssue(message: string, details?: any): Promise<void> {
    await this.addInsight({
      area: 'Coverage',
      summary: message,
      evidence: {
        additionalContext: details
      },
      rootCause: 'Coverage collection failed or is incomplete',
      suggestedRemediation: {
        preferred: 'Check test configuration and coverage plugin setup'
      },
      priority: 'Low'
    });
  }

  public getInsights(): Insight[] {
    return [...this.insights];
  }

  public async writeInsightsToFile(): Promise<void> {
    const insightsPath = path.join(this.runPath, 'insights.md');
    let content = '# Audit Insights\n\n';
    
    if (this.insights.length === 0) {
      content += 'No insights generated - execution completed successfully.\n';
    } else {
      for (const insight of this.insights) {
        content += this.formatInsightAsMarkdown(insight);
        content += '\n---\n\n';
      }
    }

    await fs.writeFile(insightsPath, content, 'utf8');
    
    // Also write as JSON for programmatic access
    await fs.writeJson(
      path.join(this.runPath, 'insights.json'), 
      this.insights, 
      { spaces: 2 }
    );
  }

  private formatInsightAsMarkdown(insight: Insight): string {
    const { area, summary, evidence, rootCause, suggestedRemediation, priority, timestamp } = insight;
    
    let md = `## [${area}] ${summary}\n\n`;
    md += `**Priority:** ${priority} | **Time:** ${timestamp}\n\n`;
    
    md += '### Evidence\n';
    if (evidence.command) {
      md += `- **Command:** \`${evidence.command}\`\n`;
    }
    if (evidence.exitCode !== undefined) {
      md += `- **Exit code:** ${evidence.exitCode}\n`;
    }
    if (evidence.logExcerpt) {
      md += '- **Log excerpt:**\n```\n' + evidence.logExcerpt + '\n```\n';
    }
    if (evidence.additionalContext) {
      md += `- **Additional context:** ${JSON.stringify(evidence.additionalContext, null, 2)}\n`;
    }
    md += '\n';

    md += '### Root-cause hypothesis\n';
    md += `${rootCause}\n\n`;

    md += '### Suggested remediation (do not apply)\n';
    md += `- **Option A (preferred):** ${suggestedRemediation.preferred}\n`;
    
    if (suggestedRemediation.alternatives) {
      suggestedRemediation.alternatives.forEach((alt, idx) => {
        md += `- **Option ${String.fromCharCode(66 + idx)}:** ${alt}\n`;
      });
    }

    if (suggestedRemediation.patches) {
      md += '\n**Code patches:**\n';
      suggestedRemediation.patches.forEach((patch, idx) => {
        md += `\nPatch ${idx + 1}:\n\`\`\`diff\n${patch}\n\`\`\`\n`;
      });
    }

    md += '\n### Impact / Priority\n';
    md += `${priority}\n\n`;

    return md;
  }

  private generateCompileFailureSummary(errorOutput: string, toolchain: string): string {
    if (errorOutput.includes('solc')) {
      return 'Solidity compiler version mismatch or syntax error';
    }
    if (errorOutput.includes('pragma')) {
      return 'Pragma version incompatible with installed compiler';
    }
    if (errorOutput.includes('import')) {
      return 'Import resolution failure';
    }
    if (errorOutput.includes('hardhat') && errorOutput.includes('plugin')) {
      return 'Hardhat plugin missing or misconfigured';
    }
    return `${toolchain} compilation failed`;
  }

  private analyzeCompileFailure(errorOutput: string, toolchain: string): string {
    if (errorOutput.includes('pragma solidity')) {
      return 'Solidity pragma version range incompatible with installed solc version';
    }
    if (errorOutput.includes('Module not found') || errorOutput.includes('Cannot find module')) {
      return 'Missing dependency or incorrect import path';
    }
    if (errorOutput.includes('HardhatConfig')) {
      return 'Hardhat configuration file has syntax errors or missing plugins';
    }
    return 'Compilation failed due to syntax errors or configuration issues';
  }

  private generateCompileRemediation(errorOutput: string, toolchain: string): any {
    const remediation: any = { preferred: '', alternatives: [] };

    if (errorOutput.includes('pragma solidity')) {
      remediation.preferred = 'Update solc version in hardhat.config.js or foundry.toml to match pragma requirements';
      remediation.patches = [`
// In hardhat.config.js
module.exports = {
  solidity: {
    version: "0.8.19", // Match your pragma version
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};`];
    } else if (errorOutput.includes('Module not found')) {
      remediation.preferred = 'Install missing dependencies with npm install or check import paths';
      remediation.alternatives = [
        'Verify node_modules directory exists and is not corrupted',
        'Check package.json for missing dependencies'
      ];
    } else {
      remediation.preferred = `Review ${toolchain} configuration and fix syntax errors`;
    }

    return remediation;
  }

  private generateTestFailureSummary(errorOutput: string, toolchain: string): string {
    if (errorOutput.includes('timeout')) {
      return 'Tests timed out during execution';
    }
    if (errorOutput.includes('gas')) {
      return 'Gas-related test failures';
    }
    if (errorOutput.includes('revert')) {
      return 'Contract reverted during test execution';
    }
    return `${toolchain} test execution failed`;
  }

  private analyzeTestFailure(errorOutput: string, toolchain: string): string {
    if (errorOutput.includes('timeout')) {
      return 'Test execution exceeded timeout limits, possibly due to infinite loops or network delays';
    }
    if (errorOutput.includes('insufficient gas')) {
      return 'Gas limits too low for test operations';
    }
    return 'Test logic errors or environmental issues';
  }

  private generateTestRemediation(errorOutput: string, toolchain: string): string {
    if (errorOutput.includes('timeout')) {
      return 'Increase test timeout in configuration or optimize test logic';
    }
    if (errorOutput.includes('gas')) {
      return 'Increase gas limits in test configuration';
    }
    return 'Review failing test cases and fix assertion logic';
  }

  private analyzeClaudeFailure(error: string, capabilities: any): string {
    if (error.includes('timeout')) {
      return 'Claude CLI timed out, possibly due to large prompt or network issues';
    }
    if (error.includes('permission')) {
      return 'Claude CLI permission error, sandbox mode not properly configured';
    }
    if (!capabilities.available) {
      return 'Claude CLI not installed or not accessible in PATH';
    }
    return 'Claude CLI execution failed due to configuration or runtime issues';
  }

  private generateClaudeRemediation(error: string, capabilities: any): string {
    if (error.includes('timeout')) {
      return 'Increase CLAUDE_TIMEOUT_MS environment variable or reduce prompt size';
    }
    if (error.includes('permission')) {
      return 'Ensure Claude CLI is run with --dangerously-skip-permissions and --permission-mode sandboxBashMode';
    }
    if (!capabilities.available) {
      return 'Install Claude CLI: npm install -g @anthropic/claude-cli';
    }
    return 'Check Claude CLI configuration and permissions';
  }

  private analyzeDependencyFailure(errorOutput: string, toolchain: string): string {
    if (errorOutput.includes('network')) {
      return 'Network connectivity issues during package installation';
    }
    if (errorOutput.includes('ENOENT') || errorOutput.includes('not found')) {
      return 'Missing system dependencies or incorrect paths';
    }
    if (errorOutput.includes('version')) {
      return 'Package version conflicts or incompatible dependencies';
    }
    return 'Dependency installation failed due to configuration or network issues';
  }

  private generateDependencyRemediation(errorOutput: string, toolchain: string): string {
    if (errorOutput.includes('network')) {
      return 'Check internet connectivity and npm registry configuration';
    }
    if (errorOutput.includes('ENOENT')) {
      return 'Install required system dependencies (Node.js, Python, build tools)';
    }
    if (errorOutput.includes('version')) {
      return 'Update package.json with compatible dependency versions';
    }
    return 'Clear node_modules and package-lock.json, then reinstall dependencies';
  }
}
