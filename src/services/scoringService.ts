import type { LiabilityMap } from "./liabilityMap.js";

export interface FindingLike {
  id?: string;                 // stable id if available
  component_id?: string;       // matches LiabilityMap.component.id if possible
  severity?: string;           // "critical" | "high" | "medium" | "low" | "info"
  title?: string;
  description?: string;
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
}

export interface WeightedScoreResult {
  value: number;
  grade: string;
  breakdown: ScoreBreakdown;
}

function severityWeight(severity: string | undefined): number {
  const s = (severity || "").toLowerCase();
  if (s === "critical") return 25;
  if (s === "high") return 10;
  if (s === "medium") return 3;
  if (s === "low") return 1;
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
 */
export function calculateWeightedScore(
  findings: FindingLike[],
  liabilityMap: LiabilityMap | null,
  externalWeightFactor = 0.2
): WeightedScoreResult {
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
  };

  let localDeductions = 0;
  let externalDeductions = 0;

  for (const f of findings || []) {
    const scope = classifyFindingScope(f, liabilityMap);
    const s = (f.severity || "").toLowerCase();
    const w = severityWeight(f.severity);

    if (s === "info" || s === "informational") {
      breakdown.info_count++;
      continue;
    }

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

