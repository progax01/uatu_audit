/**
 * Explorer Service
 *
 * Fetches smart contract source code from block explorers using Etherscan V2 API.
 * The V2 API uses a unified endpoint for all chains with chainid parameter.
 */

import { logger } from "../utils/logger.js";

const log = logger.child({ service: "explorer" });

// Unified V2 API endpoint (works for all chains)
const ETHERSCAN_V2_API = "https://api.etherscan.io/v2/api";

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
