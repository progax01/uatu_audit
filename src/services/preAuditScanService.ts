/**
 * Pre-Audit Scan Service
 *
 * Performs quick static analysis to collect evidence before generating
 * pre-audit questions. This runs BEFORE the user answers questions.
 *
 * Flow:
 * 1. User submits sources
 * 2. Quick Static Scan (Slither/Semgrep) ← This service
 * 3. Generate Smart Questions (Claude)
 * 4. PAUSE - User answers questions
 * 5. Apply answers → liability_map.json
 * 6. Deep Analysis (5 Milestones)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';
import type {
  PreAuditEvidence,
  ComponentFingerprint,
} from '../types/project.js';

const log = logger.child({ service: 'pre-audit-scan' });

// ============================================================================
// DETECTION PATTERNS
// ============================================================================

const REFERENCE_PATTERNS = {
  // API URLs (exclude localhost)
  apiUrls: /https?:\/\/(?!localhost)[a-zA-Z0-9.-]+(?:\/[a-zA-Z0-9/_-]*)?/g,
  // Backend endpoints
  backendEndpoints: /['"]\/api\/[a-zA-Z0-9/_-]+['"]/g,
  // Contract addresses
  contractAddresses: /0x[a-fA-F0-9]{40}/g,
  // Import statements
  importStatements: /import\s+.*from\s+['"]([^'"]+)['"]/g,
  // Require statements
  requireStatements: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
};

const ADMIN_PATTERNS = [
  /onlyOwner/g,
  /onlyAdmin/g,
  /requireAdmin/g,
  /msg\.sender\s*==\s*owner/g,
  /isOwner\s*\(/g,
  /hasRole\s*\(\s*[A-Z_]+_ROLE/g,
  /AccessControl/g,
  /Ownable/g,
  /renounceOwnership/g,
  /transferOwnership/g,
];

const ORACLE_PATTERNS = [
  /AggregatorV3Interface/g,
  /IChainlinkOracle/g,
  /latestRoundData/g,
  /getLatestPrice/g,
  /priceFeed/gi,
  /TWAP/gi,
  /UniswapV[23].*Oracle/gi,
  /consult\s*\(/g,
];

const EXTERNAL_CALL_PATTERNS = [
  /\.call\s*\{/g,
  /\.delegatecall\s*\(/g,
  /\.staticcall\s*\(/g,
  /IERC20\s*\(/g,
  /safeTransfer/g,
  /safeTransferFrom/g,
];

const WALLET_PATTERNS = [
  /window\.ethereum/g,
  /ethers\.providers/g,
  /web3\.eth/g,
  /useAccount\s*\(/g,
  /useConnect\s*\(/g,
  /wagmi/gi,
  /rainbowkit/gi,
  /metamask/gi,
  /walletconnect/gi,
];

// ============================================================================
// SCANNER INTERFACES
// ============================================================================

interface SlitherFinding {
  check: string;
  impact: string;
  confidence: string;
  description: string;
  elements: Array<{
    type: string;
    name: string;
    source_mapping?: {
      filename_relative?: string;
      lines?: number[];
    };
  }>;
}

interface SemgrepFinding {
  check_id: string;
  path: string;
  start: { line: number };
  extra: { message: string; severity: string };
}

// ============================================================================
// SCANNER EXECUTION
// ============================================================================

/**
 * Run Slither on the source directory
 */
async function runSlither(sourcePath: string): Promise<{
  critical: number;
  high: number;
  medium: number;
  low: number;
  findings: SlitherFinding[];
}> {
  return new Promise((resolve) => {
    const result = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      findings: [] as SlitherFinding[],
    };

    // Check if slither is available
    const slither = spawn('slither', [
      sourcePath,
      '--json', '-',
      '--exclude', 'naming-convention,solc-version,pragma',
    ], {
      cwd: sourcePath,
      timeout: 120000, // 2 minute timeout
    });

    let stdout = '';
    let stderr = '';

    slither.stdout.on('data', (data) => { stdout += data.toString(); });
    slither.stderr.on('data', (data) => { stderr += data.toString(); });

    slither.on('close', (code) => {
      try {
        if (stdout) {
          const parsed = JSON.parse(stdout);
          const detectors = parsed.results?.detectors || [];

          for (const d of detectors) {
            result.findings.push(d);
            const impact = (d.impact || '').toLowerCase();
            if (impact === 'high' || impact === 'critical') {
              result.critical++;
            } else if (impact === 'medium') {
              result.medium++;
            } else if (impact === 'low') {
              result.low++;
            } else {
              result.high++;
            }
          }
        }
      } catch (e) {
        log.debug('Slither parse error (may not be installed)', { error: e });
      }
      resolve(result);
    });

    slither.on('error', (err) => {
      log.debug('Slither not available', { error: err.message });
      resolve(result);
    });
  });
}

/**
 * Run Semgrep on the source directory
 */
async function runSemgrep(sourcePath: string): Promise<{
  count: number;
  patterns: string[];
  findings: SemgrepFinding[];
}> {
  return new Promise((resolve) => {
    const result = {
      count: 0,
      patterns: [] as string[],
      findings: [] as SemgrepFinding[],
    };

    const semgrep = spawn('semgrep', [
      '--config', 'auto',
      '--json',
      sourcePath,
    ], {
      cwd: sourcePath,
      timeout: 120000, // 2 minute timeout
    });

    let stdout = '';

    semgrep.stdout.on('data', (data) => { stdout += data.toString(); });

    semgrep.on('close', (code) => {
      try {
        if (stdout) {
          const parsed = JSON.parse(stdout);
          const findings = parsed.results || [];

          result.count = findings.length;
          const patternSet = new Set<string>();

          for (const f of findings) {
            result.findings.push(f);
            patternSet.add(f.check_id);
          }

          result.patterns = Array.from(patternSet);
        }
      } catch (e) {
        log.debug('Semgrep parse error (may not be installed)', { error: e });
      }
      resolve(result);
    });

    semgrep.on('error', (err) => {
      log.debug('Semgrep not available', { error: err.message });
      resolve(result);
    });
  });
}

// ============================================================================
// PATTERN DETECTION
// ============================================================================

interface PatternMatch {
  file: string;
  line?: number;
  pattern: string;
  context?: string;
}

interface ImportMatch {
  file: string;
  import: string;
  resolved: boolean;
}

/**
 * Scan files for patterns
 */
async function scanForPatterns(
  sourcePath: string,
  files: string[]
): Promise<{
  thirdPartyLibs: Array<{ name: string; version?: string; source: string }>;
  adminPatterns: PatternMatch[];
  oracleUsage: Array<{ file: string; oracleType: string }>;
  externalCalls: Array<{ file: string; callType: string; target: string }>;
  missingRefs: ImportMatch[];
  walletPatterns: Array<{ file: string; type: string }>;
}> {
  const result = {
    thirdPartyLibs: [] as Array<{ name: string; version?: string; source: string }>,
    adminPatterns: [] as PatternMatch[],
    oracleUsage: [] as Array<{ file: string; oracleType: string }>,
    externalCalls: [] as Array<{ file: string; callType: string; target: string }>,
    missingRefs: [] as ImportMatch[],
    walletPatterns: [] as Array<{ file: string; type: string }>,
  };

  const seenLibs = new Set<string>();

  for (const file of files) {
    const filePath = path.join(sourcePath, file);
    let content: string;

    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');

    // Check admin patterns
    for (const pattern of ADMIN_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const lineNum = lines.findIndex(l => l.includes(match)) + 1;
          result.adminPatterns.push({
            file,
            line: lineNum > 0 ? lineNum : undefined,
            pattern: match,
          });
        }
      }
    }

    // Check oracle patterns
    for (const pattern of ORACLE_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          result.oracleUsage.push({
            file,
            oracleType: match,
          });
        }
      }
    }

    // Check external call patterns
    for (const pattern of EXTERNAL_CALL_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          result.externalCalls.push({
            file,
            callType: match,
            target: 'external',
          });
        }
      }
    }

    // Check wallet patterns
    for (const pattern of WALLET_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          result.walletPatterns.push({
            file,
            type: match,
          });
        }
      }
    }

    // Check imports for third-party libraries
    const importMatches = content.matchAll(REFERENCE_PATTERNS.importStatements);
    for (const match of importMatches) {
      const importPath = match[1];
      if (importPath.startsWith('@') || !importPath.startsWith('.')) {
        // Third-party or node module
        const libName = importPath.startsWith('@')
          ? importPath.split('/').slice(0, 2).join('/')
          : importPath.split('/')[0];

        if (!seenLibs.has(libName)) {
          seenLibs.add(libName);
          result.thirdPartyLibs.push({
            name: libName,
            source: file,
          });
        }

        // Check if import resolves
        const resolves = await checkImportResolves(sourcePath, importPath);
        if (!resolves) {
          result.missingRefs.push({
            file,
            import: importPath,
            resolved: false,
          });
        }
      }
    }

    // Check contract addresses (potential external dependencies)
    const addressMatches = content.match(REFERENCE_PATTERNS.contractAddresses);
    if (addressMatches) {
      for (const addr of addressMatches) {
        result.externalCalls.push({
          file,
          callType: 'address-reference',
          target: addr,
        });
      }
    }

    // Check API URLs
    const apiMatches = content.match(REFERENCE_PATTERNS.apiUrls);
    if (apiMatches) {
      for (const url of apiMatches) {
        result.externalCalls.push({
          file,
          callType: 'api-url',
          target: url,
        });
      }
    }
  }

  return result;
}

/**
 * Check if an import path resolves
 */
async function checkImportResolves(
  sourcePath: string,
  importPath: string
): Promise<boolean> {
  // Check node_modules
  const nodeModulesPath = path.join(sourcePath, 'node_modules', importPath);
  try {
    await fs.access(nodeModulesPath);
    return true;
  } catch {
    // Not in node_modules
  }

  // Check lib folder (Foundry/Forge)
  const libPath = path.join(sourcePath, 'lib', importPath.replace('@', ''));
  try {
    await fs.access(libPath);
    return true;
  } catch {
    // Not in lib
  }

  return false;
}

// ============================================================================
// RISK ASSESSMENT
// ============================================================================

interface RiskHotspot {
  component: string;
  reason: string;
  suggestedScope: 'INTERNAL' | 'EXTERNAL';
}

/**
 * Analyze evidence to identify risk hotspots
 */
function assessRiskHotspots(
  patterns: Awaited<ReturnType<typeof scanForPatterns>>,
  slitherResults: Awaited<ReturnType<typeof runSlither>>,
  fingerprint: ComponentFingerprint
): RiskHotspot[] {
  const hotspots: RiskHotspot[] = [];

  // Admin patterns are high risk
  if (patterns.adminPatterns.length > 0) {
    hotspots.push({
      component: 'access-control',
      reason: `Found ${patterns.adminPatterns.length} admin/owner patterns - need to clarify custody model`,
      suggestedScope: 'INTERNAL',
    });
  }

  // Oracle usage needs clarification
  if (patterns.oracleUsage.length > 0) {
    const oracleTypes = [...new Set(patterns.oracleUsage.map(o => o.oracleType))];
    hotspots.push({
      component: 'price-oracle',
      reason: `Uses price oracles (${oracleTypes.join(', ')}) - need to clarify trust assumptions`,
      suggestedScope: 'EXTERNAL',
    });
  }

  // External calls need verification
  const addressRefs = patterns.externalCalls.filter(e => e.callType === 'address-reference');
  if (addressRefs.length > 0) {
    hotspots.push({
      component: 'external-contracts',
      reason: `References ${addressRefs.length} external contract addresses`,
      suggestedScope: 'EXTERNAL',
    });
  }

  // API endpoints indicate backend dependency
  const apiCalls = patterns.externalCalls.filter(e => e.callType === 'api-url');
  if (apiCalls.length > 0) {
    hotspots.push({
      component: 'backend-api',
      reason: `Calls ${apiCalls.length} external API endpoints - backend code may be missing`,
      suggestedScope: 'EXTERNAL',
    });
  }

  // Missing imports are risks
  if (patterns.missingRefs.length > 0) {
    hotspots.push({
      component: 'missing-dependencies',
      reason: `${patterns.missingRefs.length} imports could not be resolved`,
      suggestedScope: 'EXTERNAL',
    });
  }

  // Third-party libs need verification
  if (patterns.thirdPartyLibs.length > 5) {
    hotspots.push({
      component: 'third-party-deps',
      reason: `Uses ${patterns.thirdPartyLibs.length} third-party libraries - need to verify audit status`,
      suggestedScope: 'EXTERNAL',
    });
  }

  // Critical slither findings
  if (slitherResults.critical > 0 || slitherResults.high > 0) {
    hotspots.push({
      component: 'static-analysis',
      reason: `Slither found ${slitherResults.critical} critical and ${slitherResults.high} high severity issues`,
      suggestedScope: 'INTERNAL',
    });
  }

  // Frontend wallet integration
  if (patterns.walletPatterns.length > 0) {
    hotspots.push({
      component: 'frontend-wallet',
      reason: `Frontend has wallet integration - may need frontend security review`,
      suggestedScope: 'EXTERNAL',
    });
  }

  return hotspots;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Run pre-audit scan on a source directory
 *
 * @param sourcePath - Path to the source code
 * @param fingerprint - Component fingerprint from detection phase
 * @returns PreAuditEvidence with scan results
 */
export async function runPreAuditScan(
  sourcePath: string,
  fingerprint: ComponentFingerprint
): Promise<PreAuditEvidence> {
  log.info('Starting pre-audit scan', { sourcePath });

  // Get list of files to scan
  const solidityFiles: string[] = [];
  const jstsFiles: string[] = [];

  for (const eco of fingerprint.ecosystems) {
    // This will be populated from fingerprint stats
  }

  // Recursively find files
  async function findFiles(dir: string, pattern: RegExp): Promise<string[]> {
    const files: string[] = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(sourcePath, fullPath);

        // Skip node_modules, lib, out, artifacts
        if (entry.name === 'node_modules' || entry.name === 'lib' ||
            entry.name === 'out' || entry.name === 'artifacts' ||
            entry.name === 'cache' || entry.name === '.git') {
          continue;
        }

        if (entry.isDirectory()) {
          files.push(...await findFiles(fullPath, pattern));
        } else if (pattern.test(entry.name)) {
          files.push(relativePath);
        }
      }
    } catch {
      // Directory not accessible
    }
    return files;
  }

  const solFiles = await findFiles(sourcePath, /\.sol$/);
  const tsFiles = await findFiles(sourcePath, /\.(ts|tsx)$/);
  const jsFiles = await findFiles(sourcePath, /\.(js|jsx)$/);
  const allFiles = [...solFiles, ...tsFiles, ...jsFiles];

  log.info('Found files to scan', {
    solidity: solFiles.length,
    typescript: tsFiles.length,
    javascript: jsFiles.length,
  });

  // Run scanners in parallel
  const [slitherResults, semgrepResults, patternResults] = await Promise.all([
    runSlither(sourcePath),
    runSemgrep(sourcePath),
    scanForPatterns(sourcePath, allFiles),
  ]);

  // Assess risk hotspots
  const riskHotspots = assessRiskHotspots(patternResults, slitherResults, fingerprint);

  const evidence: PreAuditEvidence = {
    fingerprint,
    scannerFindings: {
      slither: {
        critical: slitherResults.critical,
        high: slitherResults.high,
        medium: slitherResults.medium,
        low: slitherResults.low,
      },
      semgrep: {
        count: semgrepResults.count,
        patterns: semgrepResults.patterns,
      },
    },
    detectedPatterns: patternResults,
    riskHotspots,
  };

  log.info('Pre-audit scan complete', {
    slitherFindings: slitherResults.critical + slitherResults.high + slitherResults.medium + slitherResults.low,
    semgrepFindings: semgrepResults.count,
    adminPatterns: patternResults.adminPatterns.length,
    oracleUsage: patternResults.oracleUsage.length,
    riskHotspots: riskHotspots.length,
  });

  return evidence;
}

/**
 * Save pre-audit evidence to context directory
 */
export async function savePreAuditEvidence(
  contextPath: string,
  evidence: PreAuditEvidence
): Promise<string> {
  const evidencePath = path.join(contextPath, 'preaudit_evidence.json');
  await fs.mkdir(path.dirname(evidencePath), { recursive: true });
  await fs.writeFile(evidencePath, JSON.stringify(evidence, null, 2), 'utf-8');
  log.info('Saved pre-audit evidence', { path: evidencePath });
  return evidencePath;
}

/**
 * Load pre-audit evidence from context directory
 */
export async function loadPreAuditEvidence(
  contextPath: string
): Promise<PreAuditEvidence | null> {
  const evidencePath = path.join(contextPath, 'preaudit_evidence.json');
  try {
    const content = await fs.readFile(evidencePath, 'utf-8');
    return JSON.parse(content) as PreAuditEvidence;
  } catch {
    return null;
  }
}

export default {
  runPreAuditScan,
  savePreAuditEvidence,
  loadPreAuditEvidence,
};
