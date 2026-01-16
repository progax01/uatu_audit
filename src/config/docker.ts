/**
 * Docker Security Configuration
 *
 * Defines resource limits, timeouts, and security settings for Docker-based tool execution
 */

export const DOCKER_SECURITY_CONFIG = {
  // Memory limits per ecosystem (in GB)
  memoryLimits: {
    solidity: '4g',    // Forge can be memory-intensive
    rust: '6g',        // Cargo builds need more memory
    move: '3g',
    substrate: '4g',
  },

  // CPU limits (number of CPUs)
  cpuLimits: {
    solidity: '2.0',
    rust: '2.0',
    move: '1.5',
    substrate: '2.0',
  },

  // Execution timeouts per tool (milliseconds)
  timeouts: {
    slither: 120000,      // 2 minutes
    mythril: 300000,      // 5 minutes (symbolic execution is slow)
    forge: 180000,        // 3 minutes
    'forge-test': 600000, // 10 minutes (tests can be slow)
    'forge-build': 180000, // 3 minutes
    hardhat: 180000,      // 3 minutes
    'hardhat-test': 600000, // 10 minutes
    semgrep: 60000,       // 1 minute
    anchor: 180000,       // 3 minutes
    'anchor-test': 600000, // 10 minutes
    'cargo-clippy': 120000, // 2 minutes
    'cargo-audit': 60000,  // 1 minute
    'cargo-geiger': 90000, // 1.5 minutes
    soteria: 240000,      // 4 minutes
    aptos: 120000,        // 2 minutes
    'aptos-move-test': 600000, // 10 minutes
    sui: 120000,          // 2 minutes
    'sui-move-test': 600000, // 10 minutes
    'move-prover': 300000, // 5 minutes (formal verification)
    'cargo-contract': 180000, // 3 minutes
    'substrate-build': 300000, // 5 minutes
  },

  // Disk space limits
  diskLimits: {
    tmpfs: '1g',          // Temporary filesystem size
    output: '500m',       // Maximum output size
  },

  // Network isolation
  network: 'none',        // No network access by default

  // Process limits
  pidsLimit: 100,         // Maximum number of processes
} as const;

// Docker image mapping by ecosystem
export const ECOSYSTEM_DOCKER_IMAGES = {
  solidity: 'uatu-audit-solidity:latest',
  rust: 'uatu-audit-rust:latest',
  move: 'uatu-audit-move:latest',
  substrate: 'uatu-audit-substrate:latest',
} as const;

// Tool to ecosystem mapping
export const TOOL_ECOSYSTEM_MAP: Record<string, keyof typeof ECOSYSTEM_DOCKER_IMAGES> = {
  slither: 'solidity',
  mythril: 'solidity',
  forge: 'solidity',
  'forge-test': 'solidity',
  'forge-build': 'solidity',
  hardhat: 'solidity',
  'hardhat-test': 'solidity',
  semgrep: 'solidity',  // Works for all, but in Solidity image

  anchor: 'rust',
  'anchor-test': 'rust',
  'cargo-clippy': 'rust',
  'cargo-audit': 'rust',
  'cargo-geiger': 'rust',
  soteria: 'rust',

  aptos: 'move',
  'aptos-move-test': 'move',
  sui: 'move',
  'sui-move-test': 'move',
  'move-prover': 'move',

  'cargo-contract': 'substrate',
  'substrate-build': 'substrate',
};

/**
 * Get timeout for a specific tool
 */
export function getToolTimeout(toolName: string): number {
  return DOCKER_SECURITY_CONFIG.timeouts[toolName as keyof typeof DOCKER_SECURITY_CONFIG.timeouts] || 300000; // Default 5 minutes
}

/**
 * Get ecosystem for a specific tool
 */
export function getToolEcosystem(toolName: string): keyof typeof ECOSYSTEM_DOCKER_IMAGES {
  return TOOL_ECOSYSTEM_MAP[toolName] || 'solidity'; // Default to solidity
}

/**
 * Get Docker image for a specific tool
 */
export function getToolDockerImage(toolName: string): string {
  const ecosystem = getToolEcosystem(toolName);
  return ECOSYSTEM_DOCKER_IMAGES[ecosystem];
}

/**
 * Get memory limit for a specific ecosystem
 */
export function getEcosystemMemoryLimit(ecosystem: keyof typeof ECOSYSTEM_DOCKER_IMAGES): string {
  return DOCKER_SECURITY_CONFIG.memoryLimits[ecosystem];
}

/**
 * Get CPU limit for a specific ecosystem
 */
export function getEcosystemCpuLimit(ecosystem: keyof typeof ECOSYSTEM_DOCKER_IMAGES): string {
  return DOCKER_SECURITY_CONFIG.cpuLimits[ecosystem];
}
