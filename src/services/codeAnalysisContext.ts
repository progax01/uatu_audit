/**
 * Code Analysis Context Service
 *
 * Extracts code analysis insights from contract classification
 * to generate dynamic, context-aware questionnaire questions.
 */

export interface CodeAnalysisContext {
  // Detected patterns
  hasProxy: boolean;
  proxyType?: 'transparent' | 'uups' | 'beacon';

  hasUpgradeable: boolean;
  upgradeableContracts: string[];

  hasAccessControl: boolean;
  accessControlRoles: string[];
  rolesCount: number;

  hasTimelock: boolean;
  timelockContracts: string[];

  hasMultisig: boolean;
  multisigThreshold?: number;

  // External integrations
  usesChainlink: boolean;
  chainlinkFeeds: string[];

  usesUniswap: boolean;
  uniswapVersion?: 'v2' | 'v3';

  // Admin controls
  hasOwner: boolean;
  hasPause: boolean;
  hasMint: boolean;
  hasBurn: boolean;

  // Critical functions
  criticalFunctions: Array<{
    name: string;
    access: 'public' | 'restricted';
    hasTimelock: boolean;
  }>;

  // Contract info
  contractCount: number;
  interfacesImplemented: string[];
  category: string;
  subCategory?: string;
}

/**
 * Detect proxy type from patterns and metadata
 */
function detectProxyType(classification: any): 'transparent' | 'uups' | 'beacon' | undefined {
  const patterns = Array.isArray(classification.patterns) ? classification.patterns : [];
  const metadata = classification.detectionMetadata || {};

  if (patterns.includes('uups') || patterns.includes('uups-proxy')) return 'uups';
  if (patterns.includes('transparent-proxy') || patterns.includes('transparent')) return 'transparent';
  if (patterns.includes('beacon') || patterns.includes('beacon-proxy')) return 'beacon';

  // Check metadata
  if (metadata.proxyType) return metadata.proxyType;

  return undefined;
}

/**
 * Extract code analysis context from contract classification
 */
export function extractCodeContext(classification: any): CodeAnalysisContext {
  if (!classification) {
    // Return empty context if no classification
    return {
      hasProxy: false,
      hasUpgradeable: false,
      upgradeableContracts: [],
      hasAccessControl: false,
      accessControlRoles: [],
      rolesCount: 0,
      hasTimelock: false,
      timelockContracts: [],
      hasMultisig: false,
      usesChainlink: false,
      chainlinkFeeds: [],
      usesUniswap: false,
      hasOwner: false,
      hasPause: false,
      hasMint: false,
      hasBurn: false,
      criticalFunctions: [],
      contractCount: 1,
      interfacesImplemented: [],
      category: 'generic',
    };
  }

  const patterns = Array.isArray(classification.patterns) ? classification.patterns : [];
  const interfaces = Array.isArray(classification.interfaces) ? classification.interfaces : [];
  const metadata = classification.detectionMetadata || {};

  // Detect proxy patterns
  const hasProxy = patterns.some((p: string) =>
    ['proxy', 'upgradeable', 'transparent', 'uups', 'beacon'].some(keyword =>
      p.toLowerCase().includes(keyword)
    )
  );

  // Detect upgradeable patterns
  const hasUpgradeable = patterns.some((p: string) =>
    ['upgradeable', 'upgrade', 'initializable'].some(keyword =>
      p.toLowerCase().includes(keyword)
    )
  ) || interfaces.some((i: string) =>
    i.toLowerCase().includes('upgradeable')
  );

  // Detect access control
  const hasAccessControl = interfaces.some((i: string) =>
    ['AccessControl', 'IAccessControl'].includes(i)
  ) || patterns.some((p: string) =>
    p.toLowerCase().includes('access-control') || p.toLowerCase().includes('role')
  );

  const accessControlRoles = metadata.roles || metadata.accessControlRoles || [];

  // Detect timelock
  const hasTimelock = patterns.some((p: string) =>
    p.toLowerCase().includes('timelock')
  ) || interfaces.some((i: string) =>
    i.toLowerCase().includes('timelock')
  );

  // Detect multisig
  const hasMultisig = patterns.some((p: string) =>
    p.toLowerCase().includes('multisig') || p.toLowerCase().includes('multi-sig')
  );

  // Detect Chainlink
  const usesChainlink = patterns.some((p: string) =>
    p.toLowerCase().includes('chainlink') || p.toLowerCase().includes('oracle')
  ) || interfaces.some((i: string) =>
    i.toLowerCase().includes('aggregator')
  );

  // Detect Uniswap
  const usesUniswap = patterns.some((p: string) =>
    p.toLowerCase().includes('uniswap') || p.toLowerCase().includes('dex')
  ) || interfaces.some((i: string) =>
    i.toLowerCase().includes('uniswap')
  );

  // Detect ownership
  const hasOwner = interfaces.some((i: string) =>
    i.toLowerCase().includes('ownable')
  ) || patterns.some((p: string) =>
    p.toLowerCase().includes('ownable') || p.toLowerCase().includes('owner')
  );

  // Detect pausable
  const hasPause = interfaces.some((i: string) =>
    i.toLowerCase().includes('pausable')
  ) || patterns.some((p: string) =>
    p.toLowerCase().includes('pausable') || p.toLowerCase().includes('pause')
  );

  // Detect mintable/burnable
  const hasMint = patterns.some((p: string) =>
    p.toLowerCase().includes('mint') || p.toLowerCase().includes('minting')
  );

  const hasBurn = patterns.some((p: string) =>
    p.toLowerCase().includes('burn') || p.toLowerCase().includes('burning')
  );

  return {
    hasProxy,
    proxyType: hasProxy ? detectProxyType(classification) : undefined,

    hasUpgradeable,
    upgradeableContracts: metadata.upgradeableContracts || [],

    hasAccessControl,
    accessControlRoles,
    rolesCount: accessControlRoles.length,

    hasTimelock,
    timelockContracts: metadata.timelockContracts || [],

    hasMultisig,
    multisigThreshold: metadata.multisigThreshold,

    usesChainlink,
    chainlinkFeeds: metadata.oracleFeeds || metadata.chainlinkFeeds || [],

    usesUniswap,
    uniswapVersion: metadata.dexVersion,

    hasOwner,
    hasPause,
    hasMint,
    hasBurn,

    criticalFunctions: metadata.criticalFunctions || [],

    contractCount: metadata.contractCount || 1,
    interfacesImplemented: interfaces,
    category: classification.category || 'generic',
    subCategory: classification.subCategory,
  };
}
