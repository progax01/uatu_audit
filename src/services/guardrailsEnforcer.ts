/**
 * Guardrails Enforcer
 *
 * Enforces the immutable rules defined in .claude/guardrails.md to prevent:
 * - Score manipulation
 * - SOP deviation
 * - Test tampering
 * - Unauthorized requests
 * - Output falsification
 *
 * All violations are logged and blocked.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from '../utils/logger.js';
import type { GuardrailViolation, AuditTrailEntry, ViolationType } from '../types/project.js';
import type { FindingLike } from './scoringService.js';

const log = logger.child({ service: 'guardrails' });

// ============================================================================
// SCORE INTEGRITY
// ============================================================================

/**
 * Score calculation formula (immutable)
 * Score = 100 - (Critical×25 + High×10 + Medium×3 + Low×1)
 * UNDECLARED = 0 weight
 * EXTERNAL = 0.2x weight
 */
export function calculateExpectedScore(
  findings: FindingLike[],
  externalWeightFactor = 0.2
): number {
  let deductions = 0;

  for (const f of findings) {
    const severity = (f.severity || '').toLowerCase();
    const isExternal = f.component_id?.includes('external') || false;
    const isUndeclared = severity === 'undeclared' || f.isUndeclared;

    // UNDECLARED findings have zero weight
    if (isUndeclared) continue;

    let weight = 0;
    if (severity === 'critical') weight = 25;
    else if (severity === 'high') weight = 10;
    else if (severity === 'medium') weight = 3;
    else if (severity === 'low') weight = 1;

    // Apply external discount
    if (isExternal) {
      weight *= externalWeightFactor;
    }

    deductions += weight;
  }

  return Math.max(0, Math.min(100, 100 - deductions));
}

/**
 * Validate that a reported score matches the expected calculation
 */
export function validateScoreIntegrity(
  findings: FindingLike[],
  reportedScore: number,
  tolerance = 0.5
): { valid: boolean; expected: number; violation?: GuardrailViolation } {
  const expected = calculateExpectedScore(findings);
  const diff = Math.abs(expected - reportedScore);

  if (diff > tolerance) {
    return {
      valid: false,
      expected,
      violation: {
        type: 'SCORE_MANIPULATION',
        description: `Score mismatch: reported ${reportedScore} but calculated ${expected} (diff: ${diff.toFixed(2)})`,
        timestamp: new Date().toISOString(),
        blocked: true,
        context: {
          reportedScore,
          expectedScore: expected,
          difference: diff,
          findingsCount: findings.length,
        },
      },
    };
  }

  return { valid: true, expected };
}

// ============================================================================
// SOP ADHERENCE
// ============================================================================

const MILESTONE_ORDER = ['M1', 'M2', 'M3', 'M4', 'M5'];

/**
 * Validate that milestones are executed in correct order
 */
export function validateMilestoneSequence(
  currentMilestone: string,
  completedMilestones: string[]
): { valid: boolean; violation?: GuardrailViolation } {
  const currentIndex = MILESTONE_ORDER.indexOf(currentMilestone);

  if (currentIndex === -1) {
    return {
      valid: false,
      violation: {
        type: 'SOP_DEVIATION',
        description: `Unknown milestone: ${currentMilestone}`,
        timestamp: new Date().toISOString(),
        blocked: true,
        context: { currentMilestone, validMilestones: MILESTONE_ORDER },
      },
    };
  }

  // Check that all previous milestones are completed
  for (let i = 0; i < currentIndex; i++) {
    if (!completedMilestones.includes(MILESTONE_ORDER[i])) {
      return {
        valid: false,
        violation: {
          type: 'SOP_DEVIATION',
          description: `Cannot start ${currentMilestone} before completing ${MILESTONE_ORDER[i]}`,
          timestamp: new Date().toISOString(),
          blocked: true,
          context: {
            currentMilestone,
            requiredMilestone: MILESTONE_ORDER[i],
            completedMilestones,
          },
        },
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// FINDING INTEGRITY
// ============================================================================

/**
 * Validate that a finding has all required evidence
 */
export function validateFindingEvidence(
  finding: FindingLike & {
    location?: string;
    code_snippet?: string;
    impact?: string;
    confidence?: number;
  }
): { valid: boolean; missing: string[]; violation?: GuardrailViolation } {
  const missing: string[] = [];

  if (!finding.id) missing.push('id');
  if (!finding.severity) missing.push('severity');
  if (!finding.title) missing.push('title');
  if (!finding.description) missing.push('description');

  // Skip evidence requirements for INFO and UNDECLARED
  const severity = (finding.severity || '').toLowerCase();
  if (severity !== 'info' && severity !== 'informational' && severity !== 'undeclared') {
    if (!finding.location) missing.push('location (file:line)');
    if (!finding.code_snippet) missing.push('code_snippet');
    if (!finding.impact) missing.push('impact description');
  }

  if (missing.length > 0) {
    return {
      valid: false,
      missing,
      violation: {
        type: 'OUTPUT_FALSIFICATION',
        description: `Finding "${finding.title}" missing required evidence: ${missing.join(', ')}`,
        timestamp: new Date().toISOString(),
        blocked: false, // Warning, not blocked
        context: { findingId: finding.id, missing },
      },
    };
  }

  return { valid: true, missing: [] };
}

/**
 * Validate severity matches described impact
 */
export function validateSeverityConsistency(
  finding: FindingLike & { impact?: string }
): { valid: boolean; violation?: GuardrailViolation } {
  const severity = (finding.severity || '').toLowerCase();
  const impact = (finding.impact || '').toLowerCase();

  // Check for inconsistencies
  const criticalKeywords = ['fund loss', 'steal', 'drain', 'rug', 'total loss', 'complete loss'];
  const lowKeywords = ['gas optimization', 'style', 'naming', 'documentation'];

  if (severity === 'low' || severity === 'info') {
    for (const kw of criticalKeywords) {
      if (impact.includes(kw)) {
        return {
          valid: false,
          violation: {
            type: 'SCORE_MANIPULATION',
            description: `Severity "${severity}" inconsistent with impact "${finding.impact}" (contains critical keyword: ${kw})`,
            timestamp: new Date().toISOString(),
            blocked: true,
            context: {
              findingId: finding.id,
              severity,
              impactKeyword: kw,
            },
          },
        };
      }
    }
  }

  if (severity === 'critical' || severity === 'high') {
    let isOptimization = true;
    for (const kw of lowKeywords) {
      if (!impact.includes(kw)) {
        isOptimization = false;
      }
    }
    if (isOptimization && lowKeywords.some(kw => impact.includes(kw))) {
      return {
        valid: false,
        violation: {
          type: 'SCORE_MANIPULATION',
          description: `Severity "${severity}" inconsistent with optimization/style impact`,
          timestamp: new Date().toISOString(),
          blocked: true,
          context: { findingId: finding.id, severity, impact: finding.impact },
        },
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// USER REQUEST VALIDATION
// ============================================================================

const BLOCKED_REQUESTS = [
  /increase.*score/i,
  /inflate.*score/i,
  /change.*critical.*to.*medium/i,
  /change.*high.*to.*low/i,
  /remove.*finding/i,
  /delete.*finding/i,
  /hide.*finding/i,
  /skip.*security/i,
  /skip.*analysis/i,
  /make.*test.*pass/i,
  /no.*vulnerabilities/i,
];

const ALLOWED_REQUESTS = [
  /acknowledge.*risk/i,
  /known.*issue/i,
  /expected.*behavior/i,
  /out.*of.*scope/i,
  /focus.*on/i,
  /prioritize/i,
  /re-analyze/i,
  /check.*again/i,
];

/**
 * Check if a user request violates guardrails
 */
export function validateUserRequest(
  request: string
): { allowed: boolean; violation?: GuardrailViolation } {
  // Check for blocked patterns
  for (const pattern of BLOCKED_REQUESTS) {
    if (pattern.test(request)) {
      return {
        allowed: false,
        violation: {
          type: 'UNAUTHORIZED_REQUEST',
          description: `Request blocked: "${request}" matches prohibited pattern`,
          timestamp: new Date().toISOString(),
          blocked: true,
          context: { request, matchedPattern: pattern.toString() },
        },
      };
    }
  }

  return { allowed: true };
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================

/**
 * Create a state hash for audit trail
 */
export function createStateHash(state: object): string {
  const serialized = JSON.stringify(state, Object.keys(state).sort());
  return crypto.createHash('sha256').update(serialized).digest('hex').substring(0, 16);
}

/**
 * Create an audit trail entry
 */
export function createAuditTrailEntry(
  action: AuditTrailEntry['action'],
  actor: AuditTrailEntry['actor'],
  details: Record<string, unknown>,
  state: object
): AuditTrailEntry {
  return {
    action,
    timestamp: new Date().toISOString(),
    actor,
    details,
    stateHash: createStateHash(state),
  };
}

/**
 * Save audit trail entry to file
 */
export async function appendAuditTrail(
  contextPath: string,
  entry: AuditTrailEntry
): Promise<void> {
  const trailPath = path.join(contextPath, 'audit_trail.jsonl');
  await fs.mkdir(path.dirname(trailPath), { recursive: true });
  await fs.appendFile(trailPath, JSON.stringify(entry) + '\n', 'utf-8');
  log.debug('Audit trail entry added', { action: entry.action, stateHash: entry.stateHash });
}

/**
 * Load audit trail from file
 */
export async function loadAuditTrail(
  contextPath: string
): Promise<AuditTrailEntry[]> {
  const trailPath = path.join(contextPath, 'audit_trail.jsonl');
  try {
    const content = await fs.readFile(trailPath, 'utf-8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as AuditTrailEntry);
  } catch {
    return [];
  }
}

// ============================================================================
// VIOLATION LOGGING
// ============================================================================

/**
 * Log a guardrail violation
 */
export async function logViolation(
  contextPath: string,
  violation: GuardrailViolation
): Promise<void> {
  // Log to console
  log.warn('Guardrail violation detected', {
    type: violation.type,
    description: violation.description,
    blocked: violation.blocked,
  });

  // Append to violations log
  const violationsPath = path.join(contextPath, 'guardrail_violations.jsonl');
  await fs.mkdir(path.dirname(violationsPath), { recursive: true });
  await fs.appendFile(violationsPath, JSON.stringify(violation) + '\n', 'utf-8');

  // Add to audit trail
  await appendAuditTrail(contextPath, createAuditTrailEntry(
    'GUARDRAIL_VIOLATION',
    'SYSTEM',
    { violation },
    { violation }
  ));
}

/**
 * Load all violations from file
 */
export async function loadViolations(
  contextPath: string
): Promise<GuardrailViolation[]> {
  const violationsPath = path.join(contextPath, 'guardrail_violations.jsonl');
  try {
    const content = await fs.readFile(violationsPath, 'utf-8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as GuardrailViolation);
  } catch {
    return [];
  }
}

// ============================================================================
// PRE-REPORT VALIDATION
// ============================================================================

/**
 * Validate audit results before report generation
 */
export async function validatePreReport(
  contextPath: string,
  findings: FindingLike[],
  reportedScore: number
): Promise<{ valid: boolean; violations: GuardrailViolation[] }> {
  const violations: GuardrailViolation[] = [];

  // 1. Validate score integrity
  const scoreResult = validateScoreIntegrity(findings, reportedScore);
  if (!scoreResult.valid && scoreResult.violation) {
    violations.push(scoreResult.violation);
  }

  // 2. Validate all findings have evidence
  for (const finding of findings) {
    const evidenceResult = validateFindingEvidence(finding as any);
    if (!evidenceResult.valid && evidenceResult.violation) {
      violations.push(evidenceResult.violation);
    }

    const severityResult = validateSeverityConsistency(finding as any);
    if (!severityResult.valid && severityResult.violation) {
      violations.push(severityResult.violation);
    }
  }

  // Log violations
  for (const v of violations) {
    await logViolation(contextPath, v);
  }

  // Check if any blocking violations
  const hasBlockingViolation = violations.some(v => v.blocked);

  return {
    valid: !hasBlockingViolation,
    violations,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Score integrity
  calculateExpectedScore,
  validateScoreIntegrity,

  // SOP adherence
  validateMilestoneSequence,

  // Finding integrity
  validateFindingEvidence,
  validateSeverityConsistency,

  // User request validation
  validateUserRequest,

  // Audit trail
  createStateHash,
  createAuditTrailEntry,
  appendAuditTrail,
  loadAuditTrail,

  // Violation logging
  logViolation,
  loadViolations,

  // Pre-report validation
  validatePreReport,
};
