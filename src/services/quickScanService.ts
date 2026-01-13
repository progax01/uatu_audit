/**
 * Quick Scan Service
 *
 * Performs comprehensive security analysis using Claude CLI.
 * One-shot deep analysis that extracts maximum value from the contract.
 */

import { executeStreamingClaude, isClaudeAvailable } from './ai/simpleClaudeExecutor.js';
import { logger } from '../utils/logger.js';
import fs from 'fs-extra';
import path from 'path';

const log = logger.child({ service: 'quick-scan' });

export interface QuickScanInput {
  contractName: string;
  sourceCode: string;
  network: string;
  address: string;
  compiler?: string;
  optimization?: boolean;
  runs?: number;
  workspacePath?: string; // For large contracts, let Claude read files directly
  onProgress?: (phase: string, pct: number, message: string) => void;
  onLog?: (line: string) => void;
}

export interface QuickScanVulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  location?: string;
  recommendation: string;
  cweId?: string;
  impact?: string;
}

export interface QuickScanResult {
  success: boolean;
  score: number;
  grade: string;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
  vulnerabilities: QuickScanVulnerability[];
  summary: string;
  scanDuration: number;
  contractAnalysis?: {
    purpose: string;
    architecture: string;
    dependencies: string[];
    accessControl: string;
    stateVariables: number;
    functions: number;
    externalCalls: number;
    sloc: number;
  };
  gasOptimizations?: Array<{
    location: string;
    issue: string;
    suggestion: string;
    estimatedSavings?: string;
  }>;
  bestPractices?: Array<{
    category: string;
    status: 'pass' | 'fail' | 'warning';
    details: string;
  }>;
  error?: string;
}

// Comprehensive system prompt for one-shot deep analysis
const QUICK_SCAN_SYSTEM_PROMPT = `You are an elite smart contract security auditor performing a comprehensive one-shot security analysis.

ANALYSIS METHODOLOGY:
1. First, deeply understand the contract's purpose, architecture, and business logic
2. Map all state variables, functions, modifiers, and their interactions
3. Trace all external calls, token transfers, and state changes
4. Identify trust boundaries and access control mechanisms
5. Check for common vulnerability patterns with full context awareness
6. Analyze gas efficiency and optimization opportunities
7. Evaluate code quality and best practices

VULNERABILITY CATEGORIES TO ANALYZE:

**Critical (Immediate fund loss risk):**
- Reentrancy (single-function, cross-function, cross-contract)
- Unprotected selfdestruct/delegatecall
- Access control bypass (missing/incorrect modifiers)
- Arithmetic overflow/underflow (pre-0.8.0 without SafeMath)
- Signature replay attacks
- Flash loan attack vectors

**High (Significant financial/operational risk):**
- Oracle manipulation
- Price manipulation via sandwich attacks
- Unchecked external call returns
- Front-running vulnerabilities
- Incorrect inheritance order
- Storage collision in proxies

**Medium (Moderate risk):**
- Timestamp dependence for critical logic
- Block.number dependence
- Denial of Service vectors (unbounded loops, gas griefing)
- Centralization risks
- Insufficient event logging
- Missing zero-address checks

**Low (Minor issues):**
- Gas inefficiencies
- Code style issues
- Missing NatSpec documentation
- Redundant code
- Suboptimal patterns

**Informational:**
- Best practice recommendations
- Code organization suggestions
- Potential future risks

OUTPUT FORMAT (strict JSON, no markdown):
{
  "score": <number 0-100>,
  "riskLevel": "<CRITICAL|HIGH|MEDIUM|LOW|SAFE>",
  "summary": "<3-4 sentence executive summary>",
  "contractAnalysis": {
    "purpose": "<what this contract does>",
    "architecture": "<contract pattern: proxy, factory, vault, etc>",
    "dependencies": ["<external contracts/libraries used>"],
    "accessControl": "<access control pattern description>",
    "stateVariables": <count>,
    "functions": <count>,
    "externalCalls": <count>,
    "sloc": <source lines of code>
  },
  "vulnerabilities": [
    {
      "id": "<V-001, V-002, etc>",
      "severity": "<critical|high|medium|low|info>",
      "title": "<concise title>",
      "description": "<detailed technical description>",
      "location": "<function name or line range>",
      "impact": "<what could happen if exploited>",
      "recommendation": "<specific fix with code example if applicable>",
      "cweId": "<CWE ID if applicable>"
    }
  ],
  "gasOptimizations": [
    {
      "location": "<function or variable>",
      "issue": "<what's inefficient>",
      "suggestion": "<how to optimize>",
      "estimatedSavings": "<gas savings estimate>"
    }
  ],
  "bestPractices": [
    {
      "category": "<Checks-Effects-Interactions|Access Control|Event Logging|Input Validation|etc>",
      "status": "<pass|fail|warning>",
      "details": "<explanation>"
    }
  ]
}

SCORING GUIDE:
- 90-100 (SAFE): No critical/high, max 2 medium, exemplary code
- 75-89 (LOW): No critical, max 1 high or 3 medium
- 50-74 (MEDIUM): No critical, up to 2 high or multiple medium
- 25-49 (HIGH): 1 critical or 3+ high severity
- 0-24 (CRITICAL): Multiple critical vulnerabilities

IMPORTANT:
- Be thorough but precise - no false positives
- Consider the Solidity version and its implications
- Account for compiler optimizations if enabled
- Analyze the full attack surface including MEV
- Output ONLY valid JSON - no explanations outside JSON

PROGRESS REPORTING:
Throughout your analysis, output status markers to show progress. Use this exact format:
[UATU_STATUS:PHASE:PERCENTAGE:MESSAGE]

Phases to report (in order):
1. CONTRACT_PARSE - After reading and parsing the contract structure
2. SYMBOLIC_ANALYSIS - During variable, type, and modifier analysis
3. CONTROL_FLOW - While building the function call graph
4. REENTRANCY - When checking reentrancy patterns
5. ACCESS_CONTROL - During permission and role analysis
6. VULNERABILITY_SCAN - While enumerating all findings
7. REPORT_GEN - When generating final JSON output

Example usage:
[UATU_STATUS:CONTRACT_PARSE:100:Parsed 2099 lines across 12 contracts]
[UATU_STATUS:SYMBOLIC_ANALYSIS:50:Analyzing 45 state variables]
[UATU_STATUS:REENTRANCY:100:Checked 8 external calls for reentrancy]

Output these markers as you progress. The final JSON should come after all status markers.`;

/**
 * Perform a comprehensive quick security scan on a smart contract
 */
export async function performQuickScan(input: QuickScanInput): Promise<QuickScanResult> {
  const startTime = Date.now();
  const isFileBased = !!input.workspacePath && !input.sourceCode;

  log.info('Starting comprehensive quick scan', {
    contractName: input.contractName,
    network: input.network,
    address: input.address,
    sourceLength: input.sourceCode?.length || 0,
    compiler: input.compiler,
    mode: isFileBased ? 'file-based' : 'inline',
    workspacePath: input.workspacePath,
  });

  // Check if Claude CLI is available
  if (!isClaudeAvailable()) {
    log.error('Claude CLI not available');
    return {
      success: false,
      score: 0,
      grade: 'F',
      riskLevel: 'CRITICAL',
      vulnerabilities: [],
      summary: 'Quick scan unavailable - Claude CLI not installed',
      scanDuration: Date.now() - startTime,
      error: 'Claude CLI not found. Install: npm install -g @anthropic-ai/claude-code'
    };
  }

  let userPrompt: string;

  if (isFileBased) {
    // For large contracts, let Claude read files directly
    userPrompt = `You are analyzing a smart contract for security vulnerabilities.

CONTRACT METADATA:
- Name: ${input.contractName}
- Network: ${input.network}
- Address: ${input.address}
- Compiler: ${input.compiler || 'Unknown'}
- Optimization: ${input.optimization !== undefined ? (input.optimization ? `Enabled (${input.runs} runs)` : 'Disabled') : 'Unknown'}

The contract source files are in the ./contracts directory. Use the Read tool to read the Solidity files and analyze them.

IMPORTANT:
1. First, list files in ./contracts to find all .sol files
2. Read each Solidity file to understand the contract
3. Perform comprehensive security analysis
4. Return results in the specified JSON format

Output ONLY the JSON response at the end.`;
  } else {
    // For small contracts, pass code inline
    let sourceCode = input.sourceCode;
    const maxSourceLength = 150000;
    if (sourceCode.length > maxSourceLength) {
      log.warn('Source code truncated for quick scan', {
        original: sourceCode.length,
        truncated: maxSourceLength
      });
      sourceCode = sourceCode.slice(0, maxSourceLength) + '\n\n// ... truncated (contract too large) ...';
    }

    userPrompt = `Analyze this smart contract for security vulnerabilities, gas optimizations, and best practices.

CONTRACT METADATA:
- Name: ${input.contractName}
- Network: ${input.network}
- Address: ${input.address}
- Compiler: ${input.compiler || 'Unknown'}
- Optimization: ${input.optimization !== undefined ? (input.optimization ? `Enabled (${input.runs} runs)` : 'Disabled') : 'Unknown'}

SOURCE CODE:
\`\`\`solidity
${sourceCode}
\`\`\`

Perform a comprehensive security analysis and return results in the specified JSON format. Think deeply about:
1. How state changes flow through the contract
2. Where funds can enter and exit
3. Who has privileged access and what they can do
4. What external dependencies exist and their trust assumptions
5. Potential MEV and front-running opportunities

Output ONLY the JSON response.`;
  }

  // Combine system prompt and user prompt
  const fullPrompt = `${QUICK_SCAN_SYSTEM_PROMPT}

---

${userPrompt}`;

  try {
    const response = await executeStreamingClaude(fullPrompt, {
      timeout: 600000, // 10 minutes for Opus deep analysis
      model: 'claude-opus-4-5-20251101',
      cwd: input.workspacePath, // Set working directory for file-based analysis
      onProgress: input.onProgress,
      onLog: input.onLog,
    });

    if (!response.success) {
      throw new Error(response.error || 'Claude CLI execution failed');
    }

    // Parse the JSON response
    let result: any;
    try {
      // Clean the response - remove any markdown code blocks if present
      let cleanOutput = response.output || '';
      cleanOutput = cleanOutput.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      // Find JSON in output (sometimes there's text before/after)
      const jsonMatch = cleanOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError: any) {
      log.error('Failed to parse Claude response', {
        output: response.output?.slice(0, 1000),
        error: parseError.message
      });
      throw new Error(`Invalid response format: ${parseError.message}`);
    }

    const scanDuration = Date.now() - startTime;

    // Determine grade from score
    const score = Math.max(0, Math.min(100, result.score || 0));
    const grade = scoreToGrade(score);

    log.info('Quick scan complete', {
      contractName: input.contractName,
      score,
      grade,
      vulnerabilityCount: result.vulnerabilities?.length || 0,
      scanDuration
    });

    return {
      success: true,
      score,
      grade,
      riskLevel: result.riskLevel || determineRiskLevel(score),
      vulnerabilities: (result.vulnerabilities || []).map((v: any, i: number) => ({
        id: v.id || `V-${String(i + 1).padStart(3, '0')}`,
        severity: v.severity || 'info',
        title: v.title || 'Unknown Issue',
        description: v.description || '',
        location: v.location,
        recommendation: v.recommendation || 'Review manually',
        cweId: v.cweId,
        impact: v.impact
      })),
      summary: result.summary || 'Analysis complete',
      scanDuration,
      contractAnalysis: result.contractAnalysis,
      gasOptimizations: result.gasOptimizations,
      bestPractices: result.bestPractices
    };
  } catch (error: any) {
    log.error('Quick scan failed', { error: error.message });
    return {
      success: false,
      score: 0,
      grade: 'F',
      riskLevel: 'CRITICAL',
      vulnerabilities: [],
      summary: 'Quick scan failed - please try again',
      scanDuration: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Convert score to letter grade
 */
function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Determine risk level from score
 */
function determineRiskLevel(score: number): QuickScanResult['riskLevel'] {
  if (score >= 90) return 'SAFE';
  if (score >= 75) return 'LOW';
  if (score >= 50) return 'MEDIUM';
  if (score >= 25) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Recursively find all .sol files in a directory
 */
async function findSolFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  if (!await fs.pathExists(dir)) {
    return results;
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await findSolFiles(fullPath);
      results.push(...nested);
    } else if (entry.name.endsWith('.sol')) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Load contract source from workspace
 */
export async function loadContractSource(workspacePath: string): Promise<string> {
  const contractsDir = path.join(workspacePath, 'contracts');

  if (!await fs.pathExists(contractsDir)) {
    throw new Error('No contracts directory found in workspace');
  }

  // Recursively find all .sol files
  const solFiles = await findSolFiles(contractsDir);

  if (solFiles.length === 0) {
    throw new Error('No Solidity files found in workspace');
  }

  log.info('Found Solidity files for quick scan', { count: solFiles.length, files: solFiles.map(f => path.basename(f)) });

  let source = '';
  for (const filePath of solFiles) {
    const relativePath = path.relative(contractsDir, filePath);
    const content = await fs.readFile(filePath, 'utf-8');
    source += `// File: ${relativePath}\n${content}\n\n`;
  }

  return source;
}

/**
 * Check if quick scan is available
 */
export function isQuickScanConfigured(): boolean {
  return isClaudeAvailable();
}
