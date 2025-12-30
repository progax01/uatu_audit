/**
 * UatuAudit Project Types
 *
 * Two-level hierarchy: Projects → Components
 * A project can contain multiple sources unified for comprehensive auditing.
 */

// ============================================================================
// PROJECT TYPES
// ============================================================================

export type ProjectType = 'full' | 'contract-only' | 'dapp-pentest' | 'library-audit';
export type ProjectStatus = 'draft' | 'configured' | 'awaiting-preaudit' | 'auditing' | 'completed';

// ============================================================================
// COMPONENT TYPES
// ============================================================================

export type ComponentType =
  | 'github-repo'
  | 'deployed-contract'
  | 'dapp-url'
  | 'library-source'
  | 'manual-upload';

export type ComponentStatus = 'pending' | 'synced' | 'error' | 'removed';

// ============================================================================
// PROJECT METADATA
// ============================================================================

/**
 * Unified Project - the top-level container
 */
export interface ProjectMetadata {
  // Identity
  id: string;                        // UUID v4
  slug: string;                      // URL-friendly name (auto-generated)
  name: string;                      // Human-readable name
  description?: string;

  // Ownership
  userId: string;                    // GitHub userId or 'anonymous' for manual
  organizationId?: string;           // Future: team/org support

  // Classification
  type: ProjectType;
  ecosystems: string[];              // ['foundry', 'hardhat', 'anchor', etc.]
  networks: string[];                // ['ethereum', 'arbitrum', 'polygon', etc.]

  // Components
  components: SourceComponent[];

  // Settings
  settings: ProjectSettings;

  // Metadata
  createdAt: string;                 // ISO timestamp
  updatedAt: string;
  lastAuditAt?: string;
  lastAuditJobId?: number;

  // Status
  status: ProjectStatus;
  auditCount: number;

  // Aggregated scores (from latest audits)
  aggregatedScore?: AggregatedScore;

  // Tags for organization
  tags?: string[];
}

/**
 * Aggregated security score across all components
 */
export interface AggregatedScore {
  value: number;                     // 0-100
  grade: string;                     // A-F
  severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    undeclared: number;              // Missing components - not scored
  };
  lastCalculated: string;
}

/**
 * Project audit settings
 */
export interface ProjectSettings {
  // Audit preferences
  testStyles: ('behavioral' | 'stride' | 'owasp')[];
  aiEnabled: boolean;
  auditDepth?: 'quick' | 'standard' | 'deep';

  // Scope restrictions
  includePaths?: string[];           // Glob patterns to include
  excludePaths?: string[];           // Glob patterns to exclude

  // Notifications
  notifications?: {
    email?: string[];
    slack?: string;
    webhook?: string;
  };

  // CI/CD integration
  cicdEnabled?: boolean;
  branchProtection?: {
    branches: string[];
    requireAudit: boolean;
    minimumScore: number;
  };
}

// ============================================================================
// SOURCE COMPONENTS
// ============================================================================

/**
 * Base source component - individual source within a project
 */
export interface SourceComponent {
  // Identity
  id: string;                        // UUID v4
  projectId: string;                 // Parent project reference

  // Type-specific data (discriminated union)
  type: ComponentType;
  config: ComponentConfig;

  // Status
  status: ComponentStatus;
  lastSyncAt?: string;
  syncError?: string;

  // Analysis results
  fingerprint?: ComponentFingerprint;

  // Metadata
  createdAt: string;
  updatedAt: string;

  // Display
  displayName: string;
  icon?: string;
}

/**
 * Union type for component configurations
 */
export type ComponentConfig =
  | GitHubRepoConfig
  | DeployedContractConfig
  | DAppUrlConfig
  | LibrarySourceConfig
  | ManualUploadConfig;

// ============================================================================
// COMPONENT CONFIG TYPES
// ============================================================================

/**
 * GitHub Repository Configuration
 */
export interface GitHubRepoConfig {
  type: 'github-repo';

  // Repository info
  owner: string;
  repo: string;
  fullName: string;                  // "owner/repo"
  cloneUrl: string;

  // Branch configuration
  defaultBranch: string;
  trackedBranches: string[];
  currentBranch?: string;            // Currently selected for audit

  // Access
  isPrivate: boolean;
  installationId?: number;           // GitHub App installation
  accessToken?: string;              // Encrypted token

  // Scope
  includePaths?: string[];
  excludePaths?: string[];
  selectedFiles?: string[];          // User-selected files for audit
}

/**
 * Deployed Contract Configuration
 */
export interface DeployedContractConfig {
  type: 'deployed-contract';

  // Contract identity
  address: string;                   // 0x... address
  network: string;                   // 'ethereum', 'arbitrum', etc.
  chainId: number;

  // Contract metadata (from explorer)
  contractName?: string;
  compiler?: string;
  optimizationEnabled?: boolean;
  runs?: number;
  isVerified: boolean;

  // Proxy detection
  isProxy: boolean;
  proxyType?: 'transparent' | 'uups' | 'beacon' | 'unknown';
  implementationAddress?: string;
  implementationName?: string;

  // Explorer links
  explorerUrl: string;
  explorerApiUrl?: string;

  // Source caching
  sourceCached: boolean;
  sourceHash?: string;
  sourceFiles?: string[];
}

/**
 * DApp URL Configuration (for penetration testing)
 */
export interface DAppUrlConfig {
  type: 'dapp-url';

  // URL info
  url: string;
  name: string;

  // Authentication
  authType?: 'none' | 'wallet' | 'api-key' | 'oauth';
  testWallets?: string[];

  // Scope
  crawlDepth?: number;               // Default: 3
  includePaths?: string[];
  excludePaths?: string[];
  allowedHosts?: string[];           // Additional hosts to crawl

  // Analysis flags
  checkContractInteractions: boolean;
  checkFrontendVulnerabilities: boolean;
  checkApiEndpoints: boolean;

  // Rate limiting
  maxRequestsPerSecond?: number;
}

/**
 * Open Source Library Configuration
 */
export interface LibrarySourceConfig {
  type: 'library-source';

  // Package info
  packageName: string;               // e.g., "@openzeppelin/contracts"
  version: string;
  registry: 'npm' | 'crates' | 'pypi' | 'github';

  // Source location
  sourceUrl?: string;
  gitUrl?: string;

  // Usage context
  usedBy: string[];                  // Component IDs that depend on this

  // Verification
  isAudited?: boolean;
  auditReportUrl?: string;
}

/**
 * Manual Upload Configuration (no GitHub required)
 */
export interface ManualUploadConfig {
  type: 'manual-upload';

  // Upload info
  uploadId: string;
  filename: string;
  fileType: 'zip' | 'tar' | 'tar.gz' | 'solidity' | 'directory';
  fileSize: number;

  // Extracted content
  extractedPath?: string;

  // Metadata
  uploadedAt: string;
  uploadedBy?: string;
  checksum?: string;
}

// ============================================================================
// FINGERPRINT
// ============================================================================

/**
 * Component fingerprint - analysis metadata from detection phase
 */
export interface ComponentFingerprint {
  // Ecosystem detection
  ecosystems: Array<{
    name: string;
    confidence: number;              // 0-1
    framework?: string;              // e.g., 'foundry', 'hardhat'
  }>;

  // File statistics
  stats: {
    totalFiles: number;
    totalLines: number;
    solidityFiles: number;
    rustFiles: number;
    typescriptFiles: number;
    javascriptFiles: number;
    testFiles: number;
  };

  // Dependencies detected
  dependencies: Array<{
    name: string;
    version?: string;
    type: 'npm' | 'solidity' | 'cargo' | 'pip';
  }>;

  // Contract-specific
  contracts?: Array<{
    name: string;
    file: string;
    isInterface: boolean;
    isLibrary: boolean;
    isAbstract: boolean;
  }>;

  // Hash for change detection
  contentHash: string;
  fingerprintedAt: string;
}

// ============================================================================
// PRE-AUDIT QUESTIONNAIRE TYPES
// ============================================================================

export type QuestionCategory =
  | 'THIRD_PARTY_DEPS'
  | 'ADMIN_CUSTODY'
  | 'ORACLE_TRUST'
  | 'EXTERNAL_INTEGRATION'
  | 'MISSING_SOURCE'
  | 'CROSS_CHAIN';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Pre-audit question option
 */
export interface QuestionOption {
  value: string;
  label: string;
  risk: RiskLevel;
  description?: string;
}

/**
 * Pre-audit question
 */
export interface PreAuditQuestion {
  id: string;
  category: QuestionCategory;
  componentId: string;
  componentLabel: string;
  question: string;
  options?: QuestionOption[];
  freeform?: boolean;
  suggestedScope: 'INTERNAL' | 'EXTERNAL';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  evidence: string;                  // Why we're asking this
}

/**
 * User's answer to a pre-audit question
 */
export interface PreAuditAnswer {
  questionId: string;
  selectedOption?: string;
  freeformResponse?: string;
  externalGithubUrl?: string;
  scopeOverride?: 'INTERNAL' | 'EXTERNAL';
  notes?: string;
  answeredAt: string;
}

/**
 * Evidence collected during pre-audit scan
 */
export interface PreAuditEvidence {
  fingerprint: ComponentFingerprint;
  scannerFindings: {
    slither?: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    semgrep?: {
      count: number;
      patterns: string[];
    };
  };
  detectedPatterns: {
    thirdPartyLibs: Array<{ name: string; version?: string; source: string; }>;
    adminPatterns: Array<{ file: string; line: number; pattern: string; }>;
    oracleUsage: Array<{ file: string; oracleType: string; }>;
    externalCalls: Array<{ file: string; callType: string; target: string; }>;
    missingRefs: Array<{ file: string; import: string; resolved: boolean; }>;
    walletPatterns: Array<{ file: string; type: string; }>;
  };
  riskHotspots: Array<{
    component: string;
    reason: string;
    suggestedScope: 'INTERNAL' | 'EXTERNAL';
  }>;
}

/**
 * Complete pre-audit questionnaire state
 */
export interface PreAuditQuestionnaire {
  version: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  evidenceSummary: PreAuditEvidence;
  questions: PreAuditQuestion[];
  answers: PreAuditAnswer[];
  scopeSummary: {
    likelyInternal: string[];
    likelyExternal: string[];
    needsClarification: string[];
  };
}

// ============================================================================
// UNDECLARED FINDINGS
// ============================================================================

/**
 * Undeclared component - referenced but not provided
 */
export interface UndeclaredComponent {
  id: string;
  name: string;
  componentType: 'backend' | 'frontend' | 'contract' | 'library' | 'external-api';
  referencedBy: Array<{
    file: string;
    line?: number;
    context: string;
  }>;
  reason: string;
}

// ============================================================================
// GUARDRAILS
// ============================================================================

export type ViolationType =
  | 'SCORE_MANIPULATION'
  | 'SOP_DEVIATION'
  | 'TEST_TAMPERING'
  | 'UNAUTHORIZED_REQUEST'
  | 'OUTPUT_FALSIFICATION';

/**
 * Guardrail violation record
 */
export interface GuardrailViolation {
  type: ViolationType;
  description: string;
  timestamp: string;
  blocked: boolean;
  context?: Record<string, unknown>;
}

/**
 * Audit trail entry
 */
export interface AuditTrailEntry {
  action: 'MILESTONE_COMPLETE' | 'FINDING_ADDED' | 'FINDING_MODIFIED' |
          'SCORE_CALCULATED' | 'REPORT_GENERATED' | 'USER_OVERRIDE_ATTEMPTED' |
          'GUARDRAIL_VIOLATION';
  timestamp: string;
  actor: 'SYSTEM' | 'USER' | 'CLAUDE';
  details: Record<string, unknown>;
  stateHash: string;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Project creation input
 */
export interface CreateProjectInput {
  name: string;
  description?: string;
  type: ProjectType;
  settings?: Partial<ProjectSettings>;
  tags?: string[];
}

/**
 * Component creation input
 */
export interface AddComponentInput {
  type: ComponentType;
  displayName?: string;
  config: Omit<ComponentConfig, 'type'>;
}

/**
 * Project index entry (for fast lookup)
 */
export interface ProjectIndexEntry {
  id: string;
  slug: string;
  name: string;
  userId: string;
  type: ProjectType;
  status: ProjectStatus;
  componentCount: number;
  lastAuditAt?: string;
  aggregatedScore?: number;
}

/**
 * Project index file structure
 */
export interface ProjectIndex {
  version: number;
  lastUpdated: string;
  projects: Record<string, ProjectIndexEntry>;
}
