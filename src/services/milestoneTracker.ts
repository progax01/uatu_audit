/**
 * Semantic Milestone Tracker
 *
 * Tracks high-level audit progress with semantic milestones
 * that are easier to understand than individual step IDs.
 * This helps with:
 * - Clear progress communication to users
 * - Resume point identification
 * - Better error recovery
 */

import { db } from '../db/index.js';
import { auditJobs } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'milestoneTracker' });

// ============================================================================
// MILESTONE DEFINITIONS
// ============================================================================

export enum AuditMilestone {
  // Phase 1: Setup & Discovery
  SETUP_STARTED = 'setup_started',
  SETUP_COMPLETED = 'setup_completed',
  DISCOVERY_STARTED = 'discovery_started',
  DISCOVERY_COMPLETED = 'discovery_completed',

  // Phase 2: Compilation & Analysis
  COMPILATION_STARTED = 'compilation_started',
  COMPILATION_COMPLETED = 'compilation_completed',
  STATIC_ANALYSIS_STARTED = 'static_analysis_started',
  STATIC_ANALYSIS_COMPLETED = 'static_analysis_completed',

  // Phase 3: Tool Scanning
  TOOL_SCANNING_STARTED = 'tool_scanning_started',
  TOOL_SCANNING_COMPLETED = 'tool_scanning_completed',

  // Phase 4: AI Analysis
  AI_ANALYSIS_STARTED = 'ai_analysis_started',
  AI_ANALYSIS_COMPLETED = 'ai_analysis_completed',

  // Phase 5: Synthesis & Validation
  SYNTHESIS_STARTED = 'synthesis_started',
  SYNTHESIS_COMPLETED = 'synthesis_completed',

  // Phase 6: Testing (if enabled)
  TEST_GENERATION_STARTED = 'test_generation_started',
  TEST_GENERATION_COMPLETED = 'test_generation_completed',

  // Phase 7: Publishing (if enabled)
  PUBLISHING_STARTED = 'publishing_started',
  PUBLISHING_COMPLETED = 'publishing_completed',

  // Phase 8: Reporting
  REPORTING_STARTED = 'reporting_started',
  REPORTING_COMPLETED = 'reporting_completed',

  // Special States
  AWAITING_CLARIFICATION = 'awaiting_clarification',
  RE_ANALYSIS_TRIGGERED = 're_analysis_triggered',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Maps step categories to milestones
 */
const STEP_CATEGORY_TO_MILESTONE: Record<string, AuditMilestone[]> = {
  'setup': [AuditMilestone.SETUP_STARTED, AuditMilestone.SETUP_COMPLETED],
  'discovery': [AuditMilestone.DISCOVERY_STARTED, AuditMilestone.DISCOVERY_COMPLETED],
  'compilation': [AuditMilestone.COMPILATION_STARTED, AuditMilestone.COMPILATION_COMPLETED],
  'analysis': [AuditMilestone.STATIC_ANALYSIS_STARTED, AuditMilestone.STATIC_ANALYSIS_COMPLETED],
  'tool-analysis': [AuditMilestone.TOOL_SCANNING_STARTED, AuditMilestone.TOOL_SCANNING_COMPLETED],
  'ai-analysis': [AuditMilestone.AI_ANALYSIS_STARTED, AuditMilestone.AI_ANALYSIS_COMPLETED],
  'synthesis': [AuditMilestone.SYNTHESIS_STARTED, AuditMilestone.SYNTHESIS_COMPLETED],
  'testing': [AuditMilestone.TEST_GENERATION_STARTED, AuditMilestone.TEST_GENERATION_COMPLETED],
  'publishing': [AuditMilestone.PUBLISHING_STARTED, AuditMilestone.PUBLISHING_COMPLETED],
  'reporting': [AuditMilestone.REPORTING_STARTED, AuditMilestone.REPORTING_COMPLETED],
};

export interface MilestoneRecord {
  milestone: AuditMilestone;
  timestamp: string;
  stepId?: string;
  stepName?: string;
}

export interface MilestoneMetadata {
  milestones: MilestoneRecord[];
  currentMilestone: AuditMilestone;
  lastStableCheckpoint?: AuditMilestone;
  phaseProgress: {
    [phase: string]: {
      started: boolean;
      completed: boolean;
      percentage: number;
    };
  };
}

// ============================================================================
// MILESTONE TRACKING
// ============================================================================

/**
 * Records a milestone for an audit job
 */
export async function recordMilestone(
  jobId: string,
  milestone: AuditMilestone,
  stepId?: string,
  stepName?: string
): Promise<void> {
  try {
    // Get current job
    const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));

    if (!job) {
      log.error('Job not found for milestone recording', { jobId });
      return;
    }

    // Get existing milestone metadata
    const metadata = (job.metadata as any) || {};
    const milestoneMetadata: MilestoneMetadata = metadata.milestones || {
      milestones: [],
      currentMilestone: AuditMilestone.SETUP_STARTED,
      phaseProgress: {},
    };

    // Add new milestone record
    const newRecord: MilestoneRecord = {
      milestone,
      timestamp: new Date().toISOString(),
      stepId,
      stepName,
    };

    milestoneMetadata.milestones.push(newRecord);
    milestoneMetadata.currentMilestone = milestone;

    // Update phase progress
    updatePhaseProgress(milestoneMetadata, milestone);

    // Determine last stable checkpoint
    if (isMilestoneStable(milestone)) {
      milestoneMetadata.lastStableCheckpoint = milestone;
    }

    // Update job
    await db.update(auditJobs)
      .set({
        metadata: {
          ...metadata,
          milestones: milestoneMetadata,
        },
      })
      .where(eq(auditJobs.id, jobId));

    log.info('Milestone recorded', {
      jobId,
      milestone,
      stepId,
      stepName,
    });
  } catch (error) {
    log.error('Failed to record milestone', { jobId, milestone, error });
  }
}

/**
 * Records milestone based on step category
 */
export async function recordMilestoneFromStep(
  jobId: string,
  stepCategory: string,
  stepId: string,
  stepName: string,
  isStarting: boolean
): Promise<void> {
  const milestones = STEP_CATEGORY_TO_MILESTONE[stepCategory];

  if (!milestones) {
    return; // No milestone mapping for this category
  }

  const milestone = isStarting ? milestones[0] : milestones[1];
  await recordMilestone(jobId, milestone, stepId, stepName);
}

/**
 * Gets current milestone for a job
 */
export async function getCurrentMilestone(jobId: string): Promise<AuditMilestone | null> {
  const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));

  if (!job) {
    return null;
  }

  const metadata = (job.metadata as any) || {};
  const milestoneMetadata: MilestoneMetadata = metadata.milestones;

  return milestoneMetadata?.currentMilestone || null;
}

/**
 * Gets milestone history for a job
 */
export async function getMilestoneHistory(jobId: string): Promise<MilestoneRecord[]> {
  const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));

  if (!job) {
    return [];
  }

  const metadata = (job.metadata as any) || {};
  const milestoneMetadata: MilestoneMetadata = metadata.milestones;

  return milestoneMetadata?.milestones || [];
}

/**
 * Gets the last stable checkpoint milestone
 */
export async function getLastStableCheckpoint(jobId: string): Promise<AuditMilestone | null> {
  const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));

  if (!job) {
    return null;
  }

  const metadata = (job.metadata as any) || {};
  const milestoneMetadata: MilestoneMetadata = metadata.milestones;

  return milestoneMetadata?.lastStableCheckpoint || null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Updates phase progress based on milestone
 */
function updatePhaseProgress(metadata: MilestoneMetadata, milestone: AuditMilestone): void {
  // Determine phase from milestone
  const phase = getPhaseFromMilestone(milestone);

  if (!phase) {
    return;
  }

  // Initialize phase progress if needed
  if (!metadata.phaseProgress[phase]) {
    metadata.phaseProgress[phase] = {
      started: false,
      completed: false,
      percentage: 0,
    };
  }

  // Update based on milestone
  if (milestone.endsWith('_started')) {
    metadata.phaseProgress[phase].started = true;
    metadata.phaseProgress[phase].percentage = 10;
  } else if (milestone.endsWith('_completed')) {
    metadata.phaseProgress[phase].completed = true;
    metadata.phaseProgress[phase].percentage = 100;
  }
}

/**
 * Extracts phase name from milestone
 */
function getPhaseFromMilestone(milestone: AuditMilestone): string | null {
  const milestoneStr = milestone.toString();

  if (milestoneStr.includes('setup')) return 'setup';
  if (milestoneStr.includes('discovery')) return 'discovery';
  if (milestoneStr.includes('compilation')) return 'compilation';
  if (milestoneStr.includes('static_analysis')) return 'static-analysis';
  if (milestoneStr.includes('tool_scanning')) return 'tool-scanning';
  if (milestoneStr.includes('ai_analysis')) return 'ai-analysis';
  if (milestoneStr.includes('synthesis')) return 'synthesis';
  if (milestoneStr.includes('test_generation')) return 'test-generation';
  if (milestoneStr.includes('publishing')) return 'publishing';
  if (milestoneStr.includes('reporting')) return 'reporting';

  return null;
}

/**
 * Determines if a milestone is stable (good resume point)
 */
function isMilestoneStable(milestone: AuditMilestone): boolean {
  // Completed milestones are stable checkpoints
  return milestone.toString().endsWith('_completed');
}

/**
 * Gets human-readable description of milestone
 */
export function getMilestoneDescription(milestone: AuditMilestone): string {
  const descriptions: Record<AuditMilestone, string> = {
    [AuditMilestone.SETUP_STARTED]: 'Setting up audit environment',
    [AuditMilestone.SETUP_COMPLETED]: 'Setup completed successfully',
    [AuditMilestone.DISCOVERY_STARTED]: 'Discovering contracts and dependencies',
    [AuditMilestone.DISCOVERY_COMPLETED]: 'Contract discovery completed',
    [AuditMilestone.COMPILATION_STARTED]: 'Compiling smart contracts',
    [AuditMilestone.COMPILATION_COMPLETED]: 'Compilation completed',
    [AuditMilestone.STATIC_ANALYSIS_STARTED]: 'Running static analysis',
    [AuditMilestone.STATIC_ANALYSIS_COMPLETED]: 'Static analysis completed',
    [AuditMilestone.TOOL_SCANNING_STARTED]: 'Running security scanning tools',
    [AuditMilestone.TOOL_SCANNING_COMPLETED]: 'Security scanning completed',
    [AuditMilestone.AI_ANALYSIS_STARTED]: 'Running AI-powered analysis',
    [AuditMilestone.AI_ANALYSIS_COMPLETED]: 'AI analysis completed',
    [AuditMilestone.SYNTHESIS_STARTED]: 'Synthesizing and validating findings',
    [AuditMilestone.SYNTHESIS_COMPLETED]: 'Finding synthesis completed',
    [AuditMilestone.TEST_GENERATION_STARTED]: 'Generating test cases for vulnerabilities',
    [AuditMilestone.TEST_GENERATION_COMPLETED]: 'Test generation completed',
    [AuditMilestone.PUBLISHING_STARTED]: 'Publishing results to GitHub',
    [AuditMilestone.PUBLISHING_COMPLETED]: 'Results published successfully',
    [AuditMilestone.REPORTING_STARTED]: 'Generating final audit report',
    [AuditMilestone.REPORTING_COMPLETED]: 'Audit report generated',
    [AuditMilestone.AWAITING_CLARIFICATION]: 'Waiting for user answers to questions',
    [AuditMilestone.RE_ANALYSIS_TRIGGERED]: 'Re-analyzing based on user answers',
    [AuditMilestone.COMPLETED]: 'Audit completed successfully',
    [AuditMilestone.FAILED]: 'Audit failed',
  };

  return descriptions[milestone] || milestone.toString();
}

/**
 * Calculates overall progress percentage based on milestones
 */
export function calculateProgressFromMilestones(metadata: MilestoneMetadata): number {
  const phases = Object.values(metadata.phaseProgress);

  if (phases.length === 0) {
    return 0;
  }

  const completedPhases = phases.filter(p => p.completed).length;
  const totalPhases = phases.length;

  return Math.round((completedPhases / totalPhases) * 100);
}
