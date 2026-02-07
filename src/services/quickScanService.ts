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

// Technical security check result
export interface TechnicalCheck {
  category: 'Contract Programming' | 'Code Specification' | 'Gas Optimization' | 'Business Risk';
  check: string;
  result: 'Passed' | 'Failed' | 'Warning' | 'N/A';
  details?: string;
}

// Business risk check result (honeypot/rug detection)
export interface BusinessRiskCheck {
  category: string;
  result: string; // "No", "Yes", "Not Detected", "0%", etc.
  severity: 'safe' | 'warning' | 'danger';
}

// Function analysis for AS-IS overview
export interface FunctionOverview {
  name: string;
  type: 'read' | 'write' | 'external' | 'internal' | 'constructor';
  visibility: 'public' | 'external' | 'internal' | 'private';
  observation: string;
  conclusion: 'No Issue' | 'Warning' | 'In Findings';
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
  // NEW: Comprehensive security checklist (Technical Quick Stats)
  technicalChecks?: TechnicalCheck[];
  // NEW: Business risk analysis (honeypot/rug detection)
  businessRiskChecks?: BusinessRiskCheck[];
  // NEW: Function-by-function overview (AS-IS analysis)
  functionOverview?: FunctionOverview[];
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

**CRITICAL: ADAPTIVE CHECKLIST CREATION**
After understanding the code, create a nested security checklist based on the contract type:

**If TOKEN CONTRACT (ERC20/ERC721/ERC1155):**
- Token minting controls (supply cap? who can mint? rate limits?)
- Transfer restrictions (blacklist? whitelist? pausable? cooldowns?)
- Fee mechanisms (buy/sell tax? caps? timelock for changes?)
- Burning mechanisms (who can burn? from any address or only holders?)
- Approval/allowance handling (proper checks? front-running protection?)
- Balance manipulation vectors
- **Read ALL code comments** - they often reveal intended behavior vs actual implementation

**If DEFI PROTOCOL (AMM/DEX/Lending/Staking):**
- Price oracle manipulation (TWAP? external oracle? manipulation vectors?)
- Flash loan attack vectors (reentrancy? price manipulation?)
- Liquidity provision/withdrawal logic (can users always exit? lock periods?)
- Reward calculation accuracy (rounding? precision loss? manipulation?)
- Collateral ratio enforcement (liquidation thresholds? oracle dependencies?)
- Slippage protection (user-specified minimums? sandwich attack prevention?)
- **Read TODO/FIXME comments** - unfinished security work is critical

**If VAULT/TREASURY (Yield/Governance/Multisig):**
- Admin rebalancing controls (who? when? safeguards? timelocks?)
- Fund withdrawal restrictions (cooldowns? limits? governance?)
- Strategy execution permissions (who can change? emergency pause?)
- Deposit/withdrawal fee structures (capped? disclosed? fair?)
- Emergency withdrawal mechanisms (user protection vs admin control?)
- **Read @audit comments** - previous audit findings or known issues

**If PROXY/UPGRADEABLE:**
- Upgrade authorization (multisig? timelock? governance?)
- Storage collision risks (inheritance order? variable layout?)
- Initialization protection (can't be re-initialized?)
- Function selector clashing
- Delegatecall safety
- **Read @notice/@dev comments** - upgrade procedures and risks

**CODE VERIFICATION RULES:**
1. **NEVER assume from function names** - Read the actual implementation
2. **Check ACTUAL require() statements** - Don't guess at validation
3. **Verify claimed caps in code** - Comment says "10% max" but is require() there?
4. **Read inline comments** - They reveal intent, TODOs, and known issues
5. **Trace the full execution path** - Don't stop at the first function call
6. **Check modifier implementations** - onlyOwner might be broken
7. **Verify inheritance** - Parent contracts might have dangerous functions
8. **Look for commented-out code** - Previous bugs or removed safeguards

**EXAMPLE - VERIFY IN CODE:**
❌ WRONG: "Function name is setMaxFee so it probably sets a maximum"
✅ CORRECT: Read setMaxFee() body, verify it has require(_maxFee <= 1000)

❌ WRONG: "Comment says 24h timelock, marking as safe"
✅ CORRECT: Check if timelock variable is actually enforced in code

❌ WRONG: "Uses ReentrancyGuard so reentrancy is prevented"
✅ CORRECT: Check if modifier is ACTUALLY applied to vulnerable functions

VULNERABILITY CATEGORIES TO ANALYZE:

**Critical (Immediate fund loss risk):**
- Reentrancy (single-function, cross-function, cross-contract)
- Unprotected selfdestruct/delegatecall
- Access control bypass (missing/incorrect modifiers)
- Arithmetic overflow/underflow (pre-0.8.0 without SafeMath)
- Signature replay attacks
- Flash loan attack vectors
- **Fee manipulation with NO maximum limit - admin can set to 100% (honeypot risk)**
- **Blacklist can block all selling with no safeguards**

**High (Significant financial/operational risk):**
- Oracle manipulation
- Price manipulation via sandwich attacks
- Unchecked external call returns
- Front-running vulnerabilities
- Incorrect inheritance order
- Storage collision in proxies
- **Admin can change fees instantly without timelock (if fees can exceed 20%)**
- **Unlimited minting capability with no cap or disclosure**
- **Transfer restrictions that can trap user funds**

**Medium (Moderate risk):**
- Timestamp dependence for critical logic
- Block.number dependence
- Denial of Service vectors (unbounded loops, gas griefing)
- **Centralization risks ONLY if admin can act maliciously with no safeguards**
- Insufficient event logging for critical operations
- Missing zero-address checks
- **Fees between 10-20% but properly limited (disclose as warning)**
- **Pausable functionality without clear governance or timelock**

**Low (Minor issues):**
- Gas inefficiencies
- Code style issues
- Missing NatSpec documentation
- Redundant code
- Suboptimal patterns

**Informational (Disclosure, NOT vulnerabilities):**
- Best practice recommendations
- Code organization suggestions
- Potential future risks
- **Fees ≤10% with hardcoded maximum limits + timelock (normal business logic - NOT a vulnerability)**
- **Admin functions with proper timelocks (24h+) and hard limits (NOT vulnerabilities)**
- **Managed vault designs where admin rebalancing is intentional (NOT a vulnerability if disclosed)**
- **Revenue collection mechanisms with standard fee controls (NOT a vulnerability)**
- **Two-tier admin/owner access control that's properly implemented (NOT a vulnerability)**

**CRITICAL DISTINCTION - Centralization vs Vulnerability:**
- ✅ INFORMATIONAL: Admin can change fees BUT capped at ≤10% AND 24h timelock → This is disclosed business logic
- ❌ MEDIUM: Admin can change fees to 100% with no limit → This is a vulnerability
- ✅ INFORMATIONAL: Admin can rebalance funds in a managed vault with cooldowns → Expected behavior
- ❌ HIGH: Admin can steal all funds with no restrictions → This is a vulnerability
- ✅ INFORMATIONAL: Admin multisig controls revenue address with timelock → Standard treasury management
- ❌ MEDIUM: Admin can change revenue address instantly to any address → Risky

**DO NOT flag properly controlled admin functions as vulnerabilities. They are business/trust decisions.**

OUTPUT FORMAT (strict JSON, no markdown):
{
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
      "title": "<concise, specific title for ONE issue>",
      "description": "<detailed description of this SINGLE issue - NO numbered lists>",
      "location": "<specific function name or line range for this issue>",
      "impact": "<single focused impact statement - NO numbered lists>",
      "recommendation": "<single focused fix recommendation - NO numbered lists>",
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
  ],
  "technicalChecks": [
    {
      "category": "<Contract Programming|Code Specification|Gas Optimization|Business Risk>",
      "check": "<specific check name like 'Integer overflow protection' or 'Function visibility declared'>",
      "result": "<Passed|Failed|Warning|N/A>",
      "details": "<brief explanation if not Passed>"
    }
  ],
  "businessRiskChecks": [
    {
      "category": "<check name like 'Is Honeypot', 'Can Mint', 'Is Proxy', 'Hidden Owner', 'Self Destruction', 'Blacklist', 'Pause Mechanism', 'Buy Tax', 'Sell Tax'>",
      "result": "<No|Yes|Not Detected|0%|value>",
      "severity": "<safe|warning|danger>"
    }
  ],
  "functionOverview": [
    {
      "name": "<function name>",
      "type": "<read|write|external|internal|constructor>",
      "visibility": "<public|external|internal|private>",
      "observation": "<brief observation about the function - what issues if any>",
      "conclusion": "<No Issue|Warning|In Findings>"
    }
  ]
}

TECHNICAL CHECKS TO EVALUATE (include ALL relevant checks):
Contract Programming:
- Solidity version specified/appropriate
- Integer overflow/underflow protection
- Function input parameter validation
- Function access control management
- Critical operations have event logs
- Human/contract checks (if applicable)
- Fallback function handling
- Race condition protection
- Reentrancy protection

Code Specification:
- Function visibility explicitly declared
- Variable storage location explicitly declared
- No deprecated keywords/functions
- No unused code

Gas Optimization:
- No unbounded loops causing "out of gas"
- Efficient loop patterns
- Optimized storage usage
- Proper assert() vs require() usage

Business Risk:
- Maximum mintage limits (if applicable)
- Short address attack protection
- Double spend protection

BUSINESS RISK CHECKS TO EVALUATE (include ALL that apply):

**FEE EVALUATION RULES (CRITICAL - FOLLOW EXACTLY):**
When evaluating fees (buy tax, sell tax, withdrawal fee, etc.), you MUST check for hardcoded maximum limits:

1. **SAFE (severity: "safe")** - Fees with strict hardcoded limits:
   - Buy/Sell Tax: Capped at ≤10% (e.g., require(fee <= 1000) where 10000 = 100%)
   - Withdrawal Fee: Capped at ≤5% with proper bounds checking
   - Fee changes: Require timelock or cooldown period
   - Example result: "5%" or "Max 10%" (show the cap!)

2. **WARNING (severity: "warning")** - Fees with moderate limits:
   - Buy/Sell Tax: Capped at 11-20%
   - Withdrawal Fee: Capped at 6-10%
   - Fee changes: Admin can change but with reasonable limits
   - Example result: "10-20% (admin adjustable)"

3. **DANGER (severity: "danger")** - Honeypot indicators:
   - Fees with NO maximum limit (admin can set to 100%)
   - Fees > 20% or no upper bound checks
   - Hidden fee logic or obfuscated calculations
   - Fees can be changed instantly to block selling
   - Example result: "No limit (honeypot risk)"

**FEE DETECTION CHECKLIST:**
- Search for: buyFee, sellFee, transferTax, withdrawalFee, feePercent, taxRate
- Check for: require(fee <= maxFee), if (fee > MAX_FEE) revert, constant max definitions
- Look for: setBuyFee(), setSellFee(), setWithdrawalFee() functions and their bounds
- If fee variables exist but no max check found → DANGER
- If max limit found and reasonable (≤10%) → SAFE
- If max limit found but high (11-20%) → WARNING

**EXAMPLE FEE ANALYSIS:**

SAFE - Hardcoded 10% max:
  function setWithdrawalFee(uint256 _fee) external onlyOwner {
      require(_fee <= 1000, "Max 10%"); // 1000 out of 10000 basis points
      withdrawalFee = _fee;
  }
  → Result: "Max 10%" | severity: "safe"
  → NO vulnerability created (this is normal business logic)

DANGER - No limit, honeypot risk:
  function setWithdrawalFee(uint256 _fee) external onlyOwner {
      withdrawalFee = _fee; // Can be set to 100%!
  }
  → Result: "No limit (honeypot risk)" | severity: "danger"
  → MUST create a CRITICAL vulnerability: "Unlimited Fee Manipulation"

WARNING - High but limited:
  function setSellFee(uint256 _fee) external onlyOwner {
      require(_fee <= 2000, "Max 20%");
      sellFee = _fee;
  }
  → Result: "Max 20% (high)" | severity: "warning"
  → Create a MEDIUM vulnerability: "High Fee Limits Without Disclosure"

**OTHER BUSINESS RISKS:**
- Is Honeypot (Yes/No/Not Detected) - Mark "Yes" if fees unlimited or >50%
- Trading Cooldown (Yes/No/Not Detected)
- Can Pause Trade (Yes/No)
- Pause Transfer (Yes/No)
- Anti-whale mechanism (Yes/No/Not Detected)
- Anti-bot mechanism (Yes/No/Not Detected)
- Blacklist capability (Yes/No)
- Can Mint (Yes/No) - If unlimited minting → include in vulnerabilities
- Is Proxy (Yes/No)
- Can Take Ownership (Yes/No)
- Hidden Owner (Yes/No/Not Detected)
- Self Destruction (Yes/No/Not Detected)
- Centralization Risk Level (None/Low/Medium/High)

FUNCTION OVERVIEW:
List ALL public and external functions with their analysis status.

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
- **DO NOT flag properly limited fees (≤10% max) as vulnerabilities - they are normal business logic**
- **ONLY flag unlimited fees or fees >20% as vulnerabilities**
- **Always check for hardcoded maximum limits before flagging fee-related issues**

CRITICAL FORMATTING RULES FOR VULNERABILITIES:
- ONE issue per vulnerability entry - NEVER combine multiple issues into one card
- NEVER use numbered lists (1. 2. 3.) or bullet points in description, impact, or recommendation
- If you find multiple related issues (e.g., owner can do X, Y, and Z), create SEPARATE vulnerability entries for each
- Each vulnerability card should be focused and atomic - addressing exactly ONE security concern
- Write in clear prose paragraphs, not lists
- Example: Instead of "Owner can: (1) upgrade contract (2) pause operations (3) withdraw funds"
  Create THREE separate vulnerabilities: "Owner Can Upgrade Contract", "Owner Can Pause Operations", "Owner Can Withdraw Funds"

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

    // Calculate score deterministically from vulnerabilities (ignore AI's score)
    const vulnerabilities = result.vulnerabilities || [];
    const score = calculateScoreFromVulnerabilities(vulnerabilities);
    const grade = scoreToGrade(score);

    log.info('Quick scan complete', {
      contractName: input.contractName,
      score,
      grade,
      vulnerabilityCount: vulnerabilities.length,
      scanDuration,
      aiScore: result.score // Log AI's score for comparison
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
      bestPractices: result.bestPractices,
      // NEW: Comprehensive report data
      technicalChecks: result.technicalChecks,
      businessRiskChecks: result.businessRiskChecks,
      functionOverview: result.functionOverview
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
 * Calculate deterministic score from vulnerabilities
 * Uses weighted penalty system based on severity
 */
/**
 * Categorize vulnerability exploitability based on description
 * This helps differentiate immediate risks from theoretical/conditional risks
 */
function categorizeVulnerability(vuln: any): {
  category: 'immediate' | 'conditional' | 'theoretical';
  reason: string;
} {
  const text = `${vuln.title || ''} ${vuln.description || ''}`.toLowerCase();

  // Theoretical: Requires third-party to be malicious/compromised
  if (text.includes('if') && (
    text.includes('malicious') ||
    text.includes('compromised') ||
    text.includes('attacker') ||
    text.includes('if the') && (text.includes('psm') || text.includes('usdc') || text.includes('token'))
  )) {
    return {
      category: 'theoretical',
      reason: 'Requires third-party contract to be malicious/compromised'
    };
  }

  // Conditional: Requires specific conditions but not third-party malice
  if (text.includes('could potentially') ||
      text.includes('may be') ||
      text.includes('timing') ||
      text.includes('front-run') ||
      (text.includes('if') && !text.includes('malicious'))) {
    return {
      category: 'conditional',
      reason: 'Requires specific conditions or timing'
    };
  }

  // Immediate: Direct exploitable issue
  return {
    category: 'immediate',
    reason: 'Directly exploitable'
  };
}

function calculateScoreFromVulnerabilities(vulnerabilities: any[]): number {
  // Start at 100 (perfect score)
  let score = 100;

  // Base severity penalty weights (for IMMEDIATE risks)
  const BASE_PENALTIES = {
    critical: 25,  // Each critical finding removes 25 points
    high: 12,      // Reduced from 15 (was too harsh)
    medium: 5,     // Reduced from 8 (was way too harsh)
    low: 2,        // Reduced from 3 (was too harsh for info-level issues)
    info: 0        // Informational findings don't affect score
  };

  // Risk category multipliers
  const RISK_MULTIPLIERS = {
    immediate: 1.0,      // Full penalty - direct exploitability
    conditional: 0.6,    // 60% penalty - requires specific conditions
    theoretical: 0.3     // 30% penalty - requires third-party to be malicious
  };

  // Categorize and score each vulnerability
  for (const vuln of vulnerabilities) {
    const severity = vuln.severity?.toLowerCase() || 'info';

    // Skip info findings
    if (severity === 'info') continue;

    // Get base penalty
    const basePenalty = BASE_PENALTIES[severity as keyof typeof BASE_PENALTIES] || 0;

    // Categorize exploitability
    const { category, reason } = categorizeVulnerability(vuln);

    // Apply multiplier based on category
    const multiplier = RISK_MULTIPLIERS[category];
    const actualPenalty = basePenalty * multiplier;

    score -= actualPenalty;

    // Add scoring explanation to vulnerability (for transparency)
    vuln._scoringNote = {
      basePenalty,
      category,
      multiplier,
      actualPenalty: Math.round(actualPenalty * 10) / 10,
      reason
    };
  }

  // Floor at 0
  return Math.max(0, score);
}

/**
 * Convert score to letter grade (stricter thresholds)
 */
function scoreToGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 75) return 'C+';
  if (score >= 70) return 'C';
  if (score >= 65) return 'D+';
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
