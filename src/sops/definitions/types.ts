/**
 * SOP Definition Types
 *
 * Standard Operating Procedure definitions for framework-specific audit workflows.
 * Each SOP contains micro-steps (30-60 seconds each) for granular progress tracking.
 */

// ============================================================================
// Core Types
// ============================================================================

export type Framework =
  | 'foundry'       // Solidity - Foundry
  | 'hardhat'       // Solidity - Hardhat
  | 'truffle'       // Solidity - Truffle
  | 'brownie'       // Solidity - Brownie
  | 'anchor'        // Rust - Solana Anchor
  | 'solana-native' // Rust - Solana native
  | 'aptos-move'    // Move - Aptos
  | 'sui-move'      // Move - Sui
  | 'move'          // Move - Generic
  | 'ink'           // Rust - Substrate ink!
  | 'cargo'         // Rust - Generic Cargo
  | 'generic'       // Fallback for generic projects
  | 'unknown';      // Unknown framework

export type Language = 'solidity' | 'rust' | 'move' | 'unknown';

export type AuditDepth = 'quick' | 'standard' | 'deep';

export type StepExecutorType =
  | 'tool'          // Run external CLI tool (slither, mythril, etc.)
  | 'deterministic' // Run TypeScript function (no AI)
  | 'ai-prompt'     // Send to Claude for AI analysis
  | 'interactive'   // Require user interaction (Deep scans only)
  | 'composite';    // Multiple sub-steps combined

export type StepCategory =
  | 'setup'
  | 'detection'
  | 'compilation'
  | 'static-analysis'
  | 'symbolic-analysis'
  | 'ai-analysis'
  | 'test-execution'
  | 'report-generation';

export type StepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

// ============================================================================
// SOP Definition Schema
// ============================================================================

/**
 * Complete SOP definition loaded from JSON files
 */
export interface SOPDefinition {
  /** Unique identifier (e.g., "solidity-foundry") */
  id: string;

  /** Semantic version */
  version: string;

  /** Human-readable name */
  name: string;

  /** Target framework */
  framework: Framework;

  /** Primary language */
  language: Language;

  /** Description of this SOP */
  description: string;

  /** Depth configurations (which steps to run at each depth) */
  depths: {
    quick: DepthConfig;     // 5-10 minutes
    standard: DepthConfig;  // 30-60 minutes
    deep: DepthConfig;      // 2+ hours
  };

  /** All available steps in this SOP */
  steps: StepDefinition[];

  /** Tools that must be available */
  requiredTools: ToolRequirement[];

  /** Tools that enhance analysis if available */
  optionalTools: ToolRequirement[];

  /** Metadata */
  created: string;
  updated: string;
  author: string;
}

/**
 * Configuration for a specific audit depth level
 */
export interface DepthConfig {
  /** Step IDs to execute at this depth ("*" for all) */
  enabledSteps: string[];

  /** How aggressively to parallelize steps */
  parallelizationLevel: 'none' | 'low' | 'high';

  /** Expected duration in minutes */
  estimatedDurationMinutes: number;

  /** Timeout overrides per tool (tool name -> seconds) */
  toolTimeouts: Record<string, number>;

  /** Skip compilation steps (Quick scan only) */
  skipCompilation?: boolean;

  /** Skip dependency installation (Quick scan only) */
  skipDependencyInstall?: boolean;

  /** Enable interactive questionnaires (Deep scan only) */
  interactive?: boolean;
}

/**
 * Definition of a single micro-step
 */
export interface StepDefinition {
  /** Unique step identifier */
  id: string;

  /** Display name */
  name: string;

  /** Detailed description */
  description: string;

  // --- Execution ---

  /** How to execute this step */
  executor: StepExecutorType;

  /** Configuration for the executor */
  executorConfig: StepExecutorConfig;

  // --- Timing ---

  /** Expected duration in seconds (target: 30-60s) */
  estimatedDurationSeconds: number;

  /** Maximum time before step is killed */
  timeoutSeconds: number;

  // --- Dependencies ---

  /** Step IDs that must complete before this step */
  dependsOn: string[];

  /** Data keys this step produces */
  provides: string[];

  /** Data keys this step requires from previous steps */
  requires: string[];

  // --- Classification ---

  /** Category for grouping and UI display */
  category: StepCategory;

  /** Whether this step uses AI (affects cost/latency) */
  aiAssisted: boolean;

  // --- Progress ---

  /** Weight for overall progress calculation (0-100) */
  progressWeight: number;

  // --- Failure Handling ---

  /** If true, audit fails if this step fails */
  required: boolean;

  /** Number of retry attempts on failure */
  retryCount: number;

  /** If true, continue to next step even on failure */
  continueOnFailure: boolean;
}

/**
 * Configuration passed to step executors
 */
export type StepExecutorConfig =
  | ToolExecutorConfig
  | DeterministicExecutorConfig
  | AIPromptExecutorConfig
  | InteractiveExecutorConfig
  | CompositeExecutorConfig;

export interface ToolExecutorConfig {
  type: 'tool';
  /** Tool name from registry */
  tool: string;
  /** CLI arguments */
  args?: string[];
  /** Parser function name for output */
  parseOutput?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Use Docker if CLI unavailable */
  dockerFallback?: boolean;
}

export interface DeterministicExecutorConfig {
  type: 'deterministic';
  /** Function name to call from step executors */
  function: string;
  /** Additional parameters */
  params?: Record<string, any>;
}

export interface AIPromptExecutorConfig {
  type: 'ai-prompt';
  /** Prompt template name or inline prompt */
  prompt: string;
  /** Model to use (default: claude-opus-4-5-20251101) */
  model?: string;
  /** Max tokens for response */
  maxTokens?: number;
  /** Temperature (0-1) */
  temperature?: number;
}

export interface InteractiveExecutorConfig {
  type: 'interactive';
  /** Function name to call from interactive step executors */
  function: string;
  /** Whether this step blocks audit progress until answered */
  blocking?: boolean;
  /** Timeout in milliseconds for user response */
  timeout?: number;
}

export interface CompositeExecutorConfig {
  type: 'composite';
  /** Sub-step IDs to execute */
  subSteps: string[];
  /** Execute in parallel or sequence */
  mode: 'parallel' | 'sequential';
}

/**
 * External tool requirement
 */
export interface ToolRequirement {
  /** Tool name */
  name: string;

  /** CLI command to check availability */
  command: string;

  /** Minimum version required */
  minVersion?: string;

  /** How to install if missing */
  installCommand?: string;

  /** Docker image to use if CLI unavailable */
  dockerFallback?: string;
}

// ============================================================================
// Step Execution Types
// ============================================================================

/**
 * Context passed to step executors
 */
export interface StepContext {
  /** Audit job information */
  job: {
    id: string;
    userId?: string;
    projectId?: string;
    auditDepth: AuditDepth;
  };

  /** SOP being executed */
  sop: SOPDefinition;

  /** Path to project workspace */
  projectPath: string;

  /** Data from previous steps (key -> value) */
  data: Record<string, any>;

  /** Available tools that passed availability check */
  availableTools: string[];

  /** Progress callback */
  onProgress?: (pct: number, message: string) => void;
}

/**
 * Result from step execution
 */
export interface StepResult {
  /** Whether step completed successfully */
  success: boolean;

  /** Output data (stored in context.data) */
  data?: Record<string, any>;

  /** Error message if failed */
  error?: string;

  /** Execution duration in milliseconds (optional, set by orchestrator) */
  durationMs?: number;

  /** Any warnings generated */
  warnings?: string[];

  /** Findings produced by this step */
  findings?: StepFinding[];
}

/**
 * A finding produced by a step (tool or AI)
 */
export interface StepFinding {
  /** Source step ID */
  stepId: string;

  /** Source tool name (if tool step) */
  tool?: string;

  /** Finding ID for deduplication */
  findingId: string;

  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';

  /** Finding title */
  title: string;

  /** Detailed description */
  description: string;

  /** File and line location */
  location?: {
    file: string;
    line?: number;
    column?: number;
  };

  /** Recommended fix */
  recommendation?: string;

  /** Confidence score (0-1) */
  confidence?: number;

  /** Raw output from tool */
  rawOutput?: any;
}

// ============================================================================
// Progress Tracking Types
// ============================================================================

/**
 * Micro-step progress update
 */
export interface MicroStepProgress {
  /** Job ID */
  jobId: string;

  /** Overall percentage (0-100) */
  overallPct: number;

  /** Current step info */
  currentStep: {
    id: string;
    name: string;
    category: StepCategory;
    pct: number;
    message: string;
    startedAt: Date;
  } | null;

  /** All steps with status */
  steps: Array<{
    id: string;
    name: string;
    category: StepCategory;
    status: StepStatus;
    durationMs?: number;
    error?: string;
  }>;

  /** Timing */
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;

  /** SOP info */
  sopId: string;
  sopVersion: string;
  auditDepth: AuditDepth;

  /** Framework detection */
  detectedFramework?: Framework;
  detectedLanguage?: Language;
}

// ============================================================================
// Tool Wrapper Types
// ============================================================================

/**
 * Tool registry entry
 */
export interface ToolRegistryEntry {
  /** Tool display name */
  name: string;

  /** CLI command to check version */
  checkCommand: string;

  /** Runner function */
  runner: (config: ToolRunnerConfig) => Promise<ToolRunnerResult>;

  /** Parser function for output */
  parser: (output: any) => StepFinding[];

  /** Docker image fallback */
  dockerImage?: string;
}

/**
 * Configuration for tool runner
 */
export interface ToolRunnerConfig {
  /** Project path */
  projectPath: string;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Use Docker if CLI unavailable */
  dockerFallback?: boolean;

  /** Command to run (e.g., 'build', 'test', 'compile') */
  command?: string;

  /** Additional CLI arguments */
  args?: string[];

  /** Environment variables */
  env?: Record<string, string>;

  /** Progress callback */
  onProgress?: (pct: number, message: string) => void;
}

/**
 * Result from tool execution
 */
export interface ToolRunnerResult {
  /** Whether tool executed successfully */
  success: boolean;

  /** Parsed findings */
  findings: StepFinding[];

  /** Raw stdout */
  stdout?: string;

  /** Raw stderr */
  stderr?: string;

  /** Exit code */
  exitCode?: number;

  /** Execution time in milliseconds */
  executionTimeMs: number;

  /** Tool version used */
  toolVersion?: string;

  /** Error message if failed */
  error?: string;
}

// ============================================================================
// Source Input Types
// ============================================================================

export type SourceInput = GitHubRepoInput | DeployedContractInput | ManualUploadInput;

export interface GitHubRepoInput {
  type: 'github-repo';
  repoUrl: string;
  branch: string;
  accessToken?: string;
  selectedFiles?: string[];
}

export interface DeployedContractInput {
  type: 'deployed-contract';
  address: string;
  network: string;
  workspacePath: string;
}

export interface ManualUploadInput {
  type: 'manual-upload';
  uploadId: string;
  workspacePath: string;
}

// ============================================================================
// Unified Audit Options
// ============================================================================

export interface UnifiedAuditOptions {
  /** Audit depth */
  depth: AuditDepth;

  /** User ID */
  userId?: string;

  /** Project ID */
  projectId?: string;

  /** Visibility of audit results */
  visibility?: 'private' | 'public' | 'unlisted';

  /** Callbacks */
  onStepStart?: (stepId: string, stepName: string) => void;
  onStepProgress?: (stepId: string, pct: number, message: string) => void;
  onStepComplete?: (stepId: string, result: StepResult) => void;
  onStepFailed?: (stepId: string, error: string) => void;
}

// ============================================================================
// Step Config Type Aliases (for step executors)
// ============================================================================

/** Alias for deterministic step configuration */
export type DeterministicStepConfig = DeterministicExecutorConfig;

/** Alias for tool step configuration */
export type ToolStepConfig = ToolExecutorConfig;

/** Alias for AI prompt step configuration */
export type AIPromptStepConfig = AIPromptExecutorConfig;

/** Alias for interactive step configuration */
export type InteractiveStepConfig = InteractiveExecutorConfig;

/** Alias for composite step configuration */
export type CompositeStepConfig = CompositeExecutorConfig;
