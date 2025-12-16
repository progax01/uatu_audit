import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { executeClaude } from '../services/ai/claudeCLIProvider';
import { getPromptCacheManager } from '../services/promptCache';
import { getMethodologyVersionManager } from '../services/methodologyVersionManager';
import type { DomainType } from '../agents/types';

const log = logger.child({ service: 'milestone-executor' });

/**
 * 5-Milestone Execution Engine
 * Implements the Deep Intelligence Framework's milestone-based audit pipeline
 */

export type MilestoneNumber = 1 | 2 | 3 | 4 | 5;
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface MilestoneConfig {
  id: MilestoneNumber;
  name: string;
  description: string;
  requiredInputs: string[];
  outputSchema: any;
  timeout: number; // in milliseconds
  methodologies?: string[]; // Required methodologies for this milestone
  canSkip?: boolean; // Can this milestone be skipped?
}

export interface MilestoneState {
  milestone: MilestoneNumber;
  status: MilestoneStatus;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  startTime?: Date;
  endTime?: Date;
  duration?: number; // in seconds
  error?: string;
  retryCount?: number;
}

export interface AuditContext {
  jobId: string;
  projectPath: string;
  projectContext?: string; // Flattened source code
  domain?: 'web3' | 'backend' | 'frontend' | 'multi-domain';
  methodologies?: string[];
  testStyle?: string;
  auditDepth?: 'quick' | 'standard' | 'deep';
}

export interface MilestoneResult {
  success: boolean;
  state: MilestoneState;
  output?: any;
  error?: string;
}

/**
 * Milestone Configurations
 */
const MILESTONE_CONFIGS: Record<MilestoneNumber, MilestoneConfig> = {
  1: {
    id: 1,
    name: 'Context Ingestion',
    description: 'Read and understand the entire codebase, build mental model',
    requiredInputs: ['projectPath', 'projectContext'],
    outputSchema: {
      files_analyzed: 'number',
      contracts_found: 'number',
      frameworks_detected: 'array',
      context_cached: 'boolean'
    },
    timeout: 600000, // 10 minutes
    canSkip: false
  },
  2: {
    id: 2,
    name: 'Static & Structural Analysis',
    description: 'Pattern-based vulnerability detection and architectural analysis',
    requiredInputs: ['projectContext'],
    outputSchema: {
      findings: 'array',
      static_metrics: 'object'
    },
    timeout: 1800000, // 30 minutes
    methodologies: ['access-control'], // Always include access control
    canSkip: false
  },
  3: {
    id: 3,
    name: 'Deep Logic Simulation',
    description: 'Chain-of-Thought reasoning for complex attack scenarios',
    requiredInputs: ['projectContext', 'staticFindings'],
    outputSchema: {
      findings: 'array',
      reasoning: 'array',
      attack_scenarios_tested: 'number'
    },
    timeout: 3600000, // 60 minutes
    methodologies: [], // Uses all configured methodologies
    canSkip: false
  },
  4: {
    id: 4,
    name: 'Verification Test Generation',
    description: 'Generate executable PoC tests for critical findings',
    requiredInputs: ['findings'],
    outputSchema: {
      tooling_artifacts: 'object',
      tests_generated: 'number'
    },
    timeout: 1800000, // 30 minutes
    canSkip: true // Can skip if audit_depth is 'quick'
  },
  5: {
    id: 5,
    name: 'Final Consolidation',
    description: 'Combine findings, calculate score, generate recommendations',
    requiredInputs: ['allFindings'],
    outputSchema: {
      audit_report: 'object',
      score: 'number',
      grade: 'string'
    },
    timeout: 600000, // 10 minutes
    canSkip: false
  }
};

export class MilestoneExecutor {
  private context: AuditContext;
  private states: Map<MilestoneNumber, MilestoneState>;
  private promptCache;
  private versionManager;
  private stateFilePath: string;

  constructor(context: AuditContext) {
    this.context = context;
    this.states = new Map();
    this.promptCache = getPromptCacheManager();
    this.versionManager = getMethodologyVersionManager();

    // Initialize state file path
    const contextDir = path.join(context.projectPath, 'context');
    this.stateFilePath = path.join(contextDir, 'milestone_state.json');

    // Initialize all milestones as pending
    for (let i = 1; i <= 5; i++) {
      this.states.set(i as MilestoneNumber, {
        milestone: i as MilestoneNumber,
        status: 'pending',
        inputs: {},
        outputs: {},
        retryCount: 0
      });
    }

    log.info(`MilestoneExecutor initialized for job ${context.jobId}`);
  }

  /**
   * Execute a single milestone
   */
  async executeMilestone(
    milestoneNumber: MilestoneNumber,
    inputs: Record<string, any> = {}
  ): Promise<MilestoneResult> {
    const config = MILESTONE_CONFIGS[milestoneNumber];
    const state = this.states.get(milestoneNumber)!;

    log.info(`\n${'='.repeat(80)}`);
    log.info(`🎯 Starting Milestone ${milestoneNumber}: ${config.name}`);
    log.info(`   ${config.description}`);
    log.info(`${'='.repeat(80)}\n`);

    // Check if can skip
    if (config.canSkip && this.context.auditDepth === 'quick') {
      log.info(`⏭️  Skipping Milestone ${milestoneNumber} (quick audit mode)`);
      state.status = 'skipped';
      await this.saveState();
      return { success: true, state };
    }

    // Validate inputs
    log.info(`📋 Validating inputs for Milestone ${milestoneNumber}:`);
    log.info(`   Required: ${config.requiredInputs.join(', ')}`);
    log.info(`   Provided: ${Object.keys(inputs).join(', ') || 'none'}`);

    for (const requiredInput of config.requiredInputs) {
      if (!inputs[requiredInput] && !state.inputs[requiredInput]) {
        const error = `Missing required input: ${requiredInput}`;
        log.error(`❌ ${error}`);
        log.error(`   Available in state: ${Object.keys(state.inputs).join(', ') || 'none'}`);
        state.status = 'failed';
        state.error = error;
        await this.saveState();
        return { success: false, state, error };
      }
      const inputValue = inputs[requiredInput] || state.inputs[requiredInput];
      const preview = typeof inputValue === 'string'
        ? `${inputValue.length} chars`
        : typeof inputValue;
      log.info(`   ✓ ${requiredInput}: ${preview}`);
    }

    // Update state
    log.info(`\n🔄 Updating milestone state to 'in_progress'`);
    state.status = 'in_progress';
    state.inputs = { ...state.inputs, ...inputs };
    state.startTime = new Date();
    await this.saveState();
    log.info(`   State saved at: ${state.startTime.toISOString()}`);

    try {
      // Build prompt with appropriate layers
      log.info(`\n🔨 Building milestone query...`);
      const dynamicQuery = await this.buildMilestoneQuery(milestoneNumber, inputs);
      log.info(`   Query built: ${dynamicQuery.length} chars`);

      // Determine methodologies to load
      log.info(`\n🧬 Determining methodologies for Milestone ${milestoneNumber}...`);
      const methodologies = this.determineMilestoneMethodologies(milestoneNumber);
      log.info(`   Selected methodologies: ${methodologies.join(', ')}`);

      // Setup prompt cache layers
      log.info(`\n📦 Setting up prompt cache layers...`);
      await this.setupPromptCache(methodologies);
      log.info(`   Prompt cache ready`);

      // Build full prompt
      const validDomains: DomainType[] = ['web3', 'backend', 'frontend'];
      const domain = this.context.domain && validDomains.includes(this.context.domain as any)
        ? (this.context.domain as DomainType)
        : undefined;

      log.info(`\n🏗️  Building full prompt with caching...`);
      log.info(`   Domain: ${domain || 'auto-detect'}`);
      log.info(`   Methodologies: ${methodologies.length}`);
      log.info(`   Milestone: ${milestoneNumber}`);

      const fullPrompt = await this.promptCache.buildPrompt(dynamicQuery, {
        domain,
        methodologies,
        milestone: milestoneNumber
      });

      log.info(`\n📤 Sending prompt to Claude:`);
      log.info(`   Total size: ${fullPrompt.length} chars`);
      log.info(`   Timeout: ${config.timeout / 1000}s`);
      log.info(`   Job ID: ${this.context.jobId}`);

      // Execute via Claude CLI with timeout
      const startTime = Date.now();
      log.info(`\n⏳ Executing Claude CLI...`);
      const output = await executeClaude(fullPrompt, {
        timeout: config.timeout,
        jobId: parseInt(this.context.jobId) || undefined,
        cwd: this.context.projectPath
      });
      const executionTime = Date.now() - startTime;

      log.info(`\n✅ Claude execution completed:`);
      log.info(`   Duration: ${(executionTime / 1000).toFixed(1)}s`);
      log.info(`   Output size: ${output.length} chars`);

      // Parse output
      log.info(`\n🔍 Parsing Claude output...`);
      const parsedOutput = this.parseOutput(output, milestoneNumber);
      log.info(`   Parsed output keys: ${Object.keys(parsedOutput).join(', ')}`);

      // Log output details based on milestone
      if (parsedOutput.findings) {
        log.info(`   Findings extracted: ${Array.isArray(parsedOutput.findings) ? parsedOutput.findings.length : 'N/A'}`);
      }
      if (parsedOutput.files_analyzed) {
        log.info(`   Files analyzed: ${parsedOutput.files_analyzed}`);
      }
      if (parsedOutput.score) {
        log.info(`   Score: ${parsedOutput.score.value} (${parsedOutput.score.grade})`);
      }

      // Update state
      log.info(`\n💾 Updating milestone state to 'completed'`);
      state.status = 'completed';
      state.outputs = parsedOutput;
      state.endTime = new Date();
      state.duration = Math.round(executionTime / 1000);
      await this.saveState();
      log.info(`   State saved with outputs`);

      // Record methodology usage
      log.info(`\n📊 Recording methodology usage...`);
      await this.versionManager.recordAuditUsage(
        this.context.jobId,
        methodologies,
        this.context.domain,
        milestoneNumber
      );
      log.info(`   Usage recorded for ${methodologies.length} methodologies`);

      log.info(`\n✅ Milestone ${milestoneNumber} completed successfully`);
      log.info(`   Duration: ${state.duration}s`);
      log.info(`   Output keys: ${Object.keys(parsedOutput).join(', ')}`);
      log.info(`   Status: ${state.status}\n`);

      return { success: true, state, output: parsedOutput };
    } catch (error: any) {
      log.error(`❌ Milestone ${milestoneNumber} failed:`, error);

      state.status = 'failed';
      state.error = error.message || String(error);
      state.endTime = new Date();
      state.retryCount = (state.retryCount || 0) + 1;
      await this.saveState();

      return { success: false, state, error: error.message };
    }
  }

  /**
   * Execute all milestones in sequence
   */
  async executeAll(): Promise<boolean> {
    log.info(`\n${'█'.repeat(80)}`);
    log.info(`🚀 Starting Full Audit Pipeline: 5 Milestones`);
    log.info(`   Job ID: ${this.context.jobId}`);
    log.info(`   Domain: ${this.context.domain || 'auto-detect'}`);
    log.info(`   Depth: ${this.context.auditDepth || 'standard'}`);
    log.info(`${'█'.repeat(80)}\n`);

    const overallStartTime = Date.now();

    for (let i = 1; i <= 5; i++) {
      const milestoneNumber = i as MilestoneNumber;
      const previousState = i > 1 ? this.states.get((i - 1) as MilestoneNumber) : null;

      // Prepare inputs from previous milestone outputs
      const inputs = this.prepareInputsForMilestone(milestoneNumber);

      const result = await this.executeMilestone(milestoneNumber, inputs);

      if (!result.success) {
        log.error(`\n❌ Pipeline failed at Milestone ${milestoneNumber}`);
        log.error(`   Error: ${result.error}`);
        return false;
      }

      // Check if skipped
      if (result.state.status === 'skipped') {
        log.info(`⏭️  Milestone ${milestoneNumber} skipped, continuing...`);
        continue;
      }
    }

    const totalDuration = Math.round((Date.now() - overallStartTime) / 1000);

    log.info(`\n${'█'.repeat(80)}`);
    log.info(`✅ Full Audit Pipeline Completed Successfully!`);
    log.info(`   Total Duration: ${totalDuration}s (${(totalDuration / 60).toFixed(1)} minutes)`);
    log.info(`   All 5 milestones executed`);
    log.info(`${'█'.repeat(80)}\n`);

    return true;
  }

  /**
   * Resume from a specific milestone
   */
  async resume(fromMilestone: MilestoneNumber): Promise<boolean> {
    log.info(`🔄 Resuming audit from Milestone ${fromMilestone}`);

    // Load previous state
    await this.loadState();

    // Verify previous milestones are completed
    for (let i = 1; i < fromMilestone; i++) {
      const state = this.states.get(i as MilestoneNumber);
      if (state?.status !== 'completed' && state?.status !== 'skipped') {
        log.error(`Cannot resume: Milestone ${i} is not completed`);
        return false;
      }
    }

    // Execute from the specified milestone
    for (let i = fromMilestone; i <= 5; i++) {
      const milestoneNumber = i as MilestoneNumber;
      const inputs = this.prepareInputsForMilestone(milestoneNumber);
      const result = await this.executeMilestone(milestoneNumber, inputs);

      if (!result.success) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get current state of all milestones
   */
  getState(): MilestoneState[] {
    return Array.from(this.states.values());
  }

  /**
   * Get state of a specific milestone
   */
  getMilestoneState(milestoneNumber: MilestoneNumber): MilestoneState | undefined {
    return this.states.get(milestoneNumber);
  }

  /**
   * Save state to disk for persistence
   */
  async saveState(): Promise<void> {
    try {
      // Ensure context directory exists
      await fs.mkdir(path.dirname(this.stateFilePath), { recursive: true });

      const stateData = {
        jobId: this.context.jobId,
        timestamp: new Date().toISOString(),
        context: this.context,
        milestones: Array.from(this.states.entries()).map(([id, state]) => ({
          id,
          ...state
        })),
        currentMilestone: this.getCurrentMilestone(),
        canResume: this.canResume()
      };

      await fs.writeFile(
        this.stateFilePath,
        JSON.stringify(stateData, null, 2),
        'utf-8'
      );

      log.debug(`State saved to ${this.stateFilePath}`);
    } catch (error) {
      log.error(`Failed to save state:`, error);
    }
  }

  /**
   * Load state from disk
   */
  async loadState(): Promise<boolean> {
    try {
      const content = await fs.readFile(this.stateFilePath, 'utf-8');
      const stateData = JSON.parse(content);

      // Restore milestone states
      for (const milestone of stateData.milestones) {
        this.states.set(milestone.id, {
          milestone: milestone.milestone,
          status: milestone.status,
          inputs: milestone.inputs,
          outputs: milestone.outputs,
          startTime: milestone.startTime ? new Date(milestone.startTime) : undefined,
          endTime: milestone.endTime ? new Date(milestone.endTime) : undefined,
          duration: milestone.duration,
          error: milestone.error,
          retryCount: milestone.retryCount
        });
      }

      log.info(`State loaded from ${this.stateFilePath}`);
      log.info(`Current milestone: ${stateData.currentMilestone}`);
      log.info(`Can resume: ${stateData.canResume}`);

      return true;
    } catch (error) {
      log.debug(`No previous state found or failed to load: ${error}`);
      return false;
    }
  }

  /**
   * Get current milestone number (first non-completed)
   */
  private getCurrentMilestone(): MilestoneNumber | null {
    for (let i = 1; i <= 5; i++) {
      const state = this.states.get(i as MilestoneNumber);
      if (state && state.status !== 'completed' && state.status !== 'skipped') {
        return i as MilestoneNumber;
      }
    }
    return null;
  }

  /**
   * Check if audit can be resumed
   */
  private canResume(): boolean {
    const current = this.getCurrentMilestone();
    if (!current || current === 1) return false;

    // Check if at least one milestone is completed
    for (let i = 1; i < current; i++) {
      const state = this.states.get(i as MilestoneNumber);
      if (state?.status === 'completed' || state?.status === 'skipped') {
        return true;
      }
    }

    return false;
  }

  /**
   * Build milestone-specific query
   */
  private async buildMilestoneQuery(
    milestoneNumber: MilestoneNumber,
    inputs: Record<string, any>
  ): Promise<string> {
    const config = MILESTONE_CONFIGS[milestoneNumber];

    let query = `# Milestone ${milestoneNumber}: ${config.name}\n\n`;
    query += `${config.description}\n\n`;
    query += `## Your Task\n\n`;

    // Add milestone-specific instructions
    switch (milestoneNumber) {
      case 1:
        query += `Read and analyze the following project context:\n\n`;
        query += `\`\`\`\n${inputs.projectContext}\n\`\`\`\n\n`;
        query += `Provide your analysis in the format specified in the milestone instructions above.\n`;
        break;

      case 2:
        query += `Perform static analysis on the project.\n\n`;
        query += `Focus on pattern-based vulnerability detection as described in the methodologies loaded.\n`;
        break;

      case 3:
        query += `Perform deep logic simulation using Chain-of-Thought reasoning.\n\n`;
        if (inputs.staticFindings) {
          query += `Static findings to investigate further:\n${JSON.stringify(inputs.staticFindings, null, 2)}\n\n`;
        }
        break;

      case 4:
        query += `Generate executable PoC tests for the following findings:\n\n`;
        query += `${JSON.stringify(inputs.findings, null, 2)}\n\n`;
        break;

      case 5:
        query += `Consolidate all findings and generate the final audit report:\n\n`;
        query += `${JSON.stringify(inputs.allFindings, null, 2)}\n\n`;
        break;
    }

    // Add JSON output instruction for all milestones
    query += `\n## Output Format\n\n`;
    query += `IMPORTANT: Output ONLY valid JSON. No markdown, no explanations, no code blocks - just the raw JSON object.\n`;
    query += `Your entire response must be a single valid JSON object that can be parsed by JSON.parse().\n`;

    return query;
  }

  /**
   * Determine which methodologies to load for a milestone
   */
  private determineMilestoneMethodologies(milestoneNumber: MilestoneNumber): string[] {
    const config = MILESTONE_CONFIGS[milestoneNumber];
    const contextMethodologies = this.context.methodologies || [];

    if (config.methodologies && config.methodologies.length > 0) {
      // Use milestone-specific methodologies
      return config.methodologies;
    } else if (milestoneNumber === 3) {
      // M3 uses all configured methodologies
      return contextMethodologies.length > 0
        ? contextMethodologies
        : ['reentrancy', 'oracle-manipulation', 'access-control', 'injection'];
    } else {
      // Other milestones use context methodologies
      return contextMethodologies;
    }
  }

  /**
   * Setup prompt cache layers
   */
  private async setupPromptCache(methodologies: string[]): Promise<void> {
    // Load system core (Layer 1) if not already loaded
    if (!this.promptCache.isLayerCached(1)) {
      await this.promptCache.setSystemCore();
    }

    // Load project context (Layer 2) if available
    if (this.context.projectContext && !this.promptCache.isLayerCached(2)) {
      await this.promptCache.setProjectContext(this.context.projectContext);
    }

    // Load methodologies (Layer 3)
    if (methodologies.length > 0) {
      await this.promptCache.setMethodologies(methodologies, this.context.domain);
    }
  }

  /**
   * Parse Claude's output
   */
  private parseOutput(output: string, milestoneNumber: MilestoneNumber): any {
    try {
      // Strategy 1: Try to parse entire output as JSON first (ideal case)
      try {
        return JSON.parse(output.trim());
      } catch {
        // Continue to other strategies
      }

      // Strategy 2: Look for ```json code blocks
      const codeBlockMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        return JSON.parse(codeBlockMatch[1]);
      }

      // Strategy 3: Find JSON object by matching balanced braces
      const jsonStr = this.extractBalancedJson(output);
      if (jsonStr) {
        return JSON.parse(jsonStr);
      }

      // If no JSON found, return raw output
      log.warn(`No JSON found in output for milestone ${milestoneNumber}, returning raw output`);
      return { raw_output: output };
    } catch (error) {
      log.error(`Failed to parse output:`, error);
      return { raw_output: output, parse_error: String(error) };
    }
  }

  /**
   * Extract JSON by finding balanced braces (handles nested objects)
   */
  private extractBalancedJson(text: string): string | null {
    // Find the first '{' that starts a valid JSON object
    let startIndex = -1;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        // Check if this looks like the start of a JSON object (not a template literal or other syntax)
        const beforeChar = i > 0 ? text[i - 1] : ' ';
        // Skip if it looks like a template variable ${...} or similar
        if (beforeChar === '$') continue;

        startIndex = i;
        break;
      }
    }

    if (startIndex === -1) return null;

    // Count braces to find matching closing brace
    let braceCount = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            return text.substring(startIndex, i + 1);
          }
        }
      }
    }

    return null;
  }

  /**
   * Prepare inputs for a milestone from previous outputs
   */
  private prepareInputsForMilestone(milestoneNumber: MilestoneNumber): Record<string, any> {
    const inputs: Record<string, any> = {};

    // M1: Needs project context
    if (milestoneNumber === 1) {
      inputs.projectPath = this.context.projectPath;
      inputs.projectContext = this.context.projectContext;
    }

    // M2: Needs project context
    if (milestoneNumber === 2) {
      const m1State = this.states.get(1);
      inputs.projectContext = this.context.projectContext;
      if (m1State?.outputs) {
        inputs.contextSummary = m1State.outputs;
      }
    }

    // M3: Needs project context and static findings from M2
    if (milestoneNumber === 3) {
      inputs.projectContext = this.context.projectContext;
      const m2State = this.states.get(2);
      if (m2State?.outputs) {
        // Handle both structured findings and raw output from M2
        inputs.staticFindings = m2State.outputs.findings || m2State.outputs.raw_output || m2State.outputs;
      }
    }

    // M4: Needs all findings from M2 and M3
    if (milestoneNumber === 4) {
      const m2State = this.states.get(2);
      const m3State = this.states.get(3);
      const findings: any[] = [];

      // Handle both structured findings and raw output
      if (m2State?.outputs?.findings) {
        findings.push(...m2State.outputs.findings);
      } else if (m2State?.outputs?.raw_output) {
        findings.push({ source: 'milestone_2', content: m2State.outputs.raw_output });
      }

      if (m3State?.outputs?.findings) {
        findings.push(...m3State.outputs.findings);
      } else if (m3State?.outputs?.raw_output) {
        findings.push({ source: 'milestone_3', content: m3State.outputs.raw_output });
      }

      inputs.findings = findings.length > 0 ? findings : m2State?.outputs || m3State?.outputs || [];
    }

    // M5: Needs all findings and test artifacts
    if (milestoneNumber === 5) {
      const m2State = this.states.get(2);
      const m3State = this.states.get(3);
      const m4State = this.states.get(4);
      const allFindings: any[] = [];

      // Handle both structured findings and raw output
      if (m2State?.outputs?.findings) {
        allFindings.push(...m2State.outputs.findings);
      } else if (m2State?.outputs?.raw_output) {
        allFindings.push({ source: 'milestone_2', content: m2State.outputs.raw_output });
      }

      if (m3State?.outputs?.findings) {
        allFindings.push(...m3State.outputs.findings);
      } else if (m3State?.outputs?.raw_output) {
        allFindings.push({ source: 'milestone_3', content: m3State.outputs.raw_output });
      }

      inputs.allFindings = allFindings.length > 0 ? allFindings : [m2State?.outputs, m3State?.outputs].filter(Boolean);
      if (m4State?.outputs?.tooling_artifacts) {
        inputs.testArtifacts = m4State.outputs.tooling_artifacts;
      }
    }

    return inputs;
  }
}
