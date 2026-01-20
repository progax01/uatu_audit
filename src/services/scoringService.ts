import type { LiabilityMap } from "./liabilityMap.js";

export interface FindingLike {
  id?: string;                 // stable id if available
  component_id?: string;       // matches LiabilityMap.component.id if possible
  severity?: string;           // "critical" | "high" | "medium" | "low" | "info" | "undeclared"
  title?: string;
  description?: string;
  isUndeclared?: boolean;      // true if finding is from undeclared component
  referencedBy?: string[];     // files that reference this undeclared component
  componentType?: 'backend' | 'frontend' | 'contract' | 'library' | 'external-api';
}

export interface ScoreBreakdown {
  critical_count_internal: number;
  high_count_internal: number;
  medium_count_internal: number;
  low_count_internal: number;
  critical_count_external: number;
  high_count_external: number;
  medium_count_external: number;
  low_count_external: number;
  info_count: number;
  undeclared_count: number;    // UNDECLARED findings (weight = 0)
}

export interface WeightedScoreResult {
  value: number;
  grade: string;
  breakdown: ScoreBreakdown;
}

/**
 * Get the weight for a severity level.
 * UNDECLARED explicitly returns 0 - these findings are tracked but don't affect score.
 */
function severityWeight(severity: string | undefined): number {
  const s = (severity || "").toLowerCase();
  if (s === "critical") return 25;
  if (s === "high") return 10;
  if (s === "medium") return 3;
  if (s === "low") return 1;
  if (s === "undeclared") return 0;  // Explicit zero weight for UNDECLARED
  return 0;
}

function gradeFromScore(value: number): string {
  if (value >= 90) return "A";
  if (value >= 80) return "B";
  if (value >= 70) return "C";
  if (value >= 60) return "D";
  return "F";
}

/**
 * Map a finding to INTERNAL/EXTERNAL based on liability map.
 * Fallback: INTERNAL if no mapping exists.
 */
function classifyFindingScope(
  finding: FindingLike,
  liabilityMap: LiabilityMap | null
): "INTERNAL" | "EXTERNAL" {
  if (!liabilityMap) return "INTERNAL";
  const componentId = finding.component_id || finding.id;
  if (!componentId) return "INTERNAL";

  const entry = liabilityMap.components.find((c) => c.id === componentId);
  return entry?.scope === "EXTERNAL" ? "EXTERNAL" : "INTERNAL";
}

/**
 * Calculate score with liability weighting:
 * - INTERNAL: full weight
 * - EXTERNAL: discounted (e.g. 0.2x) because responsibility is shared/shifted.
 * - UNDECLARED: zero weight (tracked but doesn't affect score)
 */
/**
 * Adjust finding severity if admin privilege was disclosed in pre-audit questionnaire.
 * Disclosed admin controls get severity reduced by one level (high → medium, etc.)
 * because transparency shows good faith.
 */
export function adjustSeverityForDisclosure(
  finding: FindingLike,
  disclosedAdminPrivileges: string[] = []
): FindingLike {
  if (!finding.severity || disclosedAdminPrivileges.length === 0) {
    return finding;
  }

  const findingText = `${finding.title} ${finding.description}`.toLowerCase();

  // Check if this finding relates to disclosed admin controls
  const isAboutPause = disclosedAdminPrivileges.includes('Pause/unpause functionality') &&
                       (findingText.includes('pause') || findingText.includes('pausable'));

  const isAboutUpgrade = disclosedAdminPrivileges.includes('Upgrade contract (proxy)') &&
                        (findingText.includes('upgrade') || findingText.includes('proxy'));

  const isAboutFees = disclosedAdminPrivileges.includes('Change fees/parameters') &&
                     (findingText.includes('fee') || findingText.includes('parameter'));

  const isAboutMint = disclosedAdminPrivileges.includes('Mint tokens') &&
                     (findingText.includes('mint') || findingText.includes('supply'));

  const isAboutBlacklist = disclosedAdminPrivileges.includes('Blacklist addresses') &&
                          (findingText.includes('blacklist') || findingText.includes('whitelist'));

  const isAboutWithdraw = disclosedAdminPrivileges.includes('Emergency withdraw') &&
                         (findingText.includes('withdraw') || findingText.includes('drain'));

  // If admin control was disclosed, reduce severity by one level
  if (isAboutPause || isAboutUpgrade || isAboutFees || isAboutMint || isAboutBlacklist || isAboutWithdraw) {
    const severityMap: Record<string, string> = {
      'critical': 'high',      // Critical → High
      'high': 'medium',        // High → Medium
      'medium': 'low',         // Medium → Low
      'low': 'info'            // Low → Info
    };

    const currentSeverity = finding.severity.toLowerCase();
    const newSeverity = severityMap[currentSeverity] || currentSeverity;

    // Add note to description about disclosure
    const disclosureNote = '\n\n[Note: Severity reduced because this admin control was disclosed in pre-audit questionnaire, showing transparency.]';

    return {
      ...finding,
      severity: newSeverity,
      description: (finding.description || '') + disclosureNote
    };
  }

  return finding;
}

export function calculateWeightedScore(
  findings: FindingLike[],
  liabilityMap: LiabilityMap | null,
  externalWeightFactor = 0.2,
  disclosedAdminPrivileges: string[] = []
): WeightedScoreResult {
  // Adjust findings based on disclosure before scoring
  const adjustedFindings = findings.map(f =>
    adjustSeverityForDisclosure(f, disclosedAdminPrivileges)
  );
  const breakdown: ScoreBreakdown = {
    critical_count_internal: 0,
    high_count_internal: 0,
    medium_count_internal: 0,
    low_count_internal: 0,
    critical_count_external: 0,
    high_count_external: 0,
    medium_count_external: 0,
    low_count_external: 0,
    info_count: 0,
    undeclared_count: 0,
  };

  let localDeductions = 0;
  let externalDeductions = 0;

  for (const f of adjustedFindings || []) {
    const s = (f.severity || "").toLowerCase();
    const w = severityWeight(f.severity);

    // Handle UNDECLARED findings - track but don't score
    if (s === "undeclared" || f.isUndeclared) {
      breakdown.undeclared_count++;
      continue; // Zero weight - doesn't affect score
    }

    // Handle INFO findings
    if (s === "info" || s === "informational") {
      breakdown.info_count++;
      continue;
    }

    // Classify and score other findings
    const scope = classifyFindingScope(f, liabilityMap);

    if (scope === "INTERNAL") {
      localDeductions += w;
      if (s === "critical") breakdown.critical_count_internal++;
      else if (s === "high") breakdown.high_count_internal++;
      else if (s === "medium") breakdown.medium_count_internal++;
      else if (s === "low") breakdown.low_count_internal++;
    } else {
      externalDeductions += w;
      if (s === "critical") breakdown.critical_count_external++;
      else if (s === "high") breakdown.high_count_external++;
      else if (s === "medium") breakdown.medium_count_external++;
      else if (s === "low") breakdown.low_count_external++;
    }
  }

  const totalDeductions =
    localDeductions + externalDeductions * externalWeightFactor;

  const value = Math.max(0, Math.min(100, 100 - totalDeductions));
  const grade = gradeFromScore(value);

  return { value, grade, breakdown };
}

