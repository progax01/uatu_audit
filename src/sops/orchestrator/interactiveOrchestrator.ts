/**
 * Interactive SOP Orchestrator
 *
 * Executes SOP steps with support for:
 * - Pausing execution for user input
 * - Auto-continue with defaults after timeout
 * - Finding enrichment based on user context
 * - Real-time progress updates via EventEmitter
 */

import { EventEmitter } from 'events';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  auditSessions,
  auditPrompts,
  auditUserAnswers,
  auditKnownAddresses,
  auditFindings,
  auditLinkedProjects,
  notifications,
  auditJobs,
} from '../../db/schema.js';
import type {
  AuditSession,
  AuditPrompt,
  AuditKnownAddress,
  AuditLinkedProject,
  NewAuditPrompt,
  NewAuditUserAnswer,
  NewAuditKnownAddress,
  NewAuditFinding,
  NewNotification,
  SessionStatus,
  PromptStatus,
  AddressType,
} from '../../db/schema.js';
import type {
  SOPDefinition,
  StepDefinition,
  StepContext,
  StepResult,
  StepFinding,
  AuditDepth,
} from '../definitions/types.js';
import {
  PROMPT_TEMPLATES,
  getPromptTemplate,
  renderPromptQuestion,
  getSeverityImpactForAnswer,
  getFollowUpTemplates,
  adjustSeverity,
  answerToAddressType,
} from '../../services/promptTemplates.js';
// Email notifications commented out - using Telegram instead
// import {
//   notifyPromptWaiting,
//   notifyAuditCompleted,
//   notifyCriticalFinding,
//   isEmailEnabled,
// } from '../../services/emailNotificationService.js';
import {
  sendTelegramNotification,
  isTelegramEnabled,
} from '../../services/telegramNotificationService.js';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'interactive-orchestrator' });

// ============================================================================
// Types
// ============================================================================

export interface InteractiveSessionConfig {
  jobId: string;
  userId: string;
  interactiveMode: boolean;
  autoContinueTimeoutSeconds: number;
  notificationEmail?: string;
  notifyOnCompletion: boolean;
  notifyOnInputNeeded: boolean;
  notifyOnCriticalFinding: boolean;
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
}

export interface OrchestratorEvents {
  'step_start': { stepId: string; stepName: string };
  'step_progress': { stepId: string; percent: number; message: string };
  'step_complete': { stepId: string; result: StepResult };
  'step_failed': { stepId: string; error: string };
  'prompt_required': { prompt: AuditPrompt; template: any; timeoutAt: Date };
  'prompt_answered': { promptId: string; answer: any };
  'prompt_timeout': { promptId: string };
  'session_paused': { promptId: string; reason: string };
  'session_resumed': { promptId: string };
  'finding_enriched': { findingId: string; adjustment: any };
  'audit_complete': { sessionId: string };
  'audit_failed': { sessionId: string; error: string };
}

interface PendingPromptState {
  prompt: AuditPrompt;
  timeoutId: NodeJS.Timeout;
  resolver: () => void;
}

// ============================================================================
// Interactive Orchestrator
// ============================================================================

export class InteractiveOrchestrator extends EventEmitter {
  private sessionId: string | null = null;
  private session: AuditSession | null = null;
  private config: InteractiveSessionConfig;

  // Execution state
  private isPaused: boolean = false;
  private pendingPrompt: PendingPromptState | null = null;

  // Context caches
  private knownAddressesCache: Map<string, AuditKnownAddress> = new Map();
  private userAnswersCache: Map<string, any> = new Map();

  constructor(config: InteractiveSessionConfig) {
    super();
    this.config = config;
  }

  // ==========================================================================
  // Session Management
  // ==========================================================================

  /**
   * Initialize the interactive session
   */
  async initializeSession(): Promise<string> {
    log.info('Initializing interactive session', { jobId: this.config.jobId });

    // Create session record
    const [session] = await db
      .insert(auditSessions)
      .values({
        jobId: this.config.jobId,
        userId: this.config.userId,
        interactiveMode: this.config.interactiveMode,
        autoContinueTimeoutSeconds: this.config.autoContinueTimeoutSeconds,
        notificationEmail: this.config.notificationEmail,
        notifyOnCompletion: this.config.notifyOnCompletion,
        notifyOnInputNeeded: this.config.notifyOnInputNeeded,
        notifyOnCriticalFinding: this.config.notifyOnCriticalFinding,
        status: 'running',
      })
      .returning();

    this.sessionId = session.id;
    this.session = session;

    // Store linked projects if provided
    if (this.config.linkedProjects?.length) {
      for (const lp of this.config.linkedProjects) {
        await db.insert(auditLinkedProjects).values({
          sessionId: session.id,
          name: lp.name,
          sourceType: lp.sourceType,
          sourceConfig: lp.sourceConfig,
          relationship: lp.relationship as any,
          relevantContracts: lp.relevantContracts,
          addedBy: 'user',
        });
      }
    }

    // Store known addresses if provided
    if (this.config.knownAddresses?.length) {
      for (const addr of this.config.knownAddresses) {
        const [inserted] = await db
          .insert(auditKnownAddresses)
          .values({
            sessionId: session.id,
            address: addr.address,
            chain: addr.chain,
            label: addr.label,
            addressType: addr.addressType,
            metadata: addr.metadata || {},
            source: 'user',
          })
          .returning();

        this.knownAddressesCache.set(addr.address.toLowerCase(), inserted);
      }
    }

    log.info('Session initialized', { sessionId: session.id });
    return session.id;
  }

  /**
   * Get current session state
   */
  async getSessionState(): Promise<{
    sessionId: string;
    status: SessionStatus;
    currentPrompt: AuditPrompt | null;
    linkedProjects: AuditLinkedProject[];
    knownAddresses: AuditKnownAddress[];
  } | null> {
    if (!this.sessionId) return null;

    const [session] = await db
      .select()
      .from(auditSessions)
      .where(eq(auditSessions.id, this.sessionId));

    if (!session) return null;

    // Get current prompt if paused
    let currentPrompt: AuditPrompt | null = null;
    if (session.currentPromptId) {
      const [prompt] = await db
        .select()
        .from(auditPrompts)
        .where(eq(auditPrompts.id, session.currentPromptId));
      currentPrompt = prompt || null;
    }

    // Get linked projects
    const linkedProjects = await db
      .select()
      .from(auditLinkedProjects)
      .where(eq(auditLinkedProjects.sessionId, this.sessionId));

    // Get known addresses
    const knownAddresses = await db
      .select()
      .from(auditKnownAddresses)
      .where(eq(auditKnownAddresses.sessionId, this.sessionId));

    return {
      sessionId: this.sessionId,
      status: session.status,
      currentPrompt,
      linkedProjects,
      knownAddresses,
    };
  }

  /**
   * Update session status
   */
  private async updateSessionStatus(
    status: SessionStatus,
    currentPromptId?: string,
    pausedAtStep?: string
  ): Promise<void> {
    if (!this.sessionId) return;

    await db
      .update(auditSessions)
      .set({
        status,
        currentPromptId: currentPromptId || null,
        pausedAtStep: pausedAtStep || null,
        pausedAt: status === 'paused_for_input' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(auditSessions.id, this.sessionId));
  }

  // ==========================================================================
  // Step Execution with Prompts
  // ==========================================================================

  /**
   * Execute a step with interactive prompt support
   */
  async executeStep(
    step: StepDefinition,
    context: StepContext,
    stepExecutor: (step: StepDefinition, ctx: StepContext) => Promise<StepResult>
  ): Promise<StepResult> {
    this.emit('step_start', { stepId: step.id, stepName: step.name });

    try {
      // Run the actual step
      const result = await stepExecutor(step, context);

      // Process findings if any
      if (result.findings && result.findings.length > 0) {
        result.findings = await this.processFindings(result.findings, step);
      }

      this.emit('step_complete', { stepId: step.id, result });
      return result;
    } catch (error: any) {
      this.emit('step_failed', { stepId: step.id, error: error.message });
      throw error;
    }
  }

  /**
   * Process findings - check for addresses needing context and enrich
   */
  private async processFindings(
    findings: StepFinding[],
    step: StepDefinition
  ): Promise<StepFinding[]> {
    const processedFindings: StepFinding[] = [];

    for (const finding of findings) {
      // Extract addresses from finding
      const addresses = this.extractAddresses(finding);

      // Check if any addresses need user context
      for (const address of addresses) {
        const normalizedAddr = address.toLowerCase();

        // Skip if we already have context
        if (this.knownAddressesCache.has(normalizedAddr)) {
          continue;
        }

        // Skip if we already asked about this address
        if (this.userAnswersCache.has(`address:${normalizedAddr}`)) {
          continue;
        }

        // Check if this looks like an admin address finding
        if (this.isAdminRelatedFinding(finding)) {
          // Create and handle prompt for this address
          if (this.config.interactiveMode) {
            await this.handleAddressPrompt(address, finding, step);
          }
        }
      }

      // Enrich finding with any context we have
      const enrichedFinding = await this.enrichFinding(finding);
      processedFindings.push(enrichedFinding);

      // Store normalized finding
      if (this.sessionId) {
        await this.storeFinding(enrichedFinding);
      }
    }

    return processedFindings;
  }

  /**
   * Handle prompt for an unknown address
   */
  private async handleAddressPrompt(
    address: string,
    finding: StepFinding,
    step: StepDefinition
  ): Promise<void> {
    const template = getPromptTemplate('admin_address_type');
    if (!template) return;

    // Create prompt
    const variables = {
      address,
      functions: finding.title,
    };

    const prompt = await this.createPrompt(
      step.id,
      step.name,
      'admin_address_type',
      template.type,
      renderPromptQuestion(template, variables),
      variables,
      {
        code: finding.description,
        file: finding.location?.file,
        line: finding.location?.line,
        findingId: finding.findingId,
      },
      template.options,
      template.defaultValue,
      template.timeoutSeconds
    );

    // Wait for answer
    await this.waitForPromptAnswer(prompt);

    // Process follow-up prompts if any
    const answer = this.userAnswersCache.get(`prompt:${prompt.id}`);
    if (answer) {
      const followUps = getFollowUpTemplates(template, answer);
      for (const followUpId of followUps) {
        await this.handleFollowUpPrompt(followUpId, address, finding, step, answer);
      }
    }
  }

  /**
   * Handle follow-up prompt
   */
  private async handleFollowUpPrompt(
    templateId: string,
    address: string,
    finding: StepFinding,
    step: StepDefinition,
    previousAnswer: any
  ): Promise<void> {
    const template = getPromptTemplate(templateId);
    if (!template) return;

    const variables = { address };

    const prompt = await this.createPrompt(
      step.id,
      step.name,
      templateId,
      template.type,
      renderPromptQuestion(template, variables),
      variables,
      { previousAnswer },
      template.options,
      template.defaultValue,
      template.timeoutSeconds
    );

    await this.waitForPromptAnswer(prompt);
  }

  /**
   * Create a prompt record
   */
  private async createPrompt(
    stepId: string,
    stepName: string,
    templateId: string,
    promptType: any,
    question: string,
    variables: Record<string, any>,
    context: Record<string, any>,
    options: any,
    defaultValue: any,
    timeoutSeconds: number
  ): Promise<AuditPrompt> {
    if (!this.sessionId) {
      throw new Error('Session not initialized');
    }

    const [prompt] = await db
      .insert(auditPrompts)
      .values({
        sessionId: this.sessionId,
        stepId,
        stepName,
        templateId,
        promptType,
        question,
        variables,
        context,
        options,
        defaultValue,
        timeoutSeconds,
        status: 'pending',
      })
      .returning();

    return prompt;
  }

  /**
   * Wait for user to answer a prompt (or timeout)
   */
  private async waitForPromptAnswer(prompt: AuditPrompt): Promise<void> {
    // Update session to paused state
    await this.updateSessionStatus('paused_for_input', prompt.id, prompt.stepId);
    this.isPaused = true;

    // Emit event for UI
    const template = getPromptTemplate(prompt.templateId || '');
    const timeoutAt = new Date(Date.now() + (prompt.timeoutSeconds || 300) * 1000);

    this.emit('prompt_required', { prompt, template, timeoutAt });
    this.emit('session_paused', { promptId: prompt.id, reason: 'Waiting for user input' });

    // Send notification if configured
    if (this.config.notifyOnInputNeeded) {
      await this.sendNotification('input_needed', 'Input needed for audit', prompt.question, {
        promptId: prompt.id,
        question: prompt.question,
        timeoutSeconds: prompt.timeoutSeconds || 300,
        stepName: prompt.stepName || undefined,
      });
    }

    // Wait for answer or timeout
    await new Promise<void>((resolve) => {
      const timeoutMs = (prompt.timeoutSeconds || 300) * 1000;

      const timeoutId = setTimeout(async () => {
        // Timeout - use default value
        log.info('Prompt timed out, using default', { promptId: prompt.id });

        await this.handlePromptTimeout(prompt);
        resolve();
      }, timeoutMs);

      this.pendingPrompt = {
        prompt,
        timeoutId,
        resolver: resolve,
      };
    });

    // Resume session
    this.isPaused = false;
    this.pendingPrompt = null;
    await this.updateSessionStatus('running');
    this.emit('session_resumed', { promptId: prompt.id });
  }

  /**
   * Handle prompt timeout - use default value
   */
  private async handlePromptTimeout(prompt: AuditPrompt): Promise<void> {
    // Update prompt status
    await db
      .update(auditPrompts)
      .set({
        status: 'timed_out',
        timedOutAt: new Date(),
      })
      .where(eq(auditPrompts.id, prompt.id));

    // Store default answer
    const template = getPromptTemplate(prompt.templateId || '');
    const defaultValue = prompt.defaultValue || template?.defaultValue;

    if (defaultValue !== undefined) {
      await this.storeAnswer(prompt, defaultValue, 'auto_timeout');
    }

    this.emit('prompt_timeout', { promptId: prompt.id });
  }

  /**
   * Submit an answer to a prompt (called externally)
   */
  async submitAnswer(promptId: string, answer: any, applyToSimilar: boolean = true): Promise<void> {
    // Find the prompt
    const [prompt] = await db
      .select()
      .from(auditPrompts)
      .where(eq(auditPrompts.id, promptId));

    if (!prompt) {
      throw new Error('Prompt not found');
    }

    if (prompt.status !== 'pending') {
      throw new Error('Prompt already answered or timed out');
    }

    log.info('Answer submitted', { promptId, answer });

    // Store the answer
    await this.storeAnswer(prompt, answer, 'user', applyToSimilar);

    // Update prompt status
    await db
      .update(auditPrompts)
      .set({
        status: 'answered',
        answeredAt: new Date(),
      })
      .where(eq(auditPrompts.id, promptId));

    // Resume execution if this is the pending prompt
    if (this.pendingPrompt?.prompt.id === promptId) {
      clearTimeout(this.pendingPrompt.timeoutId);
      this.pendingPrompt.resolver();
    }

    this.emit('prompt_answered', { promptId, answer });
  }

  /**
   * Skip a prompt (use default)
   */
  async skipPrompt(promptId: string): Promise<void> {
    const [prompt] = await db
      .select()
      .from(auditPrompts)
      .where(eq(auditPrompts.id, promptId));

    if (!prompt || prompt.status !== 'pending') {
      throw new Error('Prompt not found or already handled');
    }

    await db
      .update(auditPrompts)
      .set({
        status: 'skipped',
        answeredAt: new Date(),
      })
      .where(eq(auditPrompts.id, promptId));

    // Store default answer
    const template = getPromptTemplate(prompt.templateId || '');
    const defaultValue = prompt.defaultValue || template?.defaultValue;

    if (defaultValue !== undefined) {
      await this.storeAnswer(prompt, defaultValue, 'skip');
    }

    // Resume execution
    if (this.pendingPrompt?.prompt.id === promptId) {
      clearTimeout(this.pendingPrompt.timeoutId);
      this.pendingPrompt.resolver();
    }
  }

  /**
   * Store an answer and update caches
   */
  private async storeAnswer(
    prompt: AuditPrompt,
    answer: any,
    answeredBy: string,
    applyToSimilar: boolean = true
  ): Promise<void> {
    if (!this.sessionId) return;

    // Store in database
    await db.insert(auditUserAnswers).values({
      sessionId: this.sessionId,
      promptId: prompt.id,
      answer,
      applyToSimilar,
      answeredBy,
    });

    // Update cache
    this.userAnswersCache.set(`prompt:${prompt.id}`, answer);

    // If this is an address type question, store the known address
    if (prompt.templateId === 'admin_address_type') {
      const address = (prompt.variables as any)?.address;
      if (address) {
        const addressType = answerToAddressType(answer?.value || answer);

        const [knownAddr] = await db
          .insert(auditKnownAddresses)
          .values({
            sessionId: this.sessionId,
            address,
            chain: 'ethereum', // TODO: detect from context
            label: this.getLabelForAddressType(addressType),
            addressType,
            metadata: answer?.metadata || {},
            source: answeredBy === 'user' ? 'user' : 'ai_detected',
          })
          .returning();

        this.knownAddressesCache.set(address.toLowerCase(), knownAddr);
        this.userAnswersCache.set(`address:${address.toLowerCase()}`, answer);
      }
    }

    // Store multisig details if provided
    if (prompt.templateId === 'multisig_details') {
      const address = (prompt.context as any)?.previousAnswer?.address ||
                      (prompt.variables as any)?.address;
      if (address && this.knownAddressesCache.has(address.toLowerCase())) {
        const existing = this.knownAddressesCache.get(address.toLowerCase())!;
        await db
          .update(auditKnownAddresses)
          .set({
            metadata: {
              ...(existing.metadata as any || {}),
              threshold: answer.threshold,
              totalSigners: answer.total_signers,
              walletType: answer.wallet_type,
              signerDiversity: answer.signer_diversity,
            },
          })
          .where(eq(auditKnownAddresses.id, existing.id));
      }
    }
  }

  // ==========================================================================
  // Finding Enrichment
  // ==========================================================================

  /**
   * Enrich a finding with user-provided context
   */
  private async enrichFinding(finding: StepFinding): Promise<StepFinding> {
    const enriched = { ...finding } as any;

    // Check if any related addresses have context
    const addresses = this.extractAddresses(finding);

    for (const address of addresses) {
      const knownAddr = this.knownAddressesCache.get(address.toLowerCase());

      if (knownAddr) {
        // Add user context to finding
        enriched.userContext = {
          addressType: knownAddr.addressType,
          addressLabel: knownAddr.label,
          metadata: knownAddr.metadata,
        };

        // Calculate severity adjustment
        const template = getPromptTemplate('admin_address_type');
        if (template) {
          const impact = getSeverityImpactForAnswer(template, knownAddr.addressType);
          const { newSeverity, reason } = adjustSeverity(finding.severity, impact);

          if (newSeverity !== null && newSeverity !== finding.severity) {
            enriched.originalSeverity = finding.severity;
            enriched.severity = newSeverity as any;
            enriched.severityAdjustmentReason = reason +
              ` (address ${address.slice(0, 8)}... is ${knownAddr.label})`;

            this.emit('finding_enriched', {
              findingId: finding.findingId,
              adjustment: { from: finding.severity, to: newSeverity, reason },
            });
          }
        }

        // Apply multisig details if available
        const metadata = knownAddr.metadata as any;
        if (metadata?.threshold && metadata?.totalSigners) {
          const multisigTemplate = getPromptTemplate('multisig_details');
          if (multisigTemplate?.severityRules?.calculate) {
            const impact = multisigTemplate.severityRules.calculate(metadata);
            const { newSeverity, reason } = adjustSeverity(
              enriched.severity || finding.severity,
              impact
            );

            if (newSeverity !== null && newSeverity !== enriched.severity) {
              enriched.originalSeverity = enriched.originalSeverity || finding.severity;
              enriched.severity = newSeverity as any;
              enriched.severityAdjustmentReason =
                (enriched.severityAdjustmentReason ? enriched.severityAdjustmentReason + '; ' : '') +
                `${metadata.threshold}/${metadata.totalSigners} multisig`;
            }
          }
        }

        break; // Only apply context from first matching address
      }
    }

    return enriched;
  }

  /**
   * Store a normalized finding in the database
   */
  private async storeFinding(finding: StepFinding): Promise<void> {
    if (!this.sessionId) return;

    const enriched = finding as any;
    const effectiveSeverity = enriched.severity || finding.severity;

    await db.insert(auditFindings).values({
      jobId: this.config.jobId,
      sessionId: this.sessionId,
      findingId: finding.findingId,
      tool: finding.tool,
      stepId: finding.stepId,
      title: finding.title,
      description: finding.description,
      recommendation: finding.recommendation,
      originalSeverity: enriched.originalSeverity || finding.severity,
      adjustedSeverity: enriched.severity !== enriched.originalSeverity ? enriched.severity : null,
      severityAdjustmentReason: enriched.severityAdjustmentReason,
      filePath: finding.location?.file,
      lineStart: finding.location?.line,
      relatedAddresses: this.extractAddresses(finding),
      userContext: enriched.userContext || {},
      status: 'new',
    });

    // Send critical finding notification if configured
    if (this.config.notifyOnCriticalFinding && (effectiveSeverity === 'critical' || effectiveSeverity === 'high')) {
      await this.sendNotification(
        'critical_finding',
        `${effectiveSeverity.charAt(0).toUpperCase() + effectiveSeverity.slice(1)} Severity Finding`,
        finding.description,
        {
          findingId: finding.findingId,
          findingTitle: finding.title,
          findingSeverity: effectiveSeverity.charAt(0).toUpperCase() + effectiveSeverity.slice(1),
          findingDescription: finding.description,
          affectedContract: finding.location?.file,
          affectedFunction: (finding.location as any)?.function,
        }
      );
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Extract Ethereum addresses from a finding
   */
  private extractAddresses(finding: StepFinding): string[] {
    const addresses: string[] = [];
    const addressRegex = /0x[a-fA-F0-9]{40}/g;

    // Check title, description, and recommendation
    const text = `${finding.title} ${finding.description} ${finding.recommendation || ''}`;
    const matches = text.match(addressRegex);

    if (matches) {
      addresses.push(...matches);
    }

    // Check explicit related addresses
    if ((finding as any).relatedAddresses) {
      addresses.push(...(finding as any).relatedAddresses);
    }

    return [...new Set(addresses)]; // Dedupe
  }

  /**
   * Check if a finding is related to admin/access control
   */
  private isAdminRelatedFinding(finding: StepFinding): boolean {
    const keywords = [
      'admin',
      'owner',
      'privileged',
      'centralized',
      'centralization',
      'access control',
      'onlyowner',
      'onlyadmin',
      'auth',
      'permission',
      'role',
    ];

    const text = `${finding.title} ${finding.description}`.toLowerCase();

    return keywords.some((kw) => text.includes(kw));
  }

  /**
   * Get human-readable label for address type
   */
  private getLabelForAddressType(type: AddressType): string {
    const labels: Record<AddressType, string> = {
      eoa: 'EOA (Single Key)',
      multisig: 'Multisig Wallet',
      timelock: 'Timelock Contract',
      governance: 'Governance Contract',
      treasury: 'Treasury',
      oracle: 'Oracle',
      protocol: 'Protocol Contract',
      renounced: 'Renounced',
      unknown: 'Unknown',
    };

    return labels[type] || type;
  }

  /**
   * Send a notification (in-app + Telegram)
   */
  private async sendNotification(
    type: 'input_needed' | 'audit_complete' | 'critical_finding',
    title: string,
    message: string,
    refs: { promptId?: string; findingId?: string; question?: string; timeoutSeconds?: number; stepName?: string; findingTitle?: string; findingSeverity?: string; findingDescription?: string; affectedContract?: string; affectedFunction?: string } = {}
  ): Promise<void> {
    if (!this.sessionId) return;

    // Store in-app notification
    await db.insert(notifications).values({
      userId: this.config.userId,
      type,
      title,
      message,
      jobId: this.config.jobId,
      sessionId: this.sessionId,
      promptId: refs.promptId,
      findingId: refs.findingId,
      channels: ['in_app', 'telegram'],
    });

    // Send Telegram notification if configured
    if (isTelegramEnabled()) {
      const baseUrl = process.env.PUBLIC_URL || 'http://localhost:9090';
      const auditUrl = `${baseUrl}/audit/${this.config.jobId}`;

      try {
        await sendTelegramNotification(type, title, message, {
          jobId: this.config.jobId,
          auditUrl,
          reportUrl: type === 'audit_complete' ? `${baseUrl}/report/${this.config.jobId}` : undefined,
          promptId: refs.promptId,
          question: refs.question,
          timeoutSeconds: refs.timeoutSeconds,
          stepName: refs.stepName,
          findingTitle: refs.findingTitle,
          findingSeverity: refs.findingSeverity,
          findingDescription: refs.findingDescription,
          affectedContract: refs.affectedContract,
          affectedFunction: refs.affectedFunction,
          status: type === 'audit_complete' ? 'completed' : undefined,
        });
      } catch (err) {
        log.error('Failed to send Telegram notification', {
          type,
          error: err instanceof Error ? err.message : String(err),
        });
        // Don't throw - notification failure shouldn't stop the audit
      }
    }

    // Email notifications commented out - uncomment to enable
    // if (this.config.notificationEmail && isEmailEnabled()) {
    //   const baseUrl = process.env.PUBLIC_URL || 'http://localhost:9090';
    //   const auditUrl = `${baseUrl}/audit/${this.config.jobId}`;
    //   try {
    //     if (type === 'input_needed' && refs.promptId && refs.question) {
    //       await notifyPromptWaiting({
    //         jobId: this.config.jobId,
    //         recipientEmail: this.config.notificationEmail,
    //         promptId: refs.promptId,
    //         question: refs.question,
    //         timeoutSeconds: refs.timeoutSeconds || 300,
    //         stepName: refs.stepName,
    //         auditUrl,
    //       });
    //     } else if (type === 'audit_complete') {
    //       await notifyAuditCompleted({
    //         jobId: this.config.jobId,
    //         recipientEmail: this.config.notificationEmail,
    //         status: 'completed',
    //         auditUrl,
    //         reportUrl: `${baseUrl}/report/${this.config.jobId}`,
    //       });
    //     } else if (type === 'critical_finding' && refs.findingTitle) {
    //       await notifyCriticalFinding({
    //         jobId: this.config.jobId,
    //         recipientEmail: this.config.notificationEmail,
    //         findingTitle: refs.findingTitle,
    //         findingSeverity: refs.findingSeverity || 'Critical',
    //         findingDescription: refs.findingDescription || message,
    //         affectedContract: refs.affectedContract,
    //         affectedFunction: refs.affectedFunction,
    //         auditUrl,
    //       });
    //     }
    //   } catch (err) {
    //     log.error('Failed to send email notification', {
    //       type,
    //       error: err instanceof Error ? err.message : String(err),
    //     });
    //   }
    // }
  }

  /**
   * Complete the session
   */
  async completeSession(success: boolean, error?: string): Promise<void> {
    if (!this.sessionId) return;

    const status: SessionStatus = success ? 'completed' : 'failed';

    await this.updateSessionStatus(status);

    if (success && this.config.notifyOnCompletion) {
      await this.sendNotification(
        'audit_complete',
        'Audit Complete',
        'Your audit has finished. View the results now.'
      );
    }

    if (!success) {
      this.emit('audit_failed', { sessionId: this.sessionId, error: error || 'Unknown error' });
    } else {
      this.emit('audit_complete', { sessionId: this.sessionId });
    }
  }

  /**
   * Check if session is currently paused
   */
  get paused(): boolean {
    return this.isPaused;
  }

  /**
   * Get session ID
   */
  get currentSessionId(): string | null {
    return this.sessionId;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createInteractiveOrchestrator(
  config: InteractiveSessionConfig
): InteractiveOrchestrator {
  return new InteractiveOrchestrator(config);
}
