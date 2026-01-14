/**
 * SOP Orchestrator
 *
 * Main execution engine for SOP-based audits.
 * Handles step scheduling, dependency resolution, and progress tracking.
 */

import { EventEmitter } from 'events';
import type {
  SOPDefinition,
  StepDefinition,
  AuditDepth,
  StepContext,
  StepResult,
  StepStatus,
  StepFinding,
  UnifiedAuditOptions,
} from '../definitions/types';
import {
  getEnabledSteps,
  buildExecutionOrder,
  calculateTotalWeight,
} from '../definitions';
import { executeStep } from '../steps';
import { checkToolsAvailable, getAvailableToolNames } from '../../tools';
import { MicroStepProgressService } from '../../services/microStepProgressService';
import {
  InteractiveOrchestrator,
  createInteractiveOrchestrator,
  type InteractiveSessionConfig,
} from './interactiveOrchestrator';
import type { AddressType } from '../../db/schema';
import { logger } from '../../utils/logger';

const log = logger.child({ module: 'sop-orchestrator' });

// ============================================================================
// Types
// ============================================================================

export interface OrchestratorConfig {
  sop: SOPDefinition;
  jobId: string;
  projectPath: string;
  auditDepth: AuditDepth;
  userId?: string;
  projectId?: string;

  // Interactive mode configuration
  interactiveMode?: boolean;
  interactiveConfig?: {
    autoContinueTimeoutSeconds?: number;
    notificationEmail?: string;
    notifyOnCompletion?: boolean;
    notifyOnInputNeeded?: boolean;
    notifyOnCriticalFinding?: boolean;
    linkedProjects?: Array<{
      name: string;
      sourceType: string;
      sourceConfig: Record<string, any>;
      relationship: string;
      relevantContracts?: string[];
    }>;
    knownAddresses?: Array<{
      address: string;
      chain: string;
      label: string;
      addressType: AddressType;
      metadata?: Record<string, any>;
    }>;
  };
}

export interface OrchestratorEvents {
  'step:start': (stepId: string, stepName: string) => void;
  'step:progress': (stepId: string, pct: number, message: string) => void;
  'step:complete': (stepId: string, result: StepResult) => void;
  'step:failed': (stepId: string, error: string) => void;
  'step:skipped': (stepId: string, reason: string) => void;
  'audit:complete': (findings: StepFinding[], score: number) => void;
  'audit:failed': (error: string) => void;

  // Interactive mode events
  'prompt:required': (data: { prompt: any; template: any; timeoutAt: Date }) => void;
  'prompt:answered': (data: { promptId: string; answer: any }) => void;
  'prompt:timeout': (data: { promptId: string }) => void;
  'session:paused': (data: { promptId: string; reason: string }) => void;
  'session:resumed': (data: { promptId: string }) => void;
  'finding:enriched': (data: { findingId: string; adjustment: any }) => void;
}

// ============================================================================
// SOP Orchestrator
// ============================================================================

export class SOPOrchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private progressService: MicroStepProgressService;
  private interactiveOrchestrator: InteractiveOrchestrator | null = null;

  // Execution state
  private stepResults: Map<string, StepResult> = new Map();
  private stepData: Map<string, any> = new Map();
  private stepStatus: Map<string, StepStatus> = new Map();
  private availableTools: string[] = [];
  private allFindings: StepFinding[] = [];

  // Steps to execute
  private enabledSteps: StepDefinition[] = [];
  private executionLayers: StepDefinition[][] = [];
  private totalWeight: number = 0;
  private completedWeight: number = 0;

  // Timing
  private startTime: number = 0;

  constructor(config: OrchestratorConfig) {
    super();
    this.config = config;
    this.progressService = new MicroStepProgressService(config.jobId);

    // Initialize interactive orchestrator if enabled
    if (config.interactiveMode && config.userId) {
      this.interactiveOrchestrator = createInteractiveOrchestrator({
        jobId: config.jobId,
        userId: config.userId,
        interactiveMode: true,
        autoContinueTimeoutSeconds: config.interactiveConfig?.autoContinueTimeoutSeconds ?? 300,
        notificationEmail: config.interactiveConfig?.notificationEmail,
        notifyOnCompletion: config.interactiveConfig?.notifyOnCompletion ?? true,
        notifyOnInputNeeded: config.interactiveConfig?.notifyOnInputNeeded ?? true,
        notifyOnCriticalFinding: config.interactiveConfig?.notifyOnCriticalFinding ?? true,
        linkedProjects: config.interactiveConfig?.linkedProjects,
        knownAddresses: config.interactiveConfig?.knownAddresses,
      });

      // Forward interactive orchestrator events
      this.setupInteractiveEventForwarding();
    }
  }

  /**
   * Set up event forwarding from interactive orchestrator
   */
  private setupInteractiveEventForwarding(): void {
    if (!this.interactiveOrchestrator) return;

    this.interactiveOrchestrator.on('prompt_required', (data) => {
      this.emit('prompt:required', data);
    });

    this.interactiveOrchestrator.on('prompt_answered', (data) => {
      this.emit('prompt:answered', data);
    });

    this.interactiveOrchestrator.on('prompt_timeout', (data) => {
      this.emit('prompt:timeout', data);
    });

    this.interactiveOrchestrator.on('session_paused', (data) => {
      this.emit('session:paused', data);
    });

    this.interactiveOrchestrator.on('session_resumed', (data) => {
      this.emit('session:resumed', data);
    });

    this.interactiveOrchestrator.on('finding_enriched', (data) => {
      this.emit('finding:enriched', data);
    });
  }

  /**
   * Execute the SOP audit
   */
  async execute(): Promise<{
    success: boolean;
    findings: StepFinding[];
    score?: number;
    error?: string;
    sessionId?: string;
  }> {
    this.startTime = Date.now();

    log.info('Starting SOP execution', {
      sopId: this.config.sop.id,
      jobId: this.config.jobId,
      depth: this.config.auditDepth,
      interactiveMode: this.config.interactiveMode,
    });

    try {
      // Phase 1: Initialize
      await this.initialize();

      // Phase 2: Execute steps
      await this.executeAllSteps();

      // Phase 3: Collect results
      const score = this.calculateScore();

      // Phase 4: Complete interactive session if enabled
      if (this.interactiveOrchestrator) {
        await this.interactiveOrchestrator.completeSession(true);
      }

      log.info('SOP execution complete', {
        jobId: this.config.jobId,
        findingsCount: this.allFindings.length,
        score,
        durationMs: Date.now() - this.startTime,
      });

      this.emit('audit:complete', this.allFindings, score);

      return {
        success: true,
        findings: this.allFindings,
        score,
        sessionId: this.interactiveOrchestrator?.currentSessionId || undefined,
      };
    } catch (error: any) {
      log.error('SOP execution failed', {
        jobId: this.config.jobId,
        error: error.message,
      });

      // Mark interactive session as failed
      if (this.interactiveOrchestrator) {
        await this.interactiveOrchestrator.completeSession(false, error.message);
      }

      this.emit('audit:failed', error.message);

      return {
        success: false,
        findings: this.allFindings,
        error: error.message,
        sessionId: this.interactiveOrchestrator?.currentSessionId || undefined,
      };
    }
  }

  /**
   * Initialize the orchestrator
   */
  private async initialize(): Promise<void> {
    // Initialize interactive session if enabled
    if (this.interactiveOrchestrator) {
      const sessionId = await this.interactiveOrchestrator.initializeSession();
      log.info('Interactive session initialized', { sessionId });
    }

    // Get enabled steps for this depth
    this.enabledSteps = getEnabledSteps(this.config.sop, this.config.auditDepth);

    // Build execution order based on dependencies
    this.executionLayers = buildExecutionOrder(this.enabledSteps);

    // Calculate total weight for progress
    this.totalWeight = calculateTotalWeight(this.enabledSteps);

    // Check tool availability
    const requiredTools = this.config.sop.requiredTools.map((t) => t.name);
    const optionalTools = this.config.sop.optionalTools.map((t) => t.name);
    const allTools = [...requiredTools, ...optionalTools];

    const toolChecks = await checkToolsAvailable(allTools);
    this.availableTools = toolChecks.filter((t) => t.available).map((t) => t.name);

    // Check required tools
    const missingRequired = requiredTools.filter(
      (t) => !this.availableTools.includes(t)
    );

    if (missingRequired.length > 0) {
      throw new Error(
        `Missing required tools: ${missingRequired.join(', ')}. ` +
        `Install them or use Docker fallback.`
      );
    }

    // Initialize progress tracking
    await this.progressService.initializeSteps(
      this.config.jobId,
      this.enabledSteps,
      this.config.sop.id,
      this.config.sop.version,
      this.config.auditDepth,
      this.availableTools
    );

    // Initialize step status
    for (const step of this.enabledSteps) {
      this.stepStatus.set(step.id, 'pending');
    }

    // Set initial data
    this.stepData.set('projectPath', this.config.projectPath);
    this.stepData.set('jobId', this.config.jobId);

    log.info('Orchestrator initialized', {
      totalSteps: this.enabledSteps.length,
      layers: this.executionLayers.length,
      availableTools: this.availableTools,
      totalWeight: this.totalWeight,
    });
  }

  /**
   * Execute all steps in dependency order
   */
  private async executeAllSteps(): Promise<void> {
    const depthConfig = this.config.sop.depths[this.config.auditDepth];
    const parallelLevel = depthConfig.parallelizationLevel;

    for (let layerIdx = 0; layerIdx < this.executionLayers.length; layerIdx++) {
      const layer = this.executionLayers[layerIdx];

      log.debug('Executing layer', {
        layerIdx,
        steps: layer.map((s) => s.id),
      });

      if (parallelLevel === 'high') {
        // Execute all steps in layer in parallel
        await Promise.all(layer.map((step) => this.executeStepSafe(step)));
      } else if (parallelLevel === 'low') {
        // Execute in small batches of 2-3
        const batchSize = 2;
        for (let i = 0; i < layer.length; i += batchSize) {
          const batch = layer.slice(i, i + batchSize);
          await Promise.all(batch.map((step) => this.executeStepSafe(step)));
        }
      } else {
        // Sequential execution
        for (const step of layer) {
          await this.executeStepSafe(step);
        }
      }
    }
  }

  /**
   * Execute a single step with error handling
   */
  private async executeStepSafe(step: StepDefinition): Promise<void> {
    // Check if dependencies are satisfied
    const dependenciesMet = this.checkDependencies(step);

    if (!dependenciesMet) {
      if (step.required) {
        throw new Error(
          `Required step ${step.id} cannot run: dependencies not met`
        );
      }

      // Skip optional step
      this.stepStatus.set(step.id, 'skipped');
      await this.progressService.updateStepStatus(
        this.config.jobId,
        step.id,
        'skipped',
        undefined,
        'Dependencies not met'
      );
      this.emit('step:skipped', step.id, 'Dependencies not met');
      return;
    }

    // Check if tool is available (for tool steps)
    if (step.executor === 'tool') {
      const toolConfig = step.executorConfig as any;
      const toolName = toolConfig.tool;

      if (!this.availableTools.includes(toolName)) {
        if (step.required) {
          throw new Error(`Required tool not available: ${toolName}`);
        }

        // Skip optional tool step
        this.stepStatus.set(step.id, 'skipped');
        await this.progressService.updateStepStatus(
          this.config.jobId,
          step.id,
          'skipped',
          undefined,
          `Tool not available: ${toolName}`
        );
        this.emit('step:skipped', step.id, `Tool not available: ${toolName}`);
        return;
      }
    }

    // Execute with retry logic
    let lastError: Error | null = null;
    const maxRetries = step.retryCount + 1;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.executeStepOnce(step, attempt);
        return; // Success
      } catch (error: any) {
        lastError = error;

        if (attempt < maxRetries) {
          log.warn('Step failed, retrying', {
            stepId: step.id,
            attempt,
            maxRetries,
            error: error.message,
          });

          await this.progressService.incrementRetry(this.config.jobId, step.id);
        }
      }
    }

    // All retries failed
    this.stepStatus.set(step.id, 'failed');
    await this.progressService.updateStepStatus(
      this.config.jobId,
      step.id,
      'failed',
      undefined,
      lastError?.message
    );

    this.emit('step:failed', step.id, lastError?.message || 'Unknown error');

    if (step.required && !step.continueOnFailure) {
      throw lastError || new Error(`Required step ${step.id} failed`);
    }
  }

  /**
   * Execute a step once
   */
  private async executeStepOnce(
    step: StepDefinition,
    attempt: number
  ): Promise<void> {
    const startTime = Date.now();

    log.debug('Executing step', {
      stepId: step.id,
      attempt,
      executor: step.executor,
    });

    // Update status to running
    this.stepStatus.set(step.id, 'running');
    await this.progressService.updateStepStatus(
      this.config.jobId,
      step.id,
      'running'
    );

    this.emit('step:start', step.id, step.name);

    // Build context
    const context: StepContext = {
      job: {
        id: this.config.jobId,
        userId: this.config.userId,
        projectId: this.config.projectId,
        auditDepth: this.config.auditDepth,
      },
      sop: this.config.sop,
      projectPath: this.config.projectPath,
      data: this.buildStepData(step),
      availableTools: this.availableTools,
      onProgress: async (pct, message) => {
        await this.progressService.updateStepProgress(
          this.config.jobId,
          step.id,
          pct,
          message
        );
        this.emit('step:progress', step.id, pct, message);
      },
    };

    // Get timeout from depth config
    const depthConfig = this.config.sop.depths[this.config.auditDepth];
    const toolTimeouts = depthConfig.toolTimeouts || {};
    const timeout =
      toolTimeouts[(step.executorConfig as any)?.tool] ||
      step.timeoutSeconds * 1000;

    // Execute step with timeout
    // If interactive mode is enabled, wrap with interactive orchestrator
    let result: StepResult;

    if (this.interactiveOrchestrator) {
      // Use interactive orchestrator which handles prompts and finding enrichment
      result = await Promise.race([
        this.interactiveOrchestrator.executeStep(step, context, executeStep),
        this.createTimeout(timeout, step.id),
      ]);
    } else {
      // Direct step execution without interactive features
      result = await Promise.race([
        executeStep(step, context),
        this.createTimeout(timeout, step.id),
      ]);
    }

    const durationMs = Date.now() - startTime;

    // Store result
    this.stepResults.set(step.id, result);

    // Store provided data
    if (result.success && result.data) {
      for (const [key, value] of Object.entries(result.data)) {
        this.stepData.set(key, value);
      }
    }

    // Collect findings (already enriched if interactive mode)
    if (result.findings?.length) {
      this.allFindings.push(...result.findings);
    }

    // Update progress
    this.completedWeight += step.progressWeight;
    const overallPct = Math.round((this.completedWeight / this.totalWeight) * 100);

    // Update status
    this.stepStatus.set(step.id, result.success ? 'completed' : 'failed');
    await this.progressService.updateStepStatus(
      this.config.jobId,
      step.id,
      result.success ? 'completed' : 'failed',
      durationMs,
      result.error
    );

    await this.progressService.updateOverallProgress(
      this.config.jobId,
      overallPct
    );

    this.emit('step:complete', step.id, result);

    if (!result.success) {
      throw new Error(result.error || `Step ${step.id} failed`);
    }

    log.debug('Step completed', {
      stepId: step.id,
      durationMs,
      success: result.success,
      findingsCount: result.findings?.length || 0,
    });
  }

  /**
   * Build data object for step context
   */
  private buildStepData(step: StepDefinition): Record<string, any> {
    const data: Record<string, any> = {};

    // Include all required data
    for (const key of step.requires) {
      if (this.stepData.has(key)) {
        data[key] = this.stepData.get(key);
      }
    }

    // Always include basic data
    data.projectPath = this.config.projectPath;
    data.jobId = this.config.jobId;

    return data;
  }

  /**
   * Check if step dependencies are satisfied
   */
  private checkDependencies(step: StepDefinition): boolean {
    for (const depId of step.dependsOn) {
      const depStatus = this.stepStatus.get(depId);

      // Dependency must be completed
      if (depStatus !== 'completed') {
        // If skipped, check if step can still run
        if (depStatus === 'skipped') {
          // Check if all required data is available
          const depStep = this.enabledSteps.find((s) => s.id === depId);
          if (depStep) {
            const missingData = step.requires.filter(
              (key) =>
                depStep.provides.includes(key) && !this.stepData.has(key)
            );

            if (missingData.length > 0) {
              return false;
            }
          }
        } else {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Create timeout promise
   */
  private createTimeout(ms: number, stepId: string): Promise<StepResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Step ${stepId} timed out after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Calculate final audit score from findings
   */
  private calculateScore(): number {
    if (this.allFindings.length === 0) {
      return 100; // Perfect score if no findings
    }

    // Weight by severity
    const weights = {
      critical: 25,
      high: 15,
      medium: 5,
      low: 2,
      info: 0,
    };

    let deductions = 0;

    for (const finding of this.allFindings) {
      deductions += weights[finding.severity] || 0;
    }

    // Cap deductions at 100
    const score = Math.max(0, 100 - Math.min(deductions, 100));

    return score;
  }

  /**
   * Get current progress
   */
  async getProgress(): Promise<{
    overallPct: number;
    currentStep: { id: string; name: string; pct: number } | null;
    completedSteps: number;
    totalSteps: number;
    elapsedMs: number;
  }> {
    const overallPct = Math.round((this.completedWeight / this.totalWeight) * 100);

    // Find current running step
    let currentStep: { id: string; name: string; pct: number } | null = null;

    for (const [stepId, status] of this.stepStatus) {
      if (status === 'running') {
        const step = this.enabledSteps.find((s) => s.id === stepId);
        if (step) {
          currentStep = {
            id: stepId,
            name: step.name,
            pct: 50, // Default
          };
        }
        break;
      }
    }

    const completedSteps = Array.from(this.stepStatus.values()).filter(
      (s) => s === 'completed'
    ).length;

    return {
      overallPct,
      currentStep,
      completedSteps,
      totalSteps: this.enabledSteps.length,
      elapsedMs: Date.now() - this.startTime,
    };
  }

  /**
   * Cancel execution
   */
  cancel(): void {
    // This would need to be implemented with AbortController
    // for proper cancellation support
    log.info('Cancellation requested', { jobId: this.config.jobId });
  }

  // ==========================================================================
  // Interactive Mode Methods
  // ==========================================================================

  /**
   * Check if running in interactive mode
   */
  get isInteractiveMode(): boolean {
    return this.interactiveOrchestrator !== null;
  }

  /**
   * Check if currently paused for user input
   */
  get isPausedForInput(): boolean {
    return this.interactiveOrchestrator?.paused ?? false;
  }

  /**
   * Get the interactive session ID
   */
  get sessionId(): string | null {
    return this.interactiveOrchestrator?.currentSessionId ?? null;
  }

  /**
   * Submit an answer to a pending prompt
   * @param promptId The prompt ID
   * @param answer The user's answer
   * @param applyToSimilar Whether to apply this answer to similar findings
   */
  async submitPromptAnswer(
    promptId: string,
    answer: any,
    applyToSimilar: boolean = true
  ): Promise<void> {
    if (!this.interactiveOrchestrator) {
      throw new Error('Not in interactive mode');
    }

    await this.interactiveOrchestrator.submitAnswer(promptId, answer, applyToSimilar);
  }

  /**
   * Skip a pending prompt (use default value)
   * @param promptId The prompt ID
   */
  async skipPrompt(promptId: string): Promise<void> {
    if (!this.interactiveOrchestrator) {
      throw new Error('Not in interactive mode');
    }

    await this.interactiveOrchestrator.skipPrompt(promptId);
  }

  /**
   * Get the current session state
   */
  async getSessionState(): Promise<{
    sessionId: string;
    status: any;
    currentPrompt: any;
    linkedProjects: any[];
    knownAddresses: any[];
  } | null> {
    if (!this.interactiveOrchestrator) {
      return null;
    }

    return this.interactiveOrchestrator.getSessionState();
  }

  /**
   * Get the interactive orchestrator instance for direct access
   */
  getInteractiveOrchestrator(): InteractiveOrchestrator | null {
    return this.interactiveOrchestrator;
  }
}
