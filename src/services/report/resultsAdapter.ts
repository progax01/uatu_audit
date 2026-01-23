/**
 * Results Adapter Layer
 *
 * Transforms between different audit result formats:
 * - Old Format: analysis.findings (array)
 * - New Format (Milestone Framework): findings object (severity-grouped)
 *
 * Provides a unified interface for the report generator.
 */

import { logger } from '../../utils/logger.js';

const log = logger.child({ service: 'results-adapter' });

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Finding structure (common across all formats)
 */
export interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'undeclared';
  category: string;
  title: string;
  description: string;
  file?: string;
  line?: number;
  code_snippet?: string;
  recommendation?: string;
  impact?: string;
  likelihood?: string;
  references?: string[];
  originalSeverity?: string;
  severityAdjustmentReason?: string;
  tenthManAnalysis?: any;
}

/**
 * Score structure
 */
export interface Score {
  value: number;
  grade: string;
  breakdown?: {
    critical_count?: number;
    high_count?: number;
    medium_count?: number;
    low_count?: number;
    info_count?: number;
  };
}

/**
 * Metadata structure
 */
export interface Metadata {
  repo: string;
  branch: string;
  timestamp: string;
  duration_seconds?: number;
  status?: string;
  framework?: string;
  milestones_completed?: number;
}

/**
 * Unified results format (output of adapter)
 */
export interface UnifiedResults {
  metadata: Metadata;
  analysis: {
    contracts_analyzed: number;
    total_findings: number;
    findings: Finding[];
  };
  score: Score;
  recommendations: string[];
  // Optional fields preserved from either format
  tests_generated?: any;
  contracts_explained?: any[];
  test_methodology?: any;
  user_flows?: any[];
  test_results?: any[];
  executive_summary?: any;
  milestone_summary?: any;
  remediation_roadmap?: any;
  compliance_and_legal?: any;
  conclusion?: any;
  tooling_artifacts?: any;
  tenthManAnalyses?: any[];
  severityAdjustments?: any[];
}

/**
 * Old format (Parallel/Single Prompt Audit)
 */
interface OldFormatResults {
  metadata: Metadata;
  analysis: {
    contracts_analyzed: number;
    total_findings: number;
    findings: Finding[];
  };
  score: Score;
  recommendations?: string[];
  tests_generated?: any;
  contracts_explained?: any[];
  test_methodology?: any;
  user_flows?: any[];
  test_results?: any[];
  tenthManAnalyses?: any[];
  severityAdjustments?: any[];
}

/**
 * New format (Milestone Framework)
 */
interface MilestoneFormatResults {
  metadata: Metadata;
  findings: {
    summary: {
      total: number;
      critical?: number;
      high?: number;
      medium?: number;
      low?: number;
      info?: number;
    };
    critical?: Finding[];
    high?: Finding[];
    medium?: Finding[];
    low?: Finding[];
    info?: Finding[];
  };
  score: Score;
  recommendations?: string[];
  executive_summary?: any;
  milestone_summary?: any;
  remediation_roadmap?: any;
  compliance_and_legal?: any;
  conclusion?: any;
  tooling_artifacts?: any;
  tenthManAnalyses?: any[];
  severityAdjustments?: any[];
}

// ============================================================================
// FORMAT DETECTION
// ============================================================================

/**
 * Detect which format the results are in
 */
function detectFormat(raw: any): 'old' | 'milestone' | 'unknown' {
  // Old format: has analysis.findings as array
  if (raw.analysis && Array.isArray(raw.analysis.findings)) {
    log.debug('Detected OLD format (analysis.findings array)');
    return 'old';
  }

  // New milestone format: has findings as object with severity groups
  if (raw.findings && typeof raw.findings === 'object' && !Array.isArray(raw.findings)) {
    log.debug('Detected MILESTONE format (findings object with severity groups)');
    return 'milestone';
  }

  log.warn('Unknown results format detected', {
    hasAnalysis: !!raw.analysis,
    hasFindings: !!raw.findings,
    analysisType: raw.analysis ? typeof raw.analysis : 'undefined',
    findingsType: raw.findings ? typeof raw.findings : 'undefined',
    availableKeys: Object.keys(raw)
  });

  return 'unknown';
}

// ============================================================================
// ADAPTER FUNCTIONS
// ============================================================================

/**
 * Adapt old format to unified format
 */
function adaptOldFormat(raw: OldFormatResults): UnifiedResults {
  log.info('Adapting OLD format results', {
    totalFindings: raw.analysis?.total_findings || 0,
    score: raw.score?.value
  });

  return {
    metadata: raw.metadata,
    analysis: {
      contracts_analyzed: raw.analysis?.contracts_analyzed || 0,
      total_findings: raw.analysis?.total_findings || 0,
      findings: raw.analysis?.findings || []
    },
    score: raw.score || { value: 0, grade: 'N/A' },
    recommendations: raw.recommendations || [],
    tests_generated: raw.tests_generated,
    contracts_explained: raw.contracts_explained,
    test_methodology: raw.test_methodology,
    user_flows: raw.user_flows,
    test_results: raw.test_results,
    tenthManAnalyses: raw.tenthManAnalyses || [],
    severityAdjustments: raw.severityAdjustments || []
  };
}

/**
 * Adapt milestone format to unified format
 */
function adaptMilestoneFormat(raw: MilestoneFormatResults): UnifiedResults {
  log.info('Adapting MILESTONE format results', {
    totalFindings: raw.findings?.summary?.total || 0,
    score: raw.score?.value
  });

  // Flatten severity-grouped findings into single array
  const findings: Finding[] = [
    ...(raw.findings?.critical || []),
    ...(raw.findings?.high || []),
    ...(raw.findings?.medium || []),
    ...(raw.findings?.low || []),
    ...(raw.findings?.info || [])
  ];

  const totalFindings = raw.findings?.summary?.total || findings.length;
  const contractsAnalyzed = extractContractsAnalyzed(raw);

  log.debug('Flattened findings', {
    critical: raw.findings?.critical?.length || 0,
    high: raw.findings?.high?.length || 0,
    medium: raw.findings?.medium?.length || 0,
    low: raw.findings?.low?.length || 0,
    info: raw.findings?.info?.length || 0,
    totalFlattened: findings.length,
    declaredTotal: totalFindings
  });

  return {
    metadata: raw.metadata,
    analysis: {
      contracts_analyzed: contractsAnalyzed,
      total_findings: totalFindings,
      findings: findings
    },
    score: raw.score || { value: 0, grade: 'N/A' },
    recommendations: raw.recommendations || [],
    // Milestone format doesn't have tests_generated, provide safe default
    tests_generated: {
      behavioral: { count: 0, files: [] },
      stride: { count: 0, files: [] },
      owasp: { count: 0, files: [] }
    },
    executive_summary: raw.executive_summary,
    milestone_summary: raw.milestone_summary,
    remediation_roadmap: raw.remediation_roadmap,
    compliance_and_legal: raw.compliance_and_legal,
    conclusion: raw.conclusion,
    tooling_artifacts: raw.tooling_artifacts,
    tenthManAnalyses: raw.tenthManAnalyses || [],
    severityAdjustments: raw.severityAdjustments || []
  };
}

/**
 * Extract contracts_analyzed from milestone format
 * (may be in various places depending on milestone output)
 */
function extractContractsAnalyzed(raw: MilestoneFormatResults): number {
  // Check milestone_summary first
  if (raw.milestone_summary?.contracts_analyzed) {
    return raw.milestone_summary.contracts_analyzed;
  }

  // Check executive_summary
  if (raw.executive_summary?.contracts_analyzed) {
    return raw.executive_summary.contracts_analyzed;
  }

  // Fallback: count unique files in findings
  const uniqueFiles = new Set<string>();
  const findings = [
    ...(raw.findings?.critical || []),
    ...(raw.findings?.high || []),
    ...(raw.findings?.medium || []),
    ...(raw.findings?.low || [])
  ];

  findings.forEach(finding => {
    if (finding.file) {
      uniqueFiles.add(finding.file);
    }
  });

  return uniqueFiles.size || 1; // Default to 1 if no files found
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Main adapter function - transforms any format to unified format
 *
 * @param raw - Raw results from results.json
 * @returns Unified results format
 * @throws Error if format is unknown or invalid
 */
export function adaptResults(raw: any): UnifiedResults {
  log.info('Starting results adaptation', {
    hasMetadata: !!raw.metadata,
    hasScore: !!raw.score,
    topLevelKeys: Object.keys(raw)
  });

  // Validate required fields
  if (!raw.metadata) {
    throw new Error(
      'Invalid results.json - missing required "metadata" field. ' +
      `Available fields: ${JSON.stringify(Object.keys(raw))}`
    );
  }

  if (!raw.score) {
    throw new Error(
      'Invalid results.json - missing required "score" field. ' +
      `Available fields: ${JSON.stringify(Object.keys(raw))}`
    );
  }

  // Detect format
  const format = detectFormat(raw);

  // Adapt based on format
  switch (format) {
    case 'old':
      return adaptOldFormat(raw as OldFormatResults);

    case 'milestone':
      return adaptMilestoneFormat(raw as MilestoneFormatResults);

    case 'unknown':
      throw new Error(
        'Unknown results.json format. Expected either:\n' +
        '  - Old format: { analysis: { findings: [...] } }\n' +
        '  - Milestone format: { findings: { critical: [...], high: [...], ... } }\n' +
        `Got: ${JSON.stringify(Object.keys(raw))}\n` +
        `Analysis type: ${raw.analysis ? typeof raw.analysis : 'missing'}\n` +
        `Findings type: ${raw.findings ? typeof raw.findings : 'missing'}`
      );

    default:
      throw new Error(`Unexpected format detected: ${format}`);
  }
}

/**
 * Validate that adapted results are complete
 */
export function validateUnifiedResults(results: UnifiedResults): void {
  const errors: string[] = [];

  if (!results.metadata) {
    errors.push('Missing metadata');
  }

  if (!results.analysis) {
    errors.push('Missing analysis');
  } else {
    if (!Array.isArray(results.analysis.findings)) {
      errors.push('analysis.findings is not an array');
    }
    if (typeof results.analysis.total_findings !== 'number') {
      errors.push('analysis.total_findings is not a number');
    }
  }

  if (!results.score) {
    errors.push('Missing score');
  } else {
    if (typeof results.score.value !== 'number') {
      errors.push('score.value is not a number');
    }
    if (typeof results.score.grade !== 'string') {
      errors.push('score.grade is not a string');
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Unified results validation failed:\n` +
      errors.map(e => `  - ${e}`).join('\n')
    );
  }

  log.info('Unified results validation passed', {
    totalFindings: results.analysis.total_findings,
    score: results.score.value,
    grade: results.score.grade
  });
}

/**
 * Get format information for debugging
 */
export function getFormatInfo(raw: any): {
  format: 'old' | 'milestone' | 'unknown';
  hasAnalysis: boolean;
  hasFindings: boolean;
  findingsStructure: string;
  totalKeys: number;
} {
  return {
    format: detectFormat(raw),
    hasAnalysis: !!raw.analysis,
    hasFindings: !!raw.findings,
    findingsStructure: raw.findings
      ? Array.isArray(raw.findings)
        ? 'array'
        : typeof raw.findings === 'object'
          ? 'object'
          : typeof raw.findings
      : 'none',
    totalKeys: Object.keys(raw).length
  };
}
