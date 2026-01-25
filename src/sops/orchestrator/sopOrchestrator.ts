/**
 * SOP Orchestrator
 *
 * Main execution engine for SOP-based audits.
 * Handles step scheduling, dependency resolution, and progress tracking.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
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
import { moduleRegistry } from '../modules/registry.js';

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

    log.debug('Starting SOP execution', {
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

      log.debug('SOP execution complete', {
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
      log.debug('Interactive session initialized', { sessionId });
    }

    // Get enabled steps for this depth
    let enabledSteps = getEnabledSteps(this.config.sop, this.config.auditDepth);

    // Apply depth-specific filters
    const depthConfig = this.config.sop.depths[this.config.auditDepth];

    // Skip compilation steps if configured
    if (depthConfig.skipCompilation) {
      enabledSteps = enabledSteps.filter((step) => {
        // Skip steps that involve compilation
        const compilationSteps = [
          'run-hardhat-compile',
          'run-forge-build',
          'parse-compilation',
          'generate-ast',
        ];
        return !compilationSteps.includes(step.id);
      });
      log.debug('Skipping compilation steps per depth configuration');
    }

    // Skip dependency installation if configured
    if (depthConfig.skipDependencyInstall) {
      enabledSteps = enabledSteps.filter((step) => {
        // Skip steps that install dependencies
        const dependencySteps = [
          'install-dependencies',
          'npm-install',
          'forge-install',
        ];
        return !dependencySteps.includes(step.id);
      });
      log.debug('Skipping dependency installation per depth configuration');
    }

    // ========================================================================
    // MODULE SYSTEM: Load and merge specialized audit modules
    // ========================================================================
    // This happens AFTER basic filtering but BEFORE execution order is built
    // Modules are activated based on detected contract patterns

    // Check if we should activate modules (only for deep scans)
    if (this.config.auditDepth === 'deep' || this.config.auditDepth === 'standard') {
      try {
        // Get applicable modules based on current context
        // Context will include detected contract patterns once pattern detection runs
        const moduleContext = {
          data: {
            contractPatterns: null, // Will be populated after pattern detection
            detectedFramework: null,
            projectPath: this.config.projectPath,
          },
        };

        // Get modules that might apply (we'll check again after pattern detection)
        const applicableModules = moduleRegistry.getApplicableModules(moduleContext);

        if (applicableModules.length > 0) {
          log.debug('Modules will be activated after pattern detection', {
            potentialModules: applicableModules.length,
          });

          // Store modules for later activation
          this.stepData.set('pendingModules', applicableModules);
        }
      } catch (error: any) {
        log.error('Failed to initialize module system', { error: error.message });
      }
    }

    this.enabledSteps = enabledSteps;

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

    // Load persisted stepData if available (for resume)
    await this.loadStepData();

    // Load existing step progress from database (for retry/resume)
    await this.loadExistingProgress();

    log.debug('Orchestrator initialized', {
      totalSteps: this.enabledSteps.length,
      layers: this.executionLayers.length,
      availableTools: this.availableTools,
      totalWeight: this.totalWeight,
      completedSteps: Array.from(this.stepStatus.entries()).filter(([_, status]) => status === 'completed').length,
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
    // Check if step is already completed (from resume)
    const currentStatus = this.stepStatus.get(step.id);
    if (currentStatus === 'completed') {
      log.info(`⏭️  Skipping completed step`, {
        stepId: step.id,
        stepName: step.name,
        reason: 'Already completed in previous run',
      });

      // Update progress tracking for skipped completed step
      const stepWeight = (step as any).weight || 1;
      this.completedWeight += stepWeight;

      // Step is already marked completed in DB from previous run
      // Just update in-memory progress tracking
      return;
    }

    // Check if dependencies are satisfied
    const dependenciesMet = this.checkDependencies(step);

    if (!dependenciesMet) {
      if (step.required) {
        throw new Error(
          `Required step ${step.id} cannot run: dependencies not met`
        );
      }

      // Record skip reason for test steps
      if (step.id.includes('test') || step.id.includes('Test')) {
        const missingData = step.requires?.filter((key) => !this.stepData.has(key)) || [];
        const skipReason = `Missing required data: ${missingData.join(', ')}`;
        this.stepData.set('testSkipReason', skipReason);

        log.debug('Test step skipped', {
          stepId: step.id,
          reason: skipReason,
          missingData,
        });
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
      const toolConfig = (step.executorConfig || (step as any).config) as any;
      const toolName = toolConfig?.tool;

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

    // Get timeout from depth config or step definition
    const depthConfig = this.config.sop.depths[this.config.auditDepth];
    const toolTimeouts = depthConfig.toolTimeouts || {};

    // Calculate step timeout: use timeoutSeconds if specified, otherwise estimated * 3, or default to 5 minutes
    const stepTimeout = (step as any).timeoutSeconds || step.estimatedDurationSeconds * 3 || 300;

    // Get tool-specific timeout from depth config
    const toolConfig = (step.executorConfig || (step as any).config) as any;
    const toolTimeout = toolTimeouts[toolConfig?.tool];

    // Use the maximum of tool timeout and step timeout (so steps can override short depth config timeouts)
    const timeout = toolTimeout
      ? Math.max(toolTimeout, stepTimeout) * 1000  // Both are in seconds, convert to ms
      : stepTimeout * 1000;

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

      // Persist stepData to filesystem for resume capability
      await this.persistStepData().catch((err) => {
        log.warn('Failed to persist step data', { error: err.message });
        // Don't fail the step if persistence fails
      });

      // ========================================================================
      // DYNAMIC MODULE ACTIVATION
      // ========================================================================
      // After contract pattern detection completes, activate specialized modules
      if (step.id === 'detect-contract-patterns' && result.data.contractPatterns) {
        await this.activateSpecializedModules(result.data.contractPatterns);
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
      // Log detailed error information with stdout/stderr
      const stepConfig = (step.executorConfig || (step as any).config) as any;
      const toolName = stepConfig?.tool;
      const toolResult = toolName ? result.data?.[`${toolName}Result`] : result.data;

      log.error('Step failed with details', {
        stepId: step.id,
        stepName: step.name,
        executor: step.executor,
        tool: toolName,
        error: result.error,
        exitCode: toolResult?.exitCode,
        stdout: toolResult?.stdout?.slice?.(0, 1000), // First 1000 chars
        stderr: toolResult?.stderr?.slice?.(0, 1000), // First 1000 chars
      });
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
   * Activate specialized audit modules based on detected contract patterns
   */
  private async activateSpecializedModules(contractPatterns: any): Promise<void> {
    try {
      log.debug('Activating specialized modules', {
        patterns: Object.keys(contractPatterns).filter(k => contractPatterns[k]),
      });

      // Build context with detected patterns
      const moduleContext = {
        data: {
          contractPatterns,
          detectedFramework: this.stepData.get('detectedFramework'),
          projectPath: this.config.projectPath,
        },
      };

      // Get applicable modules
      const applicableModules = moduleRegistry.getApplicableModules(moduleContext);

      if (applicableModules.length === 0) {
        log.debug('No specialized modules applicable for this project');
        return;
      }

      log.debug('Activating modules', {
        count: applicableModules.length,
        modules: applicableModules.map(m => m.id),
      });

      // Merge modules into current SOP
      const mergedSOP = moduleRegistry.mergeSOP(this.config.sop, applicableModules);

      // Update SOP and rebuild execution plan
      this.config.sop = mergedSOP;

      // Get enabled steps for current depth
      let enabledSteps = getEnabledSteps(mergedSOP, this.config.auditDepth);

      // Filter out already completed steps
      const completedStepIds = Array.from(this.stepStatus.entries())
        .filter(([, status]) => status === 'completed')
        .map(([id]) => id);

      enabledSteps = enabledSteps.filter(step => !completedStepIds.includes(step.id));

      // Update enabled steps
      this.enabledSteps = [...this.enabledSteps, ...enabledSteps.filter(s =>
        !this.enabledSteps.some(existing => existing.id === s.id)
      )];

      // Rebuild execution layers with new steps
      this.executionLayers = buildExecutionOrder(this.enabledSteps);

      // Recalculate total weight
      this.totalWeight = calculateTotalWeight(this.enabledSteps);

      // Initialize status for new steps
      for (const step of enabledSteps) {
        if (!this.stepStatus.has(step.id)) {
          this.stepStatus.set(step.id, 'pending');
        }
      }

      log.debug('Modules activated successfully', {
        newStepsAdded: enabledSteps.length,
        totalSteps: this.enabledSteps.length,
        totalLayers: this.executionLayers.length,
      });

      // Store activated modules info
      this.stepData.set('activatedModules', applicableModules.map(m => ({
        id: m.id,
        name: m.name,
        stepsAdded: m.additionalSteps.length,
      })));

    } catch (error: any) {
      log.error('Failed to activate specialized modules', {
        error: error.message,
        stack: error.stack,
      });
      // Don't fail the audit if module activation fails
    }
  }

  /**
   * Check if step dependencies are satisfied
   */
  private checkDependencies(step: StepDefinition): boolean {
    // Check if step dependencies have executed
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
              log.warn('Step dependency skipped but missing required data', {
                stepId: step.id,
                depId,
                missingData,
              });
              return false;
            }
          }
        } else {
          log.warn('Step dependency not met', {
            stepId: step.id,
            depId,
            depStatus: depStatus || 'undefined',
            availableStatuses: Array.from(this.stepStatus.entries()),
          });
          return false;
        }
      }
    }

    // Check if required data is available (even if no explicit dependencies)
    if (step.requires && step.requires.length > 0) {
      const missingData = step.requires.filter((key) => !this.stepData.has(key));
      if (missingData.length > 0) {
        log.warn('Step missing required data', {
          stepId: step.id,
          missingData,
          availableData: Array.from(this.stepData.keys()),
        });
        return false;
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
    log.debug('Cancellation requested', { jobId: this.config.jobId });
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

  // ==========================================================================
  // Step Data Persistence Methods (for Resume Capability)
  // ==========================================================================

  /**
   * Get the path to the stepData persistence file
   */
  private getStepDataPath(): string {
    const workspaceDir = this.config.projectPath;
    return path.join(workspaceDir, '.uatu', 'stepData.json');
  }

  /**
   * Get the path to save the Claude session ID
   */
  private getSessionIdPath(): string {
    const workspaceDir = this.config.projectPath;
    return path.join(workspaceDir, '.uatu', 'session.json');
  }

  /**
   * Persist stepData to filesystem for resume capability
   */
  private async persistStepData(): Promise<void> {
    const stepDataPath = this.getStepDataPath();

    // Convert Map to plain object for JSON serialization
    const dataToSave = Object.fromEntries(this.stepData);

    // Ensure .uatu directory exists
    await fs.ensureDir(path.dirname(stepDataPath));

    // Save to file with pretty printing for debugging
    await fs.writeJson(stepDataPath, {
      jobId: this.config.jobId,
      savedAt: new Date().toISOString(),
      stepData: dataToSave,
    }, { spaces: 2 });

    log.debug('Step data persisted', {
      jobId: this.config.jobId,
      dataKeys: Object.keys(dataToSave).length,
      path: stepDataPath,
    });
  }

  /**
   * Load persisted stepData from filesystem (for resume)
   */
  private async loadStepData(): Promise<void> {
    const stepDataPath = this.getStepDataPath();

    if (!(await fs.pathExists(stepDataPath))) {
      log.debug('No persisted step data found', { path: stepDataPath });
      return;
    }

    try {
      const saved = await fs.readJson(stepDataPath);

      // Validate it's for the same job (or allow resume from previous job)
      if (saved.stepData) {
        // Restore stepData Map from saved object
        for (const [key, value] of Object.entries(saved.stepData)) {
          this.stepData.set(key, value);
        }

        log.debug('Step data loaded from previous run', {
          jobId: this.config.jobId,
          previousJobId: saved.jobId,
          savedAt: saved.savedAt,
          dataKeys: Object.keys(saved.stepData).length,
        });
      }
    } catch (error: any) {
      log.warn('Failed to load persisted step data', {
        error: error.message,
        path: stepDataPath,
      });
      // Don't throw - continue with empty stepData
    }
  }

  /**
   * Load existing step progress from database (for retry/resume)
   */
  private async loadExistingProgress(): Promise<void> {
    try {
      const { db } = await import('../../db/index.js');
      const { auditStepProgress } = await import('../../db/schema.js');
      const { eq } = await import('drizzle-orm');

      // Load all step progress for this job
      const stepProgress = await db
        .select()
        .from(auditStepProgress)
        .where(eq(auditStepProgress.jobId, this.config.jobId));

      if (stepProgress.length === 0) {
        log.debug('🆕 No existing progress found - starting fresh');
        return;
      }

      log.info('🔄 Loading existing progress for resume', {
        jobId: this.config.jobId,
        totalRecords: stepProgress.length,
      });

      let completedCount = 0;
      let failedCount = 0;

      // Restore step status from database
      for (const step of stepProgress) {
        if (step.status === 'completed') {
          this.stepStatus.set(step.stepId, 'completed');
          completedCount++;

          // If step has results, restore them
          if (step.outputSummary) {
            this.stepResults.set(step.stepId, {
              success: true,
              findings: [],
              data: step.outputSummary as any,
            });
          }

          log.debug(`  ✅ ${step.stepId} - completed (will skip)`);
        } else if (step.status === 'failed') {
          failedCount++;
          log.debug(`  ❌ ${step.stepId} - failed (will retry)`);
        } else if (step.status === 'running') {
          log.debug(`  🔄 ${step.stepId} - was running (will retry)`);
        }
      }

      // CRITICAL: Restore existing findings from audit_results
      // This prevents data loss when retrying - we preserve findings from completed steps
      const { auditResults } = await import('../../db/schema.js');
      const [existingResults] = await db
        .select()
        .from(auditResults)
        .where(eq(auditResults.jobId, this.config.jobId))
        .limit(1);

      if (existingResults && existingResults.findings) {
        const restoredFindings = existingResults.findings as any[];
        if (Array.isArray(restoredFindings) && restoredFindings.length > 0) {
          this.allFindings.push(...restoredFindings);
          log.info('✅ Restored existing findings from previous run', {
            findingsCount: restoredFindings.length,
            reason: 'Preserving findings from completed steps on retry',
          });
        }
      }

      log.info('✅ Existing progress loaded', {
        completed: completedCount,
        failed: failedCount,
        restoredFindings: this.allFindings.length,
        willResume: true,
      });

    } catch (error: any) {
      log.warn('⚠️  Failed to load existing progress - starting fresh', {
        error: error.message,
      });
      // Don't throw - continue with empty progress
    }
  }

  /**
   * Save Claude session ID for resume
   */
  async saveSessionId(sessionId: string): Promise<void> {
    const sessionPath = this.getSessionIdPath();

    await fs.ensureDir(path.dirname(sessionPath));
    await fs.writeJson(sessionPath, {
      sessionId,
      jobId: this.config.jobId,
      savedAt: new Date().toISOString(),
    }, { spaces: 2 });

    log.debug('Claude session ID saved', { sessionId, jobId: this.config.jobId });
  }

  /**
   * Load saved Claude session ID
   */
  async loadSessionId(): Promise<string | null> {
    const sessionPath = this.getSessionIdPath();

    if (!(await fs.pathExists(sessionPath))) {
      return null;
    }

    try {
      const saved = await fs.readJson(sessionPath);
      log.debug('Claude session ID loaded', {
        sessionId: saved.sessionId,
        previousJobId: saved.jobId,
        savedAt: saved.savedAt,
      });
      return saved.sessionId;
    } catch (error: any) {
      log.warn('Failed to load session ID', { error: error.message });
      return null;
    }
  }
}
