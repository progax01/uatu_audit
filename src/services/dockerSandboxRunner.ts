import { logger } from "../utils/logger.js";
import { runCmdLogged } from "./cmdLog.js";
import { ToolchainInfo } from "./sandboxProvisioner.js";
import path from "node:path";
import fs from "fs-extra";

const log = logger.child({ service: 'docker-sandbox-runner' });

export interface DockerProfile {
  image: string;
  memory: string;
  cpus: string;
  pidLimit: number;
  workdir: string;
  env: Record<string, string>;
}

export interface DockerRunOptions {
  runPath: string;
  sandboxPath: string;
  command: string[];
  timeout?: number;
  profile?: DockerProfile;
}

// Predefined container profiles for different ecosystems
export const CONTAINER_PROFILES: Record<string, DockerProfile> = {
  node: {
    image: 'node:20-alpine', // Lightweight Node.js 20
    memory: '8g',
    cpus: '2',
    pidLimit: 1024,
    workdir: '/work',
    env: {
      NODE_ENV: 'test',
      CI: 'true'
    }
  },
  
  foundry: {
    image: 'ghcr.io/foundry-rs/foundry:latest',
    memory: '6g',
    cpus: '2',
    pidLimit: 512,
    workdir: '/work',
    env: {
      FOUNDRY_PROFILE: 'test'
    }
  },
  
  anchor: {
    image: 'projectserum/anchor:latest',
    memory: '8g',
    cpus: '2',
    pidLimit: 1024,
    workdir: '/work',
    env: {
      ANCHOR_PROVIDER_URL: 'http://localhost:8899',
      SOLANA_CLI_VERSION: 'stable'
    }
  }
};

/**
 * Check if Docker is available and working
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    await runCmdLogged('', 'docker', ['--version']);
    await runCmdLogged('', 'docker', ['info']);
    return true;
  } catch (error) {
    log.debug('Docker not available', { error: String(error) });
    return false;
  }
}

/**
 * Select the appropriate Docker profile based on detected toolchain
 */
export function selectDockerProfile(toolchain: ToolchainInfo): DockerProfile {
  if (toolchain.hasFoundry) {
    return CONTAINER_PROFILES.foundry;
  }
  
  if (toolchain.hasAnchor) {
    return CONTAINER_PROFILES.anchor;
  }
  
  // Default to Node for Hardhat, Node.js, or mixed projects
  return CONTAINER_PROFILES.node;
}

/**
 * Run a command inside a Docker container with proper sandboxing
 */
export async function runInContainer(options: DockerRunOptions): Promise<string> {
  const {
    runPath,
    sandboxPath,
    command,
    timeout = 900000, // 15 minutes default
    profile = CONTAINER_PROFILES.node
  } = options;

  // Ensure sandbox path is absolute
  const sandboxAbs = path.resolve(sandboxPath);
  
  // Verify sandbox exists
  if (!await fs.pathExists(sandboxAbs)) {
    throw new Error(`Sandbox path does not exist: ${sandboxAbs}`);
  }

  // Build Docker command
  const dockerArgs = [
    'run',
    '--rm', // Remove container after execution
    '--init', // Use proper init system
    '--security-opt', 'no-new-privileges', // Security hardening
    '--cap-drop', 'ALL', // Drop all capabilities
    '--cap-add', 'DAC_OVERRIDE', // Only allow file access override
    '--network', 'bridge', // Enable network for npm installs
    '--cpus', profile.cpus,
    '--memory', profile.memory,
    '--pids-limit', profile.pidLimit.toString(),
    '-w', profile.workdir,
    '-v', `${sandboxAbs}:${profile.workdir}`, // Mount sandbox as working directory
  ];

  // Add environment variables
  const heapMb = process.env.UATU_NODE_HEAP_MB || '6144';
  const envVars = {
    ...profile.env,
    NODE_OPTIONS: `--max-old-space-size=${heapMb}`,
    npm_config_legacy_peer_deps: 'true',
    npm_config_fund: 'false',
    npm_config_audit: 'false',
    // Pass through project-specific environment variables
    // Provide SEPOLIA_RPC_URL with localhost fallback to prevent hardhat.config.ts errors
    SEPOLIA_RPC_URL: process.env.SEPOLIA_RPC_URL || 'http://localhost:8545'
  };

  for (const [key, value] of Object.entries(envVars)) {
    dockerArgs.push('-e', `${key}=${value}`);
  }

  // Add image and command
  dockerArgs.push(profile.image);
  dockerArgs.push(...command);

  log.info('Running command in Docker container', {
    image: profile.image,
    memory: profile.memory,
    cpus: profile.cpus,
    command: command.join(' '),
    timeout: timeout,
    workdir: profile.workdir
  });

  try {
    const result = await runCmdLogged(runPath, 'docker', dockerArgs, {
      timeout,
      env: process.env
    });
    
    log.info('Docker container execution completed successfully', {
      image: profile.image,
      resultLength: result?.length || 0
    });
    
    return result || '';
  } catch (error: any) {
    log.error('Docker container execution failed', {
      image: profile.image,
      error: String(error),
      exitCode: error.code
    });
    throw error;
  }
}

/**
 * Run Node.js/Hardhat commands in a container with proper dependency installation
 */
export async function runNodeInContainer(
  runPath: string,
  sandboxPath: string,
  commands: string[]
): Promise<string> {
  const profile = CONTAINER_PROFILES.node;
  
  // Build a compound command that installs deps and runs the actual commands
  const fullCommand = [
    'sh', '-c',
    [
      'set -e',
      'echo "Current directory: $(pwd)"',
      'echo "Installing hardhat and dependencies..."',
      'npm install hardhat @nomicfoundation/hardhat-toolbox @nomicfoundation/hardhat-chai-matchers @nomicfoundation/hardhat-ethers @nomicfoundation/hardhat-network-helpers @typechain/ethers-v6 @types/chai chai ethers hardhat-gas-reporter solidity-coverage typechain --save-dev --verbose --legacy-peer-deps',
      'echo "Verifying hardhat installation..."',
      'npx hardhat --version',
      ...commands.map(cmd => `echo "Running: ${cmd}" && ${cmd}`)
    ].join(' && ')
  ];

  return runInContainer({
    runPath,
    sandboxPath,
    command: fullCommand,
    profile
  });
}

/**
 * Run Foundry commands in a container
 */
export async function runFoundryInContainer(
  runPath: string,
  sandboxPath: string,
  commands: string[]
): Promise<string> {
  const profile = CONTAINER_PROFILES.foundry;
  
  const fullCommand = [
    'bash', '-c',
    [
      'set -e',
      'echo "Foundry version:" && forge --version',
      ...commands.map(cmd => `echo "Running: ${cmd}" && ${cmd}`)
    ].join(' && ')
  ];

  return runInContainer({
    runPath,
    sandboxPath,
    command: fullCommand,
    profile
  });
}

/**
 * Check if a Docker image is available locally, pull if needed
 */
export async function ensureDockerImage(image: string): Promise<void> {
  try {
    // Check if image exists locally
    await runCmdLogged('', 'docker', ['image', 'inspect', image]);
    log.debug('Docker image available locally', { image });
  } catch (error) {
    log.info('Pulling Docker image', { image });
    try {
      await runCmdLogged('', 'docker', ['pull', image]);
      log.info('Docker image pulled successfully', { image });
    } catch (pullError) {
      log.error('Failed to pull Docker image', { image, error: String(pullError) });
      throw new Error(`Failed to pull Docker image ${image}: ${pullError}`);
    }
  }
}

/**
 * Cleanup any dangling containers or volumes related to Uatu
 */
export async function cleanupDockerResources(): Promise<void> {
  try {
    // Remove any stopped containers with uatu labels
    await runCmdLogged('', 'docker', [
      'container', 'prune', '-f',
      '--filter', 'label=uatu=true'
    ]);
    
    // Remove any dangling volumes
    await runCmdLogged('', 'docker', ['volume', 'prune', '-f']);
    
    log.debug('Docker resources cleaned up');
  } catch (error) {
    log.debug('Docker cleanup failed (non-critical)', { error: String(error) });
  }
}
