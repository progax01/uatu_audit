export type SOPName = string;
export type TestStyle = "behavioral" | "stride" | "owasp";

export interface SOPInputs {
  [key: string]: unknown;
  testStyles?: TestStyle[];  // default: ["behavioral","stride"]
  jobId?: number;  // For cancellation support
}

export interface SOPResult {
  [key: string]: unknown;
}

export interface StepProgress {
  phase: string; // e.g., "bootstrap"
  step: string; // e.g., "pattern-matching"
  pct: number; // 0-100
  note?: string; // brief message
}

export interface SOP {
  name: SOPName;
  version: string;
  prerequisites: SOPName[];
  validateInputs(i: SOPInputs): Promise<boolean>;
  execute(
    i: SOPInputs,
    onProgress?: (p: StepProgress) => Promise<void>
  ): Promise<SOPResult>;
  verifyOutputs(r: SOPResult): Promise<boolean>;
}

// Progress model types - these are now defined in progressService.ts
// Keeping minimal types here for backward compatibility

// ============================================
// PAGE 1: Executive Certificate Types
// ============================================

export type DeploymentVerdictType = "PRODUCTION_READY" | "CONDITIONALLY_READY" | "BLOCKED";

export interface DeploymentVerdict {
  verdict: DeploymentVerdictType;
  reasoning: string;
  conditions: string[]; // Only populated for CONDITIONALLY_READY
}

export interface RiskBadges {
  reentrancy_risk: boolean;
  oracle_risk: boolean;
  access_control_risk: boolean;
  upgrade_risk: boolean;
  flash_loan_risk: boolean;
  dos_risk: boolean;
  frontrun_risk: boolean;
  centralization_risk: boolean;
}

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface ScopeSummary {
  contracts_analyzed: number;
  lines_analyzed: number;
  commit_hash: string;
  branch: string;
  audit_date: string;
}

export interface Page1Certificate {
  deployment_verdict: DeploymentVerdict;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  risk_badges: RiskBadges;
  severity: SeverityCounts;
  scope_summary: ScopeSummary;
}

// ============================================
// PAGE 2: Risk Narrative Types
// ============================================

export type LikelihoodLevel = "High" | "Medium" | "Low";

export interface WorstCaseScenario {
  rank: 1 | 2 | 3;
  title: string;
  attack_description: string;
  impact: string;
  likelihood: LikelihoodLevel;
  related_findings: string[];
}

export type ThreatActorType =
  | "external_attacker"
  | "malicious_insider"
  | "compromised_admin"
  | "mev_bot"
  | "competitor"
  | "nation_state";

export interface ThreatActor {
  type: ThreatActorType;
  capability: string;
  motivation: string;
}

export interface ThreatModelSummary {
  threat_actors: ThreatActor[];
  attack_vectors: string[];
  assets_at_risk: string[];
  trust_assumptions: string[];
}

export interface ExternalEntryPoints {
  count: number;
  functions: string[];
}

export interface PrivilegedFunctions {
  count: number;
  functions: string[];
  roles: string[];
}

export interface ExternalCalls {
  count: number;
  targets: string[];
}

export interface AttackSurfaceOverview {
  external_entry_points: ExternalEntryPoints;
  privileged_functions: PrivilegedFunctions;
  external_calls: ExternalCalls;
  state_modifying_functions: number;
  payable_functions: number;
}

export interface Page2RiskNarrative {
  worst_case_scenarios: WorstCaseScenario[];
  threat_model: ThreatModelSummary;
  attack_surface: AttackSurfaceOverview;
}

// ============================================
// Unified Report Data Type
// ============================================

export interface UnifiedReportData {
  meta: {
    project: string;
    branch: string;
    commit?: string;
    run: string;
  };
  page1_certificate: Page1Certificate;
  page2_risk_narrative: Page2RiskNarrative;
  findings: any[];
  user_flows?: any[];
  contracts_explained?: any[];
  test_results?: any[];
  improve?: any[] | Record<string, any>;
}

// ============================================
// Helper Functions
// ============================================

export function calculateDeploymentVerdict(
  score: number,
  severity: SeverityCounts
): DeploymentVerdictType {
  if (severity.critical > 0) return "BLOCKED";
  if (severity.high > 2) return "BLOCKED";
  if (score < 60) return "BLOCKED";
  if (score >= 85 && severity.high === 0) return "PRODUCTION_READY";
  return "CONDITIONALLY_READY";
}

export function calculateGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function getDefaultRiskBadges(): RiskBadges {
  return {
    reentrancy_risk: false,
    oracle_risk: false,
    access_control_risk: false,
    upgrade_risk: false,
    flash_loan_risk: false,
    dos_risk: false,
    frontrun_risk: false,
    centralization_risk: false,
  };
}

