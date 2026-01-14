/**
 * Explorer Service
 *
 * Fetches smart contract source code from block explorers using Etherscan V2 API.
 * The V2 API uses a unified endpoint for all chains with chainid parameter.
 *
 * Features:
 * - Source caching to avoid re-fetching
 * - Proxy contract detection (EIP-1967)
 * - Rate limit retry logic
 * - Combined validate-and-fetch endpoint
 */

import { logger } from "../utils/logger.js";

const log = logger.child({ service: "explorer" });

// Unified V2 API endpoint (works for all chains)
const ETHERSCAN_V2_API = "https://api.etherscan.io/v2/api";

// Cache for fetched sources (key: network:address)
const sourceCache = new Map<string, { data: ContractSourceWithMeta; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// EIP-1967 storage slots for proxy detection
const EIP1967_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const EIP1967_ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

// Network configurations
export const NETWORKS: Record<string, NetworkConfig> = {
  arbitrum: {
    name: "Arbitrum",
    chainId: 42161,
    explorerUrl: "https://arbiscan.io",
  },
  ethereum: {
    name: "Ethereum",
    chainId: 1,
    explorerUrl: "https://etherscan.io",
  },
  polygon: {
    name: "Polygon",
    chainId: 137,
    explorerUrl: "https://polygonscan.com",
  },
  base: {
    name: "Base",
    chainId: 8453,
    explorerUrl: "https://basescan.org",
  },
  bnb: {
    name: "BNB Chain",
    chainId: 56,
    explorerUrl: "https://bscscan.com",
  },
  optimism: {
    name: "Optimism",
    chainId: 10,
    explorerUrl: "https://optimistic.etherscan.io",
  },
};

export interface NetworkConfig {
  name: string;
  chainId: number;
  explorerUrl: string;
}

export interface ContractInfo {
  address: string;
  network: string;
  isContract: boolean;
  isVerified: boolean;
  contractName?: string;
  compiler?: string;
  optimization?: boolean;
  runs?: number;
  evmVersion?: string;
  licenseType?: string;
}

export interface ContractSource {
  contractName: string;
  compiler: string;
  optimization: boolean;
  runs: number;
  evmVersion: string;
  licenseType: string;
  sources: Record<string, string>; // filename -> source code
  abi: any[];
  constructorArguments?: string;
}

// Extended contract source with metadata
export interface ContractSourceWithMeta extends ContractSource {
  address: string;
  network: string;
  isProxy: boolean;
  implementationAddress?: string;
  implementationName?: string;
  implementationSource?: ContractSource;
  files: string[];
  fileCount: number;
  deployerAddress?: string;
  creationTxHash?: string;
}

// Combined validation and fetch result
export interface ValidateAndFetchResult {
  address: string;
  network: string;
  isContract: boolean;
  isVerified: boolean;
  contractName?: string;
  compiler?: string;
  explorerUrl: string;
  isProxy: boolean;
  implementationAddress?: string;
  implementationName?: string;
  files: string[];
  fileCount: number;
  cached: boolean;
  deployerAddress?: string;
  creationTxHash?: string;
}

// Explorer API response types
interface ExplorerApiResponse {
  status: string;
  message: string;
  result: any;
}

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Get unified API key for Etherscan V2 API
 * V2 API uses a single key across all chains
 */
function getApiKey(): string | null {
  // Try multiple env vars for backwards compatibility
  return process.env.ETHERSCAN_API_KEY ||
         process.env.ARBISCAN_API_KEY ||
         process.env.POLYGONSCAN_API_KEY ||
         null;
}

/**
 * Check if an address is a contract (not EOA)
 */
export async function isContract(address: string, network: string): Promise<boolean> {
  const config = NETWORKS[network];
  if (!config) {
    throw new Error(`Unsupported network: ${network}`);
  }

  const apiKey = getApiKey();

  // Use V2 API with chainid parameter
  const url = new URL(ETHERSCAN_V2_API);
  url.searchParams.set("chainid", config.chainId.toString());
  url.searchParams.set("module", "proxy");
  url.searchParams.set("action", "eth_getCode");
  url.searchParams.set("address", address);
  url.searchParams.set("tag", "latest");
  if (apiKey) {
    url.searchParams.set("apikey", apiKey);
  }

  try {
    const response = await fetch(url.toString());
    const data = await response.json() as ExplorerApiResponse;

    // If result is "0x" or "0x0", it's an EOA
    const code = data.result;
    return code && code !== "0x" && code !== "0x0";
  } catch (error) {
    log.error("Failed to check if address is contract", { address, network, error });
    throw new Error(`Failed to check contract: ${error}`);
  }
}

/**
 * Validate contract address and get basic info
 */
export async function validateContract(
  address: string,
  network: string
): Promise<ContractInfo> {
  if (!isValidAddress(address)) {
    throw new Error("Invalid address format");
  }

  const config = NETWORKS[network];
  if (!config) {
    throw new Error(`Unsupported network: ${network}`);
  }

  // Check if it's a contract
  const contractCheck = await isContract(address, network);
  if (!contractCheck) {
    return {
      address,
      network,
      isContract: false,
      isVerified: false,
    };
  }

  // Check if verified by attempting to get source using V2 API
  const apiKey = getApiKey();
  const url = new URL(ETHERSCAN_V2_API);
  url.searchParams.set("chainid", config.chainId.toString());
  url.searchParams.set("module", "contract");
  url.searchParams.set("action", "getsourcecode");
  url.searchParams.set("address", address);
  if (apiKey) {
    url.searchParams.set("apikey", apiKey);
  }

  try {
    const response = await fetch(url.toString());
    const data = await response.json() as ExplorerApiResponse;

    if (data.status !== "1" || !data.result || data.result.length === 0) {
      return {
        address,
        network,
        isContract: true,
        isVerified: false,
      };
    }

    const result = data.result[0];
    const isVerified = result.SourceCode && result.SourceCode !== "";

    return {
      address,
      network,
      isContract: true,
      isVerified,
      contractName: result.ContractName || undefined,
      compiler: result.CompilerVersion || undefined,
      optimization: result.OptimizationUsed === "1",
      runs: result.Runs ? parseInt(result.Runs) : undefined,
      evmVersion: result.EVMVersion || undefined,
      licenseType: result.LicenseType || undefined,
    };
  } catch (error) {
    log.error("Failed to validate contract", { address, network, error });
    throw new Error(`Failed to validate contract: ${error}`);
  }
}

/**
 * Fetch contract source code from explorer
 */
export async function fetchContractSource(
  address: string,
  network: string
): Promise<ContractSource> {
  if (!isValidAddress(address)) {
    throw new Error("Invalid address format");
  }

  const config = NETWORKS[network];
  if (!config) {
    throw new Error(`Unsupported network: ${network}`);
  }

  const apiKey = getApiKey();
  const url = new URL(ETHERSCAN_V2_API);
  url.searchParams.set("chainid", config.chainId.toString());
  url.searchParams.set("module", "contract");
  url.searchParams.set("action", "getsourcecode");
  url.searchParams.set("address", address);
  if (apiKey) {
    url.searchParams.set("apikey", apiKey);
  }

  log.info("Fetching contract source", { address, network, chainId: config.chainId, hasApiKey: !!apiKey });

  try {
    const response = await fetch(url.toString());
    const data = await response.json() as ExplorerApiResponse;

    if (data.status !== "1") {
      throw new Error(data.message || "Failed to fetch source code");
    }

    if (!data.result || data.result.length === 0) {
      throw new Error("No source code found");
    }

    const result = data.result[0];

    if (!result.SourceCode || result.SourceCode === "") {
      throw new Error("Contract source code not verified");
    }

    // Parse source code - can be single file or JSON with multiple files
    const sources: Record<string, string> = {};
    let sourceCode = result.SourceCode;

    // Handle different source code formats
    if (sourceCode.startsWith("{{")) {
      // Multiple files format: {{...}}
      sourceCode = sourceCode.slice(1, -1); // Remove outer braces
      try {
        const parsed = JSON.parse(sourceCode);
        if (parsed.sources) {
          // Standard JSON input format
          for (const [filename, fileData] of Object.entries(parsed.sources)) {
            sources[filename] = (fileData as any).content;
          }
        } else {
          // Direct sources object
          for (const [filename, content] of Object.entries(parsed)) {
            sources[filename] = (content as any).content || content;
          }
        }
      } catch (e) {
        log.warn("Failed to parse multi-file source, treating as single file", { error: e });
        sources[`${result.ContractName}.sol`] = result.SourceCode;
      }
    } else if (sourceCode.startsWith("{")) {
      // JSON format (single file wrapped in JSON or Vyper)
      try {
        const parsed = JSON.parse(sourceCode);
        if (parsed.sources) {
          for (const [filename, fileData] of Object.entries(parsed.sources)) {
            sources[filename] = (fileData as any).content;
          }
        } else {
          sources[`${result.ContractName}.sol`] = sourceCode;
        }
      } catch (e) {
        sources[`${result.ContractName}.sol`] = sourceCode;
      }
    } else {
      // Plain source code
      sources[`${result.ContractName}.sol`] = sourceCode;
    }

    // Parse ABI
    let abi: any[] = [];
    try {
      abi = JSON.parse(result.ABI);
    } catch (e) {
      log.warn("Failed to parse ABI", { error: e });
    }

    const contractSource: ContractSource = {
      contractName: result.ContractName,
      compiler: result.CompilerVersion,
      optimization: result.OptimizationUsed === "1",
      runs: parseInt(result.Runs) || 200,
      evmVersion: result.EVMVersion || "default",
      licenseType: result.LicenseType || "Unknown",
      sources,
      abi,
      constructorArguments: result.ConstructorArguments || undefined,
    };

    log.info("Successfully fetched contract source", {
      address,
      network,
      contractName: contractSource.contractName,
      fileCount: Object.keys(sources).length,
    });

    return contractSource;
  } catch (error) {
    log.error("Failed to fetch contract source", { address, network, error });
    throw error;
  }
}

/**
 * Get explorer URL for a contract
 */
export function getExplorerUrl(address: string, network: string): string {
  const config = NETWORKS[network];
  if (!config) {
    return `https://etherscan.io/address/${address}`;
  }
  return `${config.explorerUrl}/address/${address}`;
}

/**
 * Retry wrapper with exponential backoff for rate limits
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if it's a rate limit error
      const isRateLimit =
        error.message?.includes("rate limit") ||
        error.message?.includes("Max rate limit") ||
        error.message?.includes("too many requests");

      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        log.warn(`Rate limited, retrying in ${delay}ms`, { attempt: attempt + 1, maxRetries });
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

/**
 * Get cache key for a contract
 */
function getCacheKey(address: string, network: string): string {
  return `${network}:${address.toLowerCase()}`;
}

/**
 * Get cached source if available and not expired
 */
function getCachedSource(address: string, network: string): ContractSourceWithMeta | null {
  const key = getCacheKey(address, network);
  const cached = sourceCache.get(key);

  if (!cached) return null;

  // Check if expired
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    sourceCache.delete(key);
    return null;
  }

  return cached.data;
}

/**
 * Cache a fetched source
 */
function setCachedSource(address: string, network: string, data: ContractSourceWithMeta): void {
  const key = getCacheKey(address, network);
  sourceCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Detect if contract is a proxy and get implementation address
 * Supports EIP-1967 transparent proxy pattern
 */
export async function detectProxy(
  address: string,
  network: string
): Promise<{ isProxy: boolean; implementationAddress?: string }> {
  const config = NETWORKS[network];
  if (!config) {
    return { isProxy: false };
  }

  const apiKey = getApiKey();

  try {
    // Read EIP-1967 implementation slot
    const url = new URL(ETHERSCAN_V2_API);
    url.searchParams.set("chainid", config.chainId.toString());
    url.searchParams.set("module", "proxy");
    url.searchParams.set("action", "eth_getStorageAt");
    url.searchParams.set("address", address);
    url.searchParams.set("position", EIP1967_IMPLEMENTATION_SLOT);
    url.searchParams.set("tag", "latest");
    if (apiKey) {
      url.searchParams.set("apikey", apiKey);
    }

    const response = await fetch(url.toString());
    const data = (await response.json()) as ExplorerApiResponse;

    if (data.result && data.result !== "0x" && data.result !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      // Extract address from 32-byte storage slot (last 20 bytes)
      const implAddress = "0x" + data.result.slice(-40);

      // Validate it's a real address
      if (isValidAddress(implAddress) && implAddress !== "0x0000000000000000000000000000000000000000") {
        log.info("Detected EIP-1967 proxy", { proxy: address, implementation: implAddress });
        return { isProxy: true, implementationAddress: implAddress };
      }
    }

    return { isProxy: false };
  } catch (error) {
    log.warn("Failed to detect proxy", { address, network, error });
    return { isProxy: false };
  }
}

/**
 * Fetch the deployer address (contract creator) for a contract
 * Uses Etherscan's getcontractcreation API
 */
export async function fetchDeployerAddress(
  address: string,
  network: string
): Promise<{ deployerAddress?: string; creationTxHash?: string }> {
  const config = NETWORKS[network];
  if (!config) {
    return {};
  }

  const apiKey = getApiKey();

  try {
    const url = new URL(ETHERSCAN_V2_API);
    url.searchParams.set("chainid", config.chainId.toString());
    url.searchParams.set("module", "contract");
    url.searchParams.set("action", "getcontractcreation");
    url.searchParams.set("contractaddresses", address);
    if (apiKey) {
      url.searchParams.set("apikey", apiKey);
    }

    const response = await fetch(url.toString());
    const data = await response.json() as ExplorerApiResponse;

    if (data.status === "1" && data.result && data.result.length > 0) {
      const result = data.result[0];
      log.info("Fetched deployer address", {
        address,
        network,
        deployer: result.contractCreator,
        txHash: result.txHash,
      });
      return {
        deployerAddress: result.contractCreator,
        creationTxHash: result.txHash,
      };
    }

    return {};
  } catch (error) {
    log.warn("Failed to fetch deployer address", { address, network, error });
    return {};
  }
}

/**
 * Combined validate and fetch - single API call flow with caching and proxy detection
 */
export async function validateAndFetchContract(
  address: string,
  network: string
): Promise<ValidateAndFetchResult> {
  if (!isValidAddress(address)) {
    throw new Error("Invalid address format");
  }

  const config = NETWORKS[network];
  if (!config) {
    throw new Error(`Unsupported network: ${network}`);
  }

  // Check cache first
  const cached = getCachedSource(address, network);
  if (cached) {
    log.info("Returning cached source", { address, network });
    return {
      address,
      network,
      isContract: true,
      isVerified: true,
      contractName: cached.contractName,
      compiler: cached.compiler,
      explorerUrl: getExplorerUrl(address, network),
      isProxy: cached.isProxy,
      implementationAddress: cached.implementationAddress,
      implementationName: cached.implementationName,
      files: cached.files,
      fileCount: cached.fileCount,
      cached: true,
    };
  }

  // Check if it's a contract
  const contractCheck = await withRetry(() => isContract(address, network));
  if (!contractCheck) {
    return {
      address,
      network,
      isContract: false,
      isVerified: false,
      explorerUrl: getExplorerUrl(address, network),
      isProxy: false,
      files: [],
      fileCount: 0,
      cached: false,
    };
  }

  // Fetch source with retry logic
  let source: ContractSource;
  try {
    source = await withRetry(() => fetchContractSource(address, network));
  } catch (error: any) {
    // Source not verified
    if (error.message?.includes("not verified")) {
      return {
        address,
        network,
        isContract: true,
        isVerified: false,
        explorerUrl: getExplorerUrl(address, network),
        isProxy: false,
        files: [],
        fileCount: 0,
        cached: false,
      };
    }
    throw error;
  }

  // Detect proxy and fetch deployer address in parallel
  const [proxyInfo, deployerInfo] = await Promise.all([
    detectProxy(address, network),
    fetchDeployerAddress(address, network),
  ]);

  // If it's a proxy, fetch implementation source too
  let implementationSource: ContractSource | undefined;
  let implementationName: string | undefined;

  if (proxyInfo.isProxy && proxyInfo.implementationAddress) {
    try {
      implementationSource = await withRetry(() =>
        fetchContractSource(proxyInfo.implementationAddress!, network)
      );
      implementationName = implementationSource.contractName;
      log.info("Fetched implementation source", {
        proxy: address,
        implementation: proxyInfo.implementationAddress,
        implementationName,
      });
    } catch (error) {
      log.warn("Failed to fetch implementation source", {
        proxy: address,
        implementation: proxyInfo.implementationAddress,
        error,
      });
    }
  }

  // Combine all files
  const allFiles = Object.keys(source.sources);
  if (implementationSource) {
    allFiles.push(...Object.keys(implementationSource.sources).filter((f) => !allFiles.includes(f)));
  }

  // Create extended source with metadata
  const extendedSource: ContractSourceWithMeta = {
    ...source,
    address,
    network,
    isProxy: proxyInfo.isProxy,
    implementationAddress: proxyInfo.implementationAddress,
    implementationName,
    implementationSource,
    files: allFiles,
    fileCount: allFiles.length,
    deployerAddress: deployerInfo.deployerAddress,
    creationTxHash: deployerInfo.creationTxHash,
  };

  // Cache the result
  setCachedSource(address, network, extendedSource);

  return {
    address,
    network,
    isContract: true,
    isVerified: true,
    contractName: source.contractName,
    compiler: source.compiler,
    explorerUrl: getExplorerUrl(address, network),
    isProxy: proxyInfo.isProxy,
    implementationAddress: proxyInfo.implementationAddress,
    implementationName,
    files: allFiles,
    fileCount: allFiles.length,
    cached: false,
    deployerAddress: deployerInfo.deployerAddress,
    creationTxHash: deployerInfo.creationTxHash,
  };
}

/**
 * Clear source cache (for testing or manual refresh)
 */
export function clearSourceCache(): void {
  sourceCache.clear();
  log.info("Source cache cleared");
}

/**
 * Get cached source for a contract (for enqueue to use without re-fetching)
 */
export function getCachedContractSource(
  address: string,
  network: string
): ContractSourceWithMeta | null {
  return getCachedSource(address, network);
}
