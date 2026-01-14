/**
 * AI Conversation Service
 *
 * Manages AI conversation tracking, context persistence, and session resumption.
 * This enables audits to resume AI conversations from where they left off.
 */

import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  auditSessions,
  aiConversationHistory,
  aiContextSnapshots,
} from '../db/schema.js';
import type {
  AIConversationRole,
  AIConversationHistory,
  AIContextSnapshot,
} from '../db/schema.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'ai-conversation-service' });

// ============================================================================
// Types
// ============================================================================

export interface ConversationTurn {
  role: AIConversationRole;
  content: string;
  contentSummary?: string;
  stepId?: string;
  stepName?: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolOutput?: Record<string, any>;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  modelUsed?: string;
  metadata?: Record<string, any>;
  durationMs?: number;
}

export interface ConversationContext {
  conversationId: string;
  sessionId: string;
  jobId: string;
  summary: string;
  keyFindings: string[];
  keyDecisions: string[];
  pendingQuestions: string[];
  stepsCompleted: string[];
  findingsCount: number;
  tokensUsed: number;
  resumptionPrompt?: string;
}

export interface ConversationSummary {
  totalTurns: number;
  totalTokens: number;
  modelUsed: string;
  startedAt: Date | null;
  lastUsedAt: Date | null;
  stepsAnalyzed: string[];
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Start a new AI conversation for an audit session
 */
export async function startConversation(
  sessionId: string,
  jobId: string,
  modelUsed: string = 'claude-3-sonnet'
): Promise<string> {
  const conversationId = `conv_${uuidv4()}`;

  await db
    .update(auditSessions)
    .set({
      aiConversationId: conversationId,
      aiModelUsed: modelUsed,
      aiConversationStartedAt: new Date(),
      aiConversationLastUsedAt: new Date(),
      aiTotalTurns: 0,
      aiTotalTokensUsed: 0,
      updatedAt: new Date(),
    })
    .where(eq(auditSessions.id, sessionId));

  log.info('Started new AI conversation', { conversationId, sessionId, jobId });

  return conversationId;
}

/**
 * Get the active conversation ID for a session, or start a new one
 */
export async function getOrCreateConversation(
  sessionId: string,
  jobId: string,
  modelUsed?: string
): Promise<string> {
  const [session] = await db
    .select()
    .from(auditSessions)
    .where(eq(auditSessions.id, sessionId));

  if (session?.aiConversationId) {
    // Update last used timestamp
    await db
      .update(auditSessions)
      .set({
        aiConversationLastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(auditSessions.id, sessionId));

    return session.aiConversationId;
  }

  return startConversation(sessionId, jobId, modelUsed);
}

/**
 * Log a conversation turn (message)
 */
export async function logConversationTurn(
  sessionId: string,
  jobId: string,
  conversationId: string,
  turn: ConversationTurn
): Promise<void> {
  // Get current turn count
  const [session] = await db
    .select()
    .from(auditSessions)
    .where(eq(auditSessions.id, sessionId));

  const turnIndex = (session?.aiTotalTurns || 0) + 1;

  // Insert the turn
  await db.insert(aiConversationHistory).values({
    sessionId,
    jobId,
    conversationId,
    turnIndex,
    role: turn.role,
    content: turn.content,
    contentSummary: turn.contentSummary,
    stepId: turn.stepId,
    stepName: turn.stepName,
    toolName: turn.toolName,
    toolInput: turn.toolInput,
    toolOutput: turn.toolOutput,
    inputTokens: turn.inputTokens,
    outputTokens: turn.outputTokens,
    totalTokens: turn.totalTokens,
    modelUsed: turn.modelUsed || session?.aiModelUsed,
    metadata: turn.metadata || {},
    durationMs: turn.durationMs,
    startedAt: new Date(Date.now() - (turn.durationMs || 0)),
    completedAt: new Date(),
  });

  // Update session counters
  const newTokens = (session?.aiTotalTokensUsed || 0) + (turn.totalTokens || 0);

  await db
    .update(auditSessions)
    .set({
      aiTotalTurns: turnIndex,
      aiTotalTokensUsed: newTokens,
      aiConversationLastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(auditSessions.id, sessionId));

  log.debug('Logged conversation turn', {
    conversationId,
    turnIndex,
    role: turn.role,
    tokens: turn.totalTokens,
  });
}

/**
 * Create a context snapshot for potential conversation resumption
 */
export async function createContextSnapshot(
  sessionId: string,
  conversationId: string,
  snapshotType: 'checkpoint' | 'step_complete' | 'pause' | 'error',
  options: {
    stepId?: string;
    contextSummary: string;
    keyFindings?: string[];
    keyDecisions?: string[];
    pendingQuestions?: string[];
    stepsCompleted?: string[];
    findingsCount?: number;
    tokensUsed?: number;
    resumptionPrompt?: string;
  }
): Promise<string> {
  const [snapshot] = await db
    .insert(aiContextSnapshots)
    .values({
      sessionId,
      snapshotType,
      stepId: options.stepId,
      conversationId,
      contextSummary: options.contextSummary,
      keyFindings: options.keyFindings || [],
      keyDecisions: options.keyDecisions || [],
      pendingQuestions: options.pendingQuestions || [],
      stepsCompleted: options.stepsCompleted || [],
      findingsCount: options.findingsCount || 0,
      tokensUsed: options.tokensUsed || 0,
      resumable: true,
      resumptionPrompt: options.resumptionPrompt,
    })
    .returning();

  log.info('Created context snapshot', {
    snapshotId: snapshot.id,
    conversationId,
    snapshotType,
  });

  return snapshot.id;
}

/**
 * Get the latest context snapshot for resuming a conversation
 */
export async function getLatestSnapshot(
  sessionId: string
): Promise<AIContextSnapshot | null> {
  const [snapshot] = await db
    .select()
    .from(aiContextSnapshots)
    .where(
      and(
        eq(aiContextSnapshots.sessionId, sessionId),
        eq(aiContextSnapshots.resumable, true)
      )
    )
    .orderBy(desc(aiContextSnapshots.createdAt))
    .limit(1);

  return snapshot || null;
}

/**
 * Get conversation history for a session
 */
export async function getConversationHistory(
  sessionId: string,
  options?: {
    limit?: number;
    offset?: number;
    stepId?: string;
  }
): Promise<AIConversationHistory[]> {
  let query = db
    .select()
    .from(aiConversationHistory)
    .where(eq(aiConversationHistory.sessionId, sessionId))
    .orderBy(asc(aiConversationHistory.turnIndex));

  if (options?.stepId) {
    query = db
      .select()
      .from(aiConversationHistory)
      .where(
        and(
          eq(aiConversationHistory.sessionId, sessionId),
          eq(aiConversationHistory.stepId, options.stepId)
        )
      )
      .orderBy(asc(aiConversationHistory.turnIndex));
  }

  const history = await query;

  if (options?.offset) {
    return history.slice(options.offset, options.offset + (options.limit || history.length));
  }

  if (options?.limit) {
    return history.slice(0, options.limit);
  }

  return history;
}

/**
 * Get recent conversation turns for context injection
 */
export async function getRecentTurns(
  sessionId: string,
  count: number = 10
): Promise<AIConversationHistory[]> {
  const history = await db
    .select()
    .from(aiConversationHistory)
    .where(eq(aiConversationHistory.sessionId, sessionId))
    .orderBy(desc(aiConversationHistory.turnIndex))
    .limit(count);

  // Return in chronological order
  return history.reverse();
}

/**
 * Build a resumption prompt from conversation history and snapshot
 */
export async function buildResumptionPrompt(
  sessionId: string
): Promise<string | null> {
  const snapshot = await getLatestSnapshot(sessionId);

  if (!snapshot) {
    return null;
  }

  // If we have a pre-generated resumption prompt, use it
  if (snapshot.resumptionPrompt) {
    return snapshot.resumptionPrompt;
  }

  // Build a prompt from the snapshot data
  const keyFindings = (snapshot.keyFindings as string[]) || [];
  const keyDecisions = (snapshot.keyDecisions as string[]) || [];
  const pendingQuestions = (snapshot.pendingQuestions as string[]) || [];
  const stepsCompleted = (snapshot.stepsCompleted as string[]) || [];

  const prompt = `
## Conversation Resumption Context

You are continuing an audit that was paused. Here's what happened before:

### Summary
${snapshot.contextSummary}

### Completed Steps
${stepsCompleted.length > 0 ? stepsCompleted.map((s) => `- ${s}`).join('\n') : 'None yet'}

### Key Findings So Far
${keyFindings.length > 0 ? keyFindings.map((f) => `- ${f}`).join('\n') : 'None yet'}

### Decisions Made
${keyDecisions.length > 0 ? keyDecisions.map((d) => `- ${d}`).join('\n') : 'None yet'}

### Pending Questions
${pendingQuestions.length > 0 ? pendingQuestions.map((q) => `- ${q}`).join('\n') : 'None'}

### Stats
- Total findings: ${snapshot.findingsCount}
- Tokens used: ${snapshot.tokensUsed}

Please continue the audit from where we left off.
`.trim();

  return prompt;
}

/**
 * Get conversation summary/stats for a session
 */
export async function getConversationSummary(
  sessionId: string
): Promise<ConversationSummary | null> {
  const [session] = await db
    .select()
    .from(auditSessions)
    .where(eq(auditSessions.id, sessionId));

  if (!session?.aiConversationId) {
    return null;
  }

  // Get unique steps analyzed
  const history = await db
    .select()
    .from(aiConversationHistory)
    .where(eq(aiConversationHistory.sessionId, sessionId));

  const stepsAnalyzed = [...new Set(history.filter((h) => h.stepId).map((h) => h.stepId!))];

  return {
    totalTurns: session.aiTotalTurns || 0,
    totalTokens: session.aiTotalTokensUsed || 0,
    modelUsed: session.aiModelUsed || 'unknown',
    startedAt: session.aiConversationStartedAt,
    lastUsedAt: session.aiConversationLastUsedAt,
    stepsAnalyzed,
  };
}

/**
 * Mark a snapshot as no longer resumable
 */
export async function invalidateSnapshot(snapshotId: string): Promise<void> {
  await db
    .update(aiContextSnapshots)
    .set({ resumable: false })
    .where(eq(aiContextSnapshots.id, snapshotId));
}

/**
 * Resume a conversation from a snapshot
 * Returns the context needed to continue the conversation
 */
export async function resumeConversation(
  sessionId: string
): Promise<ConversationContext | null> {
  const [session] = await db
    .select()
    .from(auditSessions)
    .where(eq(auditSessions.id, sessionId));

  if (!session?.aiConversationId) {
    return null;
  }

  const snapshot = await getLatestSnapshot(sessionId);

  if (!snapshot) {
    // No snapshot, return basic context
    return {
      conversationId: session.aiConversationId,
      sessionId,
      jobId: session.jobId,
      summary: 'No previous context available',
      keyFindings: [],
      keyDecisions: [],
      pendingQuestions: [],
      stepsCompleted: [],
      findingsCount: 0,
      tokensUsed: session.aiTotalTokensUsed || 0,
    };
  }

  const resumptionPrompt = await buildResumptionPrompt(sessionId);

  return {
    conversationId: session.aiConversationId,
    sessionId,
    jobId: session.jobId,
    summary: snapshot.contextSummary,
    keyFindings: (snapshot.keyFindings as string[]) || [],
    keyDecisions: (snapshot.keyDecisions as string[]) || [],
    pendingQuestions: (snapshot.pendingQuestions as string[]) || [],
    stepsCompleted: (snapshot.stepsCompleted as string[]) || [],
    findingsCount: snapshot.findingsCount || 0,
    tokensUsed: snapshot.tokensUsed || 0,
    resumptionPrompt: resumptionPrompt || undefined,
  };
}

/**
 * Generate a context summary from recent conversation turns
 * This would ideally use AI to summarize, but for now we do a simple extraction
 */
export function generateContextSummary(turns: AIConversationHistory[]): string {
  if (turns.length === 0) {
    return 'No conversation history yet.';
  }

  const assistantTurns = turns.filter((t) => t.role === 'assistant');
  const lastFew = assistantTurns.slice(-3);

  if (lastFew.length === 0) {
    return 'Conversation started but no analysis completed yet.';
  }

  // Use content summaries if available, otherwise truncate content
  const summaries = lastFew.map((t) => {
    if (t.contentSummary) return t.contentSummary;
    if (t.content.length > 200) return t.content.substring(0, 200) + '...';
    return t.content;
  });

  return `Recent analysis: ${summaries.join(' | ')}`;
}

export default {
  startConversation,
  getOrCreateConversation,
  logConversationTurn,
  createContextSnapshot,
  getLatestSnapshot,
  getConversationHistory,
  getRecentTurns,
  buildResumptionPrompt,
  getConversationSummary,
  invalidateSnapshot,
  resumeConversation,
  generateContextSummary,
};
