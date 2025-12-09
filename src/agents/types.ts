/**
 * Domain Agent System Types
 * Defines interfaces for the multi-domain agent architecture
 */

export type DomainType = 'web3' | 'backend' | 'frontend';

export interface AuditContext {
  jobId: string;
  projectPath: string;
  projectContext: string;
  methodologies: string[];
  testStyle?: string;
  domain?: DomainType;
}

export interface Finding {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  confidence: number; // 0.0 - 1.0
  title: string;
  category: string;
  location: {
    file: string;
    line?: number;
    function?: string;
    contract?: string;
    endpoint?: string;
    component?: string;
  };
  description: string;
  code_snippet?: string;
  impact: string;
  exploit_scenario?: string;
  attack_vector?: string;
  economic_impact?: string;
  affected_contracts?: string[];
  recommendation: string;
  references?: string[];
  cwe?: string;
  swc?: string;
  test_artifact?: string;
  reasoning?: CoTReasoning;
}

export interface CoTReasoning {
  step: string;
  observation: string;
  hypothesis: string;
  validation: string | string[];
  conclusion: string;
  confidence: number;
  confidence_factors?: string[];
}

export interface TestArtifacts {
  foundry_tests?: FoundryTest[];
  k6_scripts?: K6Script[];
  cypress_tests?: CypressTest[];
  curl_commands?: CurlCommand[];
}

export interface FoundryTest {
  filename: string;
  related_finding: string;
  purpose: string;
  run_command: string;
  content: string;
}

export interface K6Script {
  filename: string;
  related_finding: string;
  purpose: string;
  run_command: string;
  content: string;
}

export interface CypressTest {
  filename: string;
  related_finding: string;
  purpose: string;
  run_command: string;
  content: string;
}

export interface CurlCommand {
  finding: string;
  vulnerability: string;
  command: string;
  expected_result: string;
}

export interface DomainFindings {
  domain: DomainType;
  findings: Finding[];
  metrics: {
    total_findings: number;
    by_severity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      info: number;
    };
    by_category: Record<string, number>;
    analysis_duration: number;
  };
  reasoning: CoTReasoning[];
}

export interface AgentResult {
  success: boolean;
  domain: DomainType;
  findings: DomainFindings;
  testArtifacts?: TestArtifacts;
  error?: string;
  executionTime: number;
}

export interface AgentMessage {
  from: DomainType;
  to: DomainType | 'broadcast';
  type: 'finding' | 'context' | 'request' | 'response';
  payload: any;
  timestamp: Date;
}

/**
 * Base Domain Agent Interface
 */
export interface DomainAgent {
  readonly name: string;
  readonly domain: DomainType;
  readonly supportedEcosystems: string[];
  readonly methodologies: string[];

  /**
   * Initialize the agent
   */
  initialize(context: AuditContext): Promise<void>;

  /**
   * Analyze the codebase for vulnerabilities
   */
  analyze(context: AuditContext): Promise<DomainFindings>;

  /**
   * Generate test artifacts for findings
   */
  generateTests(findings: Finding[]): Promise<TestArtifacts>;

  /**
   * Handle messages from other agents
   */
  handleMessage?(message: AgentMessage): Promise<void>;

  /**
   * Get agent capabilities
   */
  getCapabilities(): AgentCapabilities;
}

export interface AgentCapabilities {
  canGenerateTests: boolean;
  canAnalyzeCode: boolean;
  canDetectFrameworks: boolean;
  supportedLanguages: string[];
  supportedFrameworks: string[];
}

/**
 * Master Orchestrator Interface
 */
export interface MasterOrchestrator {
  /**
   * Detect which domains are present in the project
   */
  detectDomains(projectPath: string): Promise<DomainType[]>;

  /**
   * Route audit to appropriate agent(s)
   */
  routeToAgent(domain: DomainType, context: AuditContext): Promise<AgentResult>;

  /**
   * Route to all detected agents
   */
  routeToAllAgents(context: AuditContext): Promise<AgentResult[]>;

  /**
   * Combine results from multiple agents
   */
  combineResults(results: AgentResult[]): UnifiedAuditReport;

  /**
   * Send message between agents
   */
  sendMessage(message: AgentMessage): Promise<void>;
}

export interface UnifiedAuditReport {
  schema_version: string;
  audit_report: {
    metadata: {
      target_system: string;
      repository?: string;
      commit_hash?: string;
      audit_domain: 'Web3' | 'Backend' | 'Frontend' | 'Multi-Domain';
      audit_depth: string;
      auditor_model: string;
      timestamp: string;
      duration_seconds: number;
      milestones_completed: string[];
    };
    executive_summary: {
      overall_risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      security_grade: 'A' | 'B' | 'C' | 'D' | 'F';
      score: number;
      critical_count: number;
      high_count: number;
      total_findings: number;
      key_concerns: string[];
      business_impact: string;
      recommendation: string;
    };
    milestone_summary?: any;
    findings: {
      summary: {
        total: number;
        by_severity: {
          critical: number;
          high: number;
          medium: number;
          low: number;
          info: number;
        };
        by_category: Record<string, number>;
        by_confidence?: Record<string, number>;
      };
      critical: Finding[];
      high: Finding[];
      medium: Finding[];
      low: Finding[];
      info: Finding[];
      static_analysis?: Finding[];
      logic_analysis?: Finding[];
    };
    reasoning?: CoTReasoning[];
    tooling_artifacts?: TestArtifacts;
    score: {
      value: number;
      grade: 'A' | 'B' | 'C' | 'D' | 'F';
      calculation?: string;
      breakdown: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
      };
      risk_assessment?: {
        overall_risk: string;
        exploitability: string;
        impact: string;
        likelihood: string;
      };
    };
    recommendations?: {
      immediate?: any[];
      short_term?: any[];
      long_term?: string[];
      security_best_practices?: string[];
    };
    conclusion?: {
      summary: string;
      deployment_readiness: 'READY' | 'NEEDS WORK' | 'NOT READY';
      required_actions_before_launch?: string[];
      estimated_remediation_time?: string;
    };
  };
}
