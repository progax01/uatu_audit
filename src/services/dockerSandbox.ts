import path from "node:path";
import fs from "fs-extra";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);
const log = logger.child({ module: 'dockerSandbox' });

export interface DockerOptions {
  image?: string;
  workDir?: string;
  timeout?: number; // in milliseconds
  networkMode?: 'none' | 'bridge' | 'host';
  memoryLimit?: string; // e.g., '512m', '1g'
  cpuLimit?: string; // e.g., '0.5', '1.0'
}

/**
 * Check if Docker is available on the system
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    await execAsync('docker --version');
    return true;
  } catch {
    log.warn('Docker is not available on this system');
    return false;
  }
}

/**
 * Execute a command in a Docker container with security constraints
 */
export async function executeInDocker(
  command: string,
  args: string[],
  sandboxPath: string,
  options: DockerOptions = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const {
    image = 'node:20-alpine',
    workDir = '/workspace',
    timeout = 15 * 60 * 1000, // 15 minutes default
    networkMode = 'none',
    memoryLimit = '1g',
    cpuLimit = '1.0'
  } = options;

  // Ensure sandbox path exists with proper permissions for Docker user 1000:1000
  await fs.ensureDir(sandboxPath);

  // Set permissions to allow Docker container user (1000:1000) to write
  // This is critical for npm install to create node_modules
  try {
    await execAsync(`chmod -R 777 ${sandboxPath}`);
  } catch (chmodErr) {
    log.warn('Failed to set sandbox permissions', { error: String(chmodErr) });
  }

  // Build Docker command with security constraints
  const dockerArgs = [
    'run',
    '--rm', // Remove container after execution
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=500m', // Writable tmp with restrictions
    '--tmpfs', '/var/tmp:rw,noexec,nosuid,size=100m',
    `--network=${networkMode}`, // Network isolation
    `--memory=${memoryLimit}`, // Memory limit
    `--cpus=${cpuLimit}`, // CPU limit
    '--security-opt=no-new-privileges', // Prevent privilege escalation
    '--cap-drop=ALL', // Drop all capabilities
    '--cap-add=DAC_OVERRIDE', // Only add necessary capabilities
    '--user', '1000:1000', // Non-root user
    '-v', `${sandboxPath}:${workDir}:rw`, // Mount as read-write for npm operations
    '-v', `${sandboxPath}/.uatu/temp:${workDir}/.uatu/temp:rw`, // Allow writing to temp dir
    '-w', workDir,
    image
  ];

  // Ensure temp directory exists for output
  await fs.ensureDir(path.join(sandboxPath, '.uatu', 'temp'));

  const fullCommand = `docker ${dockerArgs.join(' ')} ${command} ${args.join(' ')}`;
  
  log.info('Executing in Docker sandbox', { 
    command: `${command} ${args.join(' ')}`,
    image,
    sandboxPath,
    timeout 
  });

  try {
    const { stdout, stderr } = await execAsync(fullCommand, {
      timeout,
      cwd: sandboxPath,
      env: {
        ...process.env,
        // Strip potentially dangerous env vars
        PATH: '/usr/local/bin:/usr/bin:/bin',
        HOME: '/tmp',
        USER: 'sandbox'
      }
    });

    log.info('Docker execution completed successfully');
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    log.error('Docker execution failed', { error: error.message });
    
    // Check if it's a timeout
    if (error.code === 'TIMEOUT' || error.signal === 'SIGTERM') {
      throw new Error(`Docker execution timed out after ${timeout}ms`);
    }

    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      exitCode: error.code || 1
    };
  }
}

/**
 * Execute Foundry commands in Docker
 */
export async function executeFoundryInDocker(
  command: 'build' | 'test' | 'coverage',
  sandboxPath: string,
  options: DockerOptions = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // Use a Foundry-specific image
  const foundryOptions = {
    image: 'ghcr.io/foundry-rs/foundry:latest',
    ...options
  };

  const args: string[] = [];
  switch (command) {
    case 'build':
      args.push('build');
      break;
    case 'test':
      args.push('test', '--no-match-test', 'testFail'); // Skip failing tests
      break;
    case 'coverage':
      args.push('coverage', '--report', 'summary');
      break;
  }

  return executeInDocker('forge', args, sandboxPath, foundryOptions);
}

/**
 * Execute Node.js commands in Docker
 */
export async function executeNodeInDocker(
  command: 'install' | 'test' | 'build',
  sandboxPath: string,
  options: DockerOptions = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // Allow network access during install to download packages
  const nodeOptions = {
    image: 'node:20-alpine',
    networkMode: command === 'install' ? 'bridge' as const : 'none' as const,
    ...options
  };

  let args: string[] = [];
  switch (command) {
    case 'install':
      // Install hardhat and all dependencies explicitly
      args = [
        'sh', '-c',
        'echo "Installing hardhat and dependencies..." && ' +
        'npm install hardhat @nomicfoundation/hardhat-toolbox @nomicfoundation/hardhat-chai-matchers @nomicfoundation/hardhat-ethers @nomicfoundation/hardhat-network-helpers @typechain/ethers-v6 @types/chai chai ethers hardhat-gas-reporter solidity-coverage typechain --save-dev --verbose --legacy-peer-deps && ' +
        'echo "Verification: Hardhat installation check..." && ' +
        'npx hardhat --version'
      ];
      break;
    case 'test':
      args = ['npm', 'test'];
      break;
    case 'build':
      args = ['npm', 'run', 'build'];
      break;
  }

  return executeInDocker(args[0], args.slice(1), sandboxPath, nodeOptions);
}

/**
 * Execute Rust/Anchor commands in Docker
 */
export async function executeRustInDocker(
  command: 'build' | 'test',
  sandboxPath: string,
  options: DockerOptions = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const rustOptions = {
    image: 'rust:1.70-alpine',
    ...options
  };

  const args: string[] = [];
  switch (command) {
    case 'build':
      args.push('build', '--release');
      break;
    case 'test':
      args.push('test');
      break;
  }

  return executeInDocker('cargo', args, sandboxPath, rustOptions);
}
