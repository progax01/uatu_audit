/**
 * Contract Type Detector Service
 *
 * Automatically detects the category of a smart contract by analyzing:
 * - Interface inheritance (IERC20, IERC721, etc.)
 * - Function signatures (mint, stake, vote, etc.)
 * - Import statements (OpenZeppelin contracts)
 * - State variables and patterns
 *
 * Used for:
 * - Adaptive questionnaires (show only relevant questions)
 * - Contract-specific UI components
 * - Tailored security checks
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import type { ContractCategory } from '../db/schema';
import { logger } from '../utils/logger';

const log = logger.child({ module: 'contract-type-detector' });

// ============================================================================
// Types
// ============================================================================

export interface ContractClassification {
  category: ContractCategory;
  subCategory?: string;
  interfaces: string[];  // ['IERC20', 'Ownable', 'ReentrancyGuard']
  patterns: string[];    // ['minting', 'burning', 'pausing', 'staking']
  confidence: number;    // 0-100
  detectionMetadata: {
    filesAnalyzed: number;
    primaryContract?: string;
    inheritanceChain?: string[];
    tokenSymbol?: string;
    tokenName?: string;
  };
}

interface DetectionRule {
  category: ContractCategory;
  interfaces?: string[];          // Must have ANY of these interfaces
  functionPatterns?: string[];    // Must have ANY of these function names
  importPatterns?: string[];      // Must have ANY of these imports
  stateVarPatterns?: string[];    // Must have ANY of these state variables
  minMatches?: number;            // Minimum matches needed (default 1)
  weight?: number;                // Weight for scoring (default 1)
}

// ============================================================================
// Detection Rules
// ============================================================================

const DETECTION_RULES: DetectionRule[] = [
  // ERC20 Token
  {
    category: 'erc20-token',
    interfaces: ['IERC20', 'ERC20'],
    functionPatterns: ['totalSupply', 'balanceOf', 'transfer', 'transferFrom', 'approve', 'allowance'],
    importPatterns: ['@openzeppelin/contracts/token/ERC20', 'ERC20.sol'],
    minMatches: 3,
    weight: 2,
  },

  // ERC721 NFT
  {
    category: 'erc721-nft',
    interfaces: ['IERC721', 'ERC721'],
    functionPatterns: ['ownerOf', 'safeTransferFrom', 'tokenURI', 'setApprovalForAll'],
    importPatterns: ['@openzeppelin/contracts/token/ERC721', 'ERC721.sol'],
    minMatches: 3,
    weight: 2,
  },

  // ERC1155 Multi-Token
  {
    category: 'erc1155-multi',
    interfaces: ['IERC1155', 'ERC1155'],
    functionPatterns: ['balanceOfBatch', 'safeBatchTransferFrom', 'setApprovalForAll'],
    importPatterns: ['@openzeppelin/contracts/token/ERC1155', 'ERC1155.sol'],
    minMatches: 2,
    weight: 2,
  },

  // DeFi AMM (Automated Market Maker)
  {
    category: 'defi-amm',
    functionPatterns: [
      'addLiquidity', 'removeLiquidity', 'swap', 'swapExactTokensForTokens',
      'getAmountOut', 'getReserves', 'quote', 'createPair'
    ],
    stateVarPatterns: ['reserve0', 'reserve1', 'factory', 'token0', 'token1'],
    minMatches: 3,
    weight: 3,
  },

  // DeFi Lending
  {
    category: 'defi-lending',
    functionPatterns: [
      'deposit', 'withdraw', 'borrow', 'repay', 'liquidate',
      'getAccountLiquidity', 'collateralFactor', 'exchangeRate'
    ],
    stateVarPatterns: ['totalBorrows', 'totalReserves', 'borrowIndex', 'accrualBlockNumber'],
    minMatches: 3,
    weight: 3,
  },

  // DeFi Staking
  {
    category: 'defi-staking',
    functionPatterns: [
      'stake', 'unstake', 'withdraw', 'getReward', 'claimRewards',
      'earned', 'rewardPerToken', 'compound'
    ],
    stateVarPatterns: ['rewardRate', 'rewardsDuration', 'totalStaked', 'stakingToken', 'rewardsToken'],
    minMatches: 3,
    weight: 3,
  },

  // Governance
  {
    category: 'governance',
    interfaces: ['IGovernor'],
    functionPatterns: [
      'propose', 'castVote', 'castVoteWithReason', 'execute', 'queue',
      'quorum', 'votingDelay', 'votingPeriod', 'getVotes'
    ],
    importPatterns: ['@openzeppelin/contracts/governance', 'Governor.sol'],
    stateVarPatterns: ['proposalCount', 'votingDelay', 'votingPeriod'],
    minMatches: 3,
    weight: 3,
  },

  // Bridge
  {
    category: 'bridge',
    functionPatterns: [
      'lock', 'unlock', 'mint', 'burn', 'sendMessage', 'receiveMessage',
      'deposit', 'withdraw', 'crossChainTransfer'
    ],
    stateVarPatterns: ['sourceChain', 'destinationChain', 'messageHash', 'nonce'],
    minMatches: 2,
    weight: 2,
  },

  // Proxy (Upgradeable)
  {
    category: 'proxy-upgradeable',
    interfaces: ['ITransparentUpgradeableProxy', 'IERC1967'],
    functionPatterns: ['upgradeTo', 'upgradeToAndCall', 'implementation', '_delegate', 'changeAdmin'],
    importPatterns: [
      '@openzeppelin/contracts-upgradeable',
      '@openzeppelin/contracts/proxy',
      'Proxy.sol',
      'UUPSUpgradeable'
    ],
    stateVarPatterns: ['_IMPLEMENTATION_SLOT', '_ADMIN_SLOT'],
    minMatches: 1,
    weight: 3,
  },

  // Multisig Wallet
  {
    category: 'multisig-wallet',
    functionPatterns: [
      'submitTransaction', 'confirmTransaction', 'executeTransaction', 'revokeConfirmation',
      'addOwner', 'removeOwner', 'changeRequirement', 'getConfirmationCount'
    ],
    stateVarPatterns: ['owners', 'required', 'transactionCount', 'confirmations'],
    minMatches: 4,
    weight: 3,
  },
];

// ============================================================================
// Interface Detection Patterns
// ============================================================================

const INTERFACE_PATTERNS: Record<string, RegExp> = {
  // ERC Standards
  'IERC20': /(?:is\s+|interface\s+|import.*?)IERC20/,
  'ERC20': /(?:is\s+|contract\s+.*?\s+is\s+.*?)ERC20(?:\s|,|\{)/,
  'IERC721': /(?:is\s+|interface\s+|import.*?)IERC721/,
  'ERC721': /(?:is\s+|contract\s+.*?\s+is\s+.*?)ERC721(?:\s|,|\{)/,
  'IERC1155': /(?:is\s+|interface\s+|import.*?)IERC1155/,
  'ERC1155': /(?:is\s+|contract\s+.*?\s+is\s+.*?)ERC1155(?:\s|,|\{)/,

  // OpenZeppelin Base Contracts
  'Ownable': /(?:is\s+|contract\s+.*?\s+is\s+.*?)Ownable(?:\s|,|\{)/,
  'AccessControl': /(?:is\s+|contract\s+.*?\s+is\s+.*?)AccessControl(?:\s|,|\{)/,
  'Pausable': /(?:is\s+|contract\s+.*?\s+is\s+.*?)Pausable(?:\s|,|\{)/,
  'ReentrancyGuard': /(?:is\s+|contract\s+.*?\s+is\s+.*?)ReentrancyGuard(?:\s|,|\{)/,

  // Governance
  'IGovernor': /(?:is\s+|interface\s+|import.*?)IGovernor/,
  'Governor': /(?:is\s+|contract\s+.*?\s+is\s+.*?)Governor(?:\s|,|\{)/,

  // Proxy
  'ITransparentUpgradeableProxy': /(?:is\s+|interface\s+|import.*?)ITransparentUpgradeableProxy/,
  'UUPSUpgradeable': /(?:is\s+|contract\s+.*?\s+is\s+.*?)UUPSUpgradeable(?:\s|,|\{)/,
  'IERC1967': /(?:is\s+|interface\s+|import.*?)IERC1967/,
};

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect contract type by analyzing Solidity source files
 */
export async function detectContractType(projectPath: string): Promise<ContractClassification> {
  log.info('Detecting contract type', { projectPath });

  // Find all Solidity files
  const solFiles = await findSolidityFiles(projectPath);

  if (solFiles.length === 0) {
    log.warn('No Solidity files found', { projectPath });
    return {
      category: 'generic',
      interfaces: [],
      patterns: [],
      confidence: 0,
      detectionMetadata: {
        filesAnalyzed: 0,
      },
    };
  }

  log.debug(`Found ${solFiles.length} Solidity files`);

  // Analyze all files
  const analysis = await analyzeFiles(solFiles, projectPath);

  // Score each category based on detection rules
  const scores = scoreCategories(analysis);

  // Select best category
  const bestCategory = selectBestCategory(scores);

  // Extract sub-category info
  const subCategory = extractSubCategory(bestCategory, analysis);

  // Calculate confidence
  const confidence = calculateConfidence(scores, bestCategory, analysis);

  const result: ContractClassification = {
    category: bestCategory,
    subCategory,
    interfaces: analysis.interfaces,
    patterns: analysis.patterns,
    confidence: Math.round(confidence),
    detectionMetadata: {
      filesAnalyzed: solFiles.length,
      primaryContract: analysis.primaryContract,
      inheritanceChain: analysis.inheritanceChain,
      tokenSymbol: analysis.tokenSymbol,
      tokenName: analysis.tokenName,
    },
  };

  log.info('Contract type detected', {
    category: result.category,
    subCategory: result.subCategory,
    confidence: result.confidence,
    interfaces: result.interfaces,
    patterns: result.patterns,
  });

  return result;
}

// ============================================================================
// File Analysis
// ============================================================================

interface FileAnalysis {
  interfaces: string[];
  functionNames: string[];
  imports: string[];
  stateVars: string[];
  primaryContract?: string;
  inheritanceChain?: string[];
  tokenSymbol?: string;
  tokenName?: string;
  patterns: string[];
}

async function analyzeFiles(files: string[], projectPath: string): Promise<FileAnalysis> {
  const analysis: FileAnalysis = {
    interfaces: [],
    functionNames: [],
    imports: [],
    stateVars: [],
    patterns: [],
  };

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');

    // Detect interfaces
    for (const [interfaceName, pattern] of Object.entries(INTERFACE_PATTERNS)) {
      if (pattern.test(content)) {
        if (!analysis.interfaces.includes(interfaceName)) {
          analysis.interfaces.push(interfaceName);
        }
      }
    }

    // Extract function names
    const functionMatches = content.matchAll(/function\s+(\w+)\s*\(/g);
    for (const match of functionMatches) {
      const funcName = match[1];
      if (!analysis.functionNames.includes(funcName)) {
        analysis.functionNames.push(funcName);
      }
    }

    // Extract imports
    const importMatches = content.matchAll(/import\s+(?:.*?from\s+)?["']([^"']+)["']/g);
    for (const match of importMatches) {
      const importPath = match[1];
      if (!analysis.imports.includes(importPath)) {
        analysis.imports.push(importPath);
      }
    }

    // Extract state variables
    const stateVarMatches = content.matchAll(/(?:public|private|internal)\s+(\w+)\s+(\w+)\s*;/g);
    for (const match of stateVarMatches) {
      const varName = match[2];
      if (!analysis.stateVars.includes(varName)) {
        analysis.stateVars.push(varName);
      }
    }

    // Extract token metadata if ERC20
    if (content.includes('ERC20') || content.includes('IERC20')) {
      const symbolMatch = content.match(/string\s+(?:public\s+)?(?:constant\s+)?symbol\s*=\s*["'](\w+)["']/);
      if (symbolMatch) {
        analysis.tokenSymbol = symbolMatch[1];
      }

      const nameMatch = content.match(/string\s+(?:public\s+)?(?:constant\s+)?name\s*=\s*["']([^"']+)["']/);
      if (nameMatch) {
        analysis.tokenName = nameMatch[1];
      }
    }

    // Extract primary contract name
    const contractMatch = content.match(/contract\s+(\w+)\s+(?:is\s+)?/);
    if (contractMatch && !analysis.primaryContract) {
      analysis.primaryContract = contractMatch[1];
    }

    // Extract inheritance chain
    const inheritanceMatch = content.match(/contract\s+\w+\s+is\s+([\w\s,]+)/);
    if (inheritanceMatch) {
      const chain = inheritanceMatch[1].split(',').map((s) => s.trim());
      analysis.inheritanceChain = chain;
    }
  }

  // Detect high-level patterns
  analysis.patterns = detectPatterns(analysis);

  return analysis;
}

function detectPatterns(analysis: FileAnalysis): string[] {
  const patterns: string[] = [];

  // Minting
  if (analysis.functionNames.some((f) => f.match(/mint|_mint/i))) {
    patterns.push('minting');
  }

  // Burning
  if (analysis.functionNames.some((f) => f.match(/burn|_burn/i))) {
    patterns.push('burning');
  }

  // Pausing
  if (analysis.interfaces.includes('Pausable') || analysis.functionNames.some((f) => f.match(/pause|unpause/i))) {
    patterns.push('pausing');
  }

  // Access control
  if (analysis.interfaces.includes('Ownable') || analysis.interfaces.includes('AccessControl')) {
    patterns.push('access-control');
  }

  // Staking
  if (analysis.functionNames.some((f) => f.match(/stake|unstake|claim/i))) {
    patterns.push('staking');
  }

  // Governance/Voting
  if (analysis.functionNames.some((f) => f.match(/vote|propose|execute/i))) {
    patterns.push('governance');
  }

  // Upgradeable
  if (analysis.interfaces.includes('UUPSUpgradeable') || analysis.functionNames.some((f) => f.match(/upgradeTo/i))) {
    patterns.push('upgradeable');
  }

  // Reentrancy protection
  if (analysis.interfaces.includes('ReentrancyGuard')) {
    patterns.push('reentrancy-protected');
  }

  return patterns;
}

// ============================================================================
// Scoring
// ============================================================================

function scoreCategories(analysis: FileAnalysis): Map<ContractCategory, number> {
  const scores = new Map<ContractCategory, number>();

  for (const rule of DETECTION_RULES) {
    let matchCount = 0;

    // Check interfaces
    if (rule.interfaces) {
      for (const iface of rule.interfaces) {
        if (analysis.interfaces.includes(iface)) {
          matchCount++;
        }
      }
    }

    // Check function patterns
    if (rule.functionPatterns) {
      for (const pattern of rule.functionPatterns) {
        if (analysis.functionNames.some((f) => f.toLowerCase().includes(pattern.toLowerCase()))) {
          matchCount++;
        }
      }
    }

    // Check import patterns
    if (rule.importPatterns) {
      for (const pattern of rule.importPatterns) {
        if (analysis.imports.some((imp) => imp.includes(pattern))) {
          matchCount++;
        }
      }
    }

    // Check state var patterns
    if (rule.stateVarPatterns) {
      for (const pattern of rule.stateVarPatterns) {
        if (analysis.stateVars.some((v) => v.toLowerCase().includes(pattern.toLowerCase()))) {
          matchCount++;
        }
      }
    }

    // If minimum matches met, add score
    const minMatches = rule.minMatches || 1;
    if (matchCount >= minMatches) {
      const weight = rule.weight || 1;
      const score = matchCount * weight;
      scores.set(rule.category, (scores.get(rule.category) || 0) + score);
    }
  }

  return scores;
}

function selectBestCategory(scores: Map<ContractCategory, number>): ContractCategory {
  if (scores.size === 0) {
    return 'generic';
  }

  let bestCategory: ContractCategory = 'generic';
  let bestScore = 0;

  for (const [category, score] of scores.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

function extractSubCategory(category: ContractCategory, analysis: FileAnalysis): string | undefined {
  switch (category) {
    case 'erc20-token':
      // Check for deflationary, rebase, etc.
      if (analysis.functionNames.some((f) => f.match(/rebase/i))) {
        return 'rebase-token';
      }
      if (analysis.functionNames.some((f) => f.match(/reflect|redistribute/i))) {
        return 'reflection-token';
      }
      break;

    case 'defi-amm':
      if (analysis.imports.some((i) => i.includes('UniswapV2'))) {
        return 'uniswap-v2-fork';
      }
      if (analysis.imports.some((i) => i.includes('UniswapV3'))) {
        return 'uniswap-v3-fork';
      }
      break;

    case 'governance':
      if (analysis.interfaces.includes('IGovernor')) {
        return 'openzeppelin-governor';
      }
      break;

    case 'proxy-upgradeable':
      if (analysis.interfaces.includes('UUPSUpgradeable')) {
        return 'uups-proxy';
      }
      if (analysis.interfaces.includes('ITransparentUpgradeableProxy')) {
        return 'transparent-proxy';
      }
      break;
  }

  return undefined;
}

function calculateConfidence(
  scores: Map<ContractCategory, number>,
  bestCategory: ContractCategory,
  analysis: FileAnalysis
): number {
  if (bestCategory === 'generic') {
    return 30; // Low confidence for generic
  }

  const bestScore = scores.get(bestCategory) || 0;
  const totalScore = Array.from(scores.values()).reduce((sum, s) => sum + s, 0);

  if (totalScore === 0) {
    return 30;
  }

  // Confidence based on how dominant the best category is
  const dominance = bestScore / totalScore;

  // Boost confidence if we have strong indicators (interfaces)
  let boost = 0;
  if (analysis.interfaces.length >= 2) {
    boost = 20;
  } else if (analysis.interfaces.length === 1) {
    boost = 10;
  }

  const baseConfidence = dominance * 70 + boost;

  return Math.min(100, Math.max(30, baseConfidence));
}

// ============================================================================
// Helpers
// ============================================================================

async function findSolidityFiles(projectPath: string): Promise<string[]> {
  const files: string[] = [];

  async function scan(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip common directories
        if (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === 'dist' ||
          entry.name === 'build' ||
          entry.name === 'out' ||
          entry.name === 'cache' ||
          entry.name === 'artifacts' ||
          entry.name === 'coverage'
        ) {
          continue;
        }

        await scan(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.sol')) {
        files.push(fullPath);
      }
    }
  }

  await scan(projectPath);

  return files;
}
