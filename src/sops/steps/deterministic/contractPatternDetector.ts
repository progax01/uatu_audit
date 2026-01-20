/**
 * Contract Pattern Detector
 *
 * Analyzes contracts to detect common DeFi/Web3 patterns:
 * - DeFi Vaults (ERC4626, custom)
 * - Tokens (ERC20, ERC721, ERC1155) with tax mechanisms
 * - Governance contracts
 * - NFT contracts
 * - Bridge contracts
 * - AMM/DEX contracts
 *
 * Used early in SOP to activate specialized audit modules.
 */

import type { DeterministicExecutor } from '../../definitions/types.js';
import { logger } from '../../../utils/logger.js';

const log = logger.child({ service: 'contract-pattern-detector' });

// ============================================================================
// TYPES
// ============================================================================

export interface VaultAnalysis {
  isVault: boolean;
  vaultType: 'ERC4626' | 'custom' | null;
  hasSharesAccounting: boolean;
  hasDepositFunction: boolean;
  hasWithdrawFunction: boolean;
  hasReentrancyGuards: boolean;
  adminFunctions: string[];
  oracleDependencies: OracleDependency[];
  inflationRisk: 'high' | 'medium' | 'low' | 'none';
}

export interface TokenAnalysis {
  isToken: boolean;
  standard: 'ERC20' | 'ERC721' | 'ERC1155' | 'custom' | null;
  hasTaxMechanism: boolean;
  taxRates: {
    buy: number | null;
    sell: number | null;
    transfer: number | null;
  };
  hasMaxTransaction: boolean;
  hasOwnershipControls: boolean;
  canMint: boolean;
  canBurn: boolean;
  canPause: boolean;
  canChangeTax: boolean;
  ownershipRenounced: boolean;
  honeypotIndicators: HoneypotIndicators;
}

export interface HoneypotIndicators {
  hiddenMint: boolean;
  transferRestrictions: boolean;
  hasBlacklist: boolean;
  sellCooldown: boolean;
  hiddenOwnerFunctions: boolean;
}

export interface GovernanceAnalysis {
  isGovernance: boolean;
  governanceType: 'timelock' | 'multisig' | 'dao' | 'voting' | null;
  hasProposalSystem: boolean;
  hasVotingMechanism: boolean;
  hasTimelockDelay: boolean;
  quorumRequired: boolean;
}

export interface NFTAnalysis {
  isNFT: boolean;
  standard: 'ERC721' | 'ERC1155' | 'custom' | null;
  hasMintingMechanism: boolean;
  hasRoyalties: boolean;
  hasMetadataURI: boolean;
  isEnumerable: boolean;
}

export interface BridgeAnalysis {
  isBridge: boolean;
  bridgeType: 'lock-mint' | 'burn-mint' | 'liquidity-pool' | null;
  hasCrossChainMessaging: boolean;
  hasValidatorSystem: boolean;
  supportedChains: string[];
}

export interface AMMAnalysis {
  isAMM: boolean;
  ammType: 'uniswap-v2' | 'uniswap-v3' | 'curve' | 'balancer' | 'custom' | null;
  hasLiquidityPools: boolean;
  hasSwapFunction: boolean;
  hasPriceOracles: boolean;
  feeStructure: string | null;
}

export interface OracleDependency {
  name: string;
  address: string | null;
  hasStalenessFallback: boolean;
  hasFallback: boolean;
}

export interface ContractPatterns {
  vault: VaultAnalysis | null;
  token: TokenAnalysis | null;
  governance: GovernanceAnalysis | null;
  nft: NFTAnalysis | null;
  bridge: BridgeAnalysis | null;
  amm: AMMAnalysis | null;
}

// ============================================================================
// MAIN DETECTOR
// ============================================================================

export const detectContractPatterns: DeterministicExecutor = async (step: any, config: any, context: any) => {
  const contracts = context.data.contracts || [];

  if (contracts.length === 0) {
    log.warn('No contracts provided for pattern detection');
    return {
      success: true,
      data: {
        contractPatterns: {
          vault: null,
          token: null,
          governance: null,
          nft: null,
          bridge: null,
          amm: null,
        },
      },
    };
  }

  log.info('Detecting contract patterns', { contractCount: contracts.length });

  const patterns: ContractPatterns = {
    vault: detectVaultPattern(contracts),
    token: detectTokenPattern(contracts),
    governance: detectGovernancePattern(contracts),
    nft: detectNFTPattern(contracts),
    bridge: detectBridgePattern(contracts),
    amm: detectAMMPattern(contracts),
  };

  // Log detected patterns
  const detectedPatterns = Object.entries(patterns)
    .filter(([, analysis]) => analysis && (analysis as any).isVault || (analysis as any).isToken || (analysis as any).isGovernance || (analysis as any).isNFT || (analysis as any).isBridge || (analysis as any).isAMM)
    .map(([pattern]) => pattern);

  log.info('Contract patterns detected', { patterns: detectedPatterns });

  return {
    success: true,
    data: {
      contractPatterns: patterns,
    },
  };
};

// ============================================================================
// PATTERN DETECTORS
// ============================================================================

/**
 * Detect DeFi vault patterns
 */
function detectVaultPattern(contracts: any[]): VaultAnalysis | null {
  // Look for vault-specific functions
  const vaultFunctions = ['deposit', 'withdraw', 'mint', 'redeem', 'shares', 'totalAssets', 'convertToShares'];

  const hasVaultMethods = contracts.some(contract =>
    contract.functions?.some((f: any) =>
      vaultFunctions.some(vf => f.name.toLowerCase().includes(vf.toLowerCase()))
    )
  );

  if (!hasVaultMethods) return null;

  // Check for ERC4626 standard
  const isERC4626 = contracts.some(contract =>
    contract.functions?.some((f: any) => f.name === 'asset') &&
    contract.functions?.some((f: any) => f.name === 'totalAssets') &&
    contract.functions?.some((f: any) => f.name === 'convertToShares')
  );

  // Detect reentrancy guards
  const hasReentrancyGuards = contracts.some(contract =>
    contract.content?.includes('ReentrancyGuard') ||
    contract.content?.includes('nonReentrant') ||
    contract.content?.includes('_reentrancy')
  );

  // Extract admin functions
  const adminFunctions = extractAdminFunctions(contracts);

  // Detect oracle dependencies
  const oracleDependencies = detectOracles(contracts);

  // Assess inflation risk
  const inflationRisk = assessInflationRisk(contracts);

  return {
    isVault: true,
    vaultType: isERC4626 ? 'ERC4626' : 'custom',
    hasSharesAccounting: contracts.some(c => c.functions?.some((f: any) => f.name.includes('shares') || f.name.includes('Shares'))),
    hasDepositFunction: contracts.some(c => c.functions?.some((f: any) => f.name.toLowerCase() === 'deposit')),
    hasWithdrawFunction: contracts.some(c => c.functions?.some((f: any) => f.name.toLowerCase() === 'withdraw')),
    hasReentrancyGuards,
    adminFunctions,
    oracleDependencies,
    inflationRisk,
  };
}

/**
 * Detect token patterns
 */
function detectTokenPattern(contracts: any[]): TokenAnalysis | null {
  // Look for token-specific functions
  const tokenFunctions = ['transfer', 'balanceOf', 'totalSupply', 'approve', 'transferFrom'];

  const hasERC20 = contracts.some(contract =>
    tokenFunctions.every(tf =>
      contract.functions?.some((f: any) => f.name === tf)
    )
  );

  const hasERC721 = contracts.some(contract =>
    contract.functions?.some((f: any) => f.name === 'ownerOf') &&
    contract.functions?.some((f: any) => f.name === 'tokenURI')
  );

  const hasERC1155 = contracts.some(contract =>
    contract.functions?.some((f: any) => f.name === 'balanceOfBatch') &&
    contract.functions?.some((f: any) => f.name === 'safeBatchTransferFrom')
  );

  if (!hasERC20 && !hasERC721 && !hasERC1155) return null;

  // Detect tax mechanism
  const hasTaxMechanism = detectTaxLogic(contracts);
  const taxRates = hasTaxMechanism ? extractTaxRates(contracts) : { buy: null, sell: null, transfer: null };

  // Detect ownership controls
  const canMint = contracts.some(c => c.functions?.some((f: any) => f.name.toLowerCase().includes('mint')));
  const canBurn = contracts.some(c => c.functions?.some((f: any) => f.name.toLowerCase().includes('burn')));
  const canPause = contracts.some(c => c.functions?.some((f: any) => f.name.toLowerCase().includes('pause')));
  const canChangeTax = contracts.some(c => c.functions?.some((f: any) =>
    f.name.toLowerCase().includes('tax') && (f.name.toLowerCase().includes('set') || f.name.toLowerCase().includes('update'))
  ));

  // Check ownership renouncement
  const ownershipRenounced = contracts.some(c =>
    c.content?.includes('renounceOwnership') || c.content?.includes('owner = address(0)')
  );

  // Detect honeypot indicators
  const honeypotIndicators = detectHoneypot(contracts);

  return {
    isToken: true,
    standard: hasERC721 ? 'ERC721' : hasERC1155 ? 'ERC1155' : hasERC20 ? 'ERC20' : 'custom',
    hasTaxMechanism,
    taxRates,
    hasMaxTransaction: contracts.some(c => c.content?.includes('maxTransaction') || c.content?.includes('_maxTxAmount')),
    hasOwnershipControls: contracts.some(c => c.content?.includes('onlyOwner') || c.content?.includes('Ownable')),
    canMint,
    canBurn,
    canPause,
    canChangeTax,
    ownershipRenounced,
    honeypotIndicators,
  };
}

/**
 * Detect governance patterns
 */
function detectGovernancePattern(contracts: any[]): GovernanceAnalysis | null {
  const governanceFunctions = ['propose', 'vote', 'execute', 'queue', 'cancel'];

  const hasGovernance = contracts.some(contract =>
    governanceFunctions.some(gf =>
      contract.functions?.some((f: any) => f.name.toLowerCase().includes(gf))
    )
  );

  if (!hasGovernance) return null;

  const hasTimelock = contracts.some(c =>
    c.content?.includes('Timelock') || c.functions?.some((f: any) => f.name.includes('delay'))
  );

  const hasMultisig = contracts.some(c =>
    c.content?.includes('MultiSig') || c.content?.includes('multiSig') || c.content?.includes('threshold')
  );

  const hasVoting = contracts.some(c =>
    c.functions?.some((f: any) => f.name.toLowerCase().includes('vote'))
  );

  let governanceType: 'timelock' | 'multisig' | 'dao' | 'voting' | null = null;
  if (hasTimelock) governanceType = 'timelock';
  else if (hasMultisig) governanceType = 'multisig';
  else if (hasVoting) governanceType = 'voting';

  return {
    isGovernance: true,
    governanceType,
    hasProposalSystem: contracts.some(c => c.functions?.some((f: any) => f.name.toLowerCase().includes('propose'))),
    hasVotingMechanism: hasVoting,
    hasTimelockDelay: hasTimelock,
    quorumRequired: contracts.some(c => c.content?.includes('quorum')),
  };
}

/**
 * Detect NFT patterns
 */
function detectNFTPattern(contracts: any[]): NFTAnalysis | null {
  const hasNFT = contracts.some(contract =>
    contract.functions?.some((f: any) => f.name === 'ownerOf') ||
    contract.functions?.some((f: any) => f.name === 'tokenURI')
  );

  if (!hasNFT) return null;

  const isERC721 = contracts.some(c =>
    c.functions?.some((f: any) => f.name === 'ownerOf') &&
    c.functions?.some((f: any) => f.name === 'safeTransferFrom')
  );

  const isERC1155 = contracts.some(c =>
    c.functions?.some((f: any) => f.name === 'balanceOfBatch')
  );

  return {
    isNFT: true,
    standard: isERC721 ? 'ERC721' : isERC1155 ? 'ERC1155' : 'custom',
    hasMintingMechanism: contracts.some(c => c.functions?.some((f: any) => f.name.toLowerCase().includes('mint'))),
    hasRoyalties: contracts.some(c => c.content?.includes('royalty') || c.content?.includes('Royalty')),
    hasMetadataURI: contracts.some(c => c.functions?.some((f: any) => f.name.includes('URI') || f.name.includes('uri'))),
    isEnumerable: contracts.some(c => c.content?.includes('ERC721Enumerable') || c.functions?.some((f: any) => f.name === 'totalSupply')),
  };
}

/**
 * Detect bridge patterns
 */
function detectBridgePattern(contracts: any[]): BridgeAnalysis | null {
  const bridgeFunctions = ['bridge', 'lock', 'unlock', 'mint', 'burn', 'relay'];

  const hasBridge = contracts.some(contract =>
    bridgeFunctions.some(bf =>
      contract.functions?.some((f: any) => f.name.toLowerCase().includes(bf))
    )
  );

  if (!hasBridge) return null;

  const hasLockMint = contracts.some(c =>
    c.functions?.some((f: any) => f.name.toLowerCase().includes('lock')) &&
    c.functions?.some((f: any) => f.name.toLowerCase().includes('mint'))
  );

  const hasBurnMint = contracts.some(c =>
    c.functions?.some((f: any) => f.name.toLowerCase().includes('burn')) &&
    c.functions?.some((f: any) => f.name.toLowerCase().includes('mint'))
  );

  let bridgeType: 'lock-mint' | 'burn-mint' | 'liquidity-pool' | null = null;
  if (hasLockMint) bridgeType = 'lock-mint';
  else if (hasBurnMint) bridgeType = 'burn-mint';

  return {
    isBridge: true,
    bridgeType,
    hasCrossChainMessaging: contracts.some(c => c.content?.includes('CrossChain') || c.content?.includes('crossChain')),
    hasValidatorSystem: contracts.some(c => c.content?.includes('validator') || c.content?.includes('Validator')),
    supportedChains: [], // TODO: Extract from code
  };
}

/**
 * Detect AMM patterns
 */
function detectAMMPattern(contracts: any[]): AMMAnalysis | null {
  const ammFunctions = ['swap', 'addLiquidity', 'removeLiquidity', 'getAmountOut', 'pair'];

  const hasAMM = contracts.some(contract =>
    ammFunctions.some(af =>
      contract.functions?.some((f: any) => f.name.toLowerCase().includes(af.toLowerCase()))
    )
  );

  if (!hasAMM) return null;

  const isUniswapV2Style = contracts.some(c =>
    c.functions?.some((f: any) => f.name === 'getReserves') &&
    c.content?.includes('UniswapV2')
  );

  const isUniswapV3Style = contracts.some(c =>
    c.content?.includes('UniswapV3') || c.content?.includes('tick')
  );

  let ammType: 'uniswap-v2' | 'uniswap-v3' | 'curve' | 'balancer' | 'custom' | null = null;
  if (isUniswapV3Style) ammType = 'uniswap-v3';
  else if (isUniswapV2Style) ammType = 'uniswap-v2';
  else if (contracts.some(c => c.content?.includes('Curve'))) ammType = 'curve';
  else if (contracts.some(c => c.content?.includes('Balancer'))) ammType = 'balancer';
  else ammType = 'custom';

  return {
    isAMM: true,
    ammType,
    hasLiquidityPools: contracts.some(c => c.functions?.some((f: any) => f.name.includes('Liquidity'))),
    hasSwapFunction: contracts.some(c => c.functions?.some((f: any) => f.name.toLowerCase().includes('swap'))),
    hasPriceOracles: contracts.some(c => c.content?.includes('oracle') || c.content?.includes('Oracle')),
    feeStructure: null, // TODO: Extract from code
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractAdminFunctions(contracts: any[]): string[] {
  const adminFunctions: string[] = [];

  contracts.forEach(contract => {
    contract.functions?.forEach((f: any) => {
      if (
        f.visibility === 'external' &&
        (f.modifiers?.includes('onlyOwner') || f.modifiers?.includes('onlyAdmin') ||
         f.name.toLowerCase().includes('admin') || f.name.toLowerCase().includes('owner'))
      ) {
        adminFunctions.push(f.name);
      }
    });
  });

  return adminFunctions;
}

function detectOracles(contracts: any[]): OracleDependency[] {
  const oracles: OracleDependency[] = [];

  contracts.forEach(contract => {
    if (contract.content?.includes('oracle') || contract.content?.includes('Oracle') ||
        contract.content?.includes('Chainlink') || contract.content?.includes('AggregatorV3')) {
      oracles.push({
        name: 'Chainlink Oracle (detected)',
        address: null,
        hasStalenessFallback: contract.content.includes('staleness') || contract.content.includes('updatedAt'),
        hasFallback: contract.content.includes('fallback'),
      });
    }
  });

  return oracles;
}

function assessInflationRisk(contracts: any[]): 'high' | 'medium' | 'low' | 'none' {
  // Check for unchecked mint functions without proper accounting
  const hasUnprotectedMint = contracts.some(c =>
    c.functions?.some((f: any) =>
      f.name.toLowerCase().includes('mint') &&
      !f.modifiers?.includes('onlyOwner') &&
      !f.modifiers?.includes('onlyMinter')
    )
  );

  if (hasUnprotectedMint) return 'high';

  // Check for share manipulation possibilities
  const hasShareManipulation = contracts.some(c =>
    c.functions?.some((f: any) => f.name.includes('shares')) &&
    !c.content?.includes('SafeMath')
  );

  if (hasShareManipulation) return 'medium';

  return 'low';
}

function detectTaxLogic(contracts: any[]): boolean {
  return contracts.some(c =>
    c.content?.includes('tax') || c.content?.includes('Tax') ||
    c.content?.includes('fee') && c.content?.includes('transfer') ||
    c.functions?.some((f: any) =>
      f.name.toLowerCase().includes('tax') || f.name.toLowerCase().includes('fee')
    )
  );
}

function extractTaxRates(contracts: any[]): { buy: number | null; sell: number | null; transfer: number | null } {
  // Simple extraction - look for common variable names
  const taxRates: { buy: number | null; sell: number | null; transfer: number | null } = { buy: null, sell: null, transfer: null };

  contracts.forEach(c => {
    const content = c.content || '';

    // Look for buy tax
    const buyMatch = content.match(/buyTax\s*=\s*(\d+)/i) || content.match(/buyFee\s*=\s*(\d+)/i);
    if (buyMatch) taxRates.buy = parseInt(buyMatch[1]);

    // Look for sell tax
    const sellMatch = content.match(/sellTax\s*=\s*(\d+)/i) || content.match(/sellFee\s*=\s*(\d+)/i);
    if (sellMatch) taxRates.sell = parseInt(sellMatch[1]);

    // Look for transfer tax
    const transferMatch = content.match(/transferTax\s*=\s*(\d+)/i) || content.match(/transferFee\s*=\s*(\d+)/i);
    if (transferMatch) taxRates.transfer = parseInt(transferMatch[1]);
  });

  return taxRates;
}

function detectHoneypot(contracts: any[]): HoneypotIndicators {
  return {
    hiddenMint: contracts.some(c =>
      c.functions?.some((f: any) =>
        f.name.toLowerCase().includes('mint') && f.visibility === 'internal'
      )
    ),
    transferRestrictions: contracts.some(c =>
      c.content?.includes('_beforeTokenTransfer') && c.content?.includes('require') ||
      c.content?.includes('canTransfer')
    ),
    hasBlacklist: contracts.some(c =>
      c.content?.includes('blacklist') || c.content?.includes('Blacklist') ||
      c.content?.includes('_isBlacklisted')
    ),
    sellCooldown: contracts.some(c =>
      c.content?.includes('cooldown') || c.content?.includes('lastSell') ||
      c.content?.includes('_lastTransfer')
    ),
    hiddenOwnerFunctions: contracts.some(c =>
      c.functions?.some((f: any) =>
        f.visibility === 'internal' && (f.modifiers?.includes('onlyOwner') || f.name.includes('owner'))
      )
    ),
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export default detectContractPatterns;
