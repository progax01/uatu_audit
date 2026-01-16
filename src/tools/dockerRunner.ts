import { spawn } from 'child_process';
import path from 'path';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'docker-runner' });

export interface DockerRunConfig {
  ecosystem: 'solidity' | 'rust' | 'move' | 'substrate';
  sourcePath: string;  // Absolute path to source code
  outputPath: string;  // Absolute path for output
  tool: string;
  args: string[];
  timeout?: number;
  memoryLimit?: string;  // e.g., "4g"
  cpuLimit?: string;     // e.g., "2.0"
  allowNetwork?: boolean;  // Allow network access (default: false for security)
}

export interface DockerRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

/**
 * Run a security tool inside a Docker container with security restrictions
 */
export async function runToolInDocker(config: DockerRunConfig): Promise<DockerRunResult> {
  const startTime = Date.now();

  // Map ecosystem to Docker image
  const imageMap = {
    solidity: 'uatu-audit-solidity:latest',
    rust: 'uatu-audit-rust:latest',
    move: 'uatu-audit-move:latest',
    substrate: 'uatu-audit-substrate:latest',
  };

  const imageName = imageMap[config.ecosystem];

  // Build Docker run command with security restrictions
  const dockerArgs = [
    'run',
    '--rm',  // Remove container after exit
    '--read-only',  // Read-only root filesystem
    '--security-opt', 'no-new-privileges:true',  // Prevent privilege escalation
    '--cap-drop', 'ALL',  // Drop all capabilities
    '--cap-add', 'CHOWN',  // Only add needed capabilities
    '--cap-add', 'DAC_OVERRIDE',
    '-v', `${config.sourcePath}:/audit/source:ro`,  // Source read-only
    '-v', `${config.outputPath}:/audit/output:rw`,  // Output writable
    '--tmpfs', '/tmp:noexec,nosuid,size=1g',  // Temp filesystem
    '--tmpfs', '/root:size=100m',  // Writable home directory for tool configs
    '-w', '/audit/source',  // Working directory
  ];

  // Add network isolation unless explicitly allowed (for tools like Semgrep that need to download rulesets)
  if (!config.allowNetwork) {
    dockerArgs.push('--network', 'none');
  }

  // Add resource limits
  if (config.memoryLimit) {
    dockerArgs.push('--memory', config.memoryLimit);
    dockerArgs.push('--memory-swap', config.memoryLimit);  // Prevent swap usage
  }

  if (config.cpuLimit) {
    dockerArgs.push('--cpus', config.cpuLimit);
  }

  // Add image and command
  dockerArgs.push(imageName);
  dockerArgs.push(config.tool);
  dockerArgs.push(...config.args);

  log.info(`Executing Docker command: docker ${dockerArgs.join(' ')}`);

  return new Promise((resolve, reject) => {
    const process = spawn('docker', dockerArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Timeout handler
    const timeoutMs = config.timeout || 300000;  // Default 5 minutes
    const timeoutHandle = setTimeout(() => {
      process.kill('SIGTERM');
      setTimeout(() => process.kill('SIGKILL'), 5000);  // Force kill after 5s
      reject(new Error(`Docker execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    process.on('close', (code) => {
      clearTimeout(timeoutHandle);
      const executionTime = Date.now() - startTime;

      resolve({
        stdout,
        stderr,
        exitCode: code || 0,
        executionTime,
      });
    });

    process.on('error', (err) => {
      clearTimeout(timeoutHandle);
      reject(err);
    });
  });
}

/**
 * Check if Docker is available on the system
 */
export async function checkDockerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn('docker', ['--version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    process.on('close', (code) => {
      resolve(code === 0);
    });

    process.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Check if a specific Docker image exists locally
 */
export async function checkDockerImageExists(imageName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn('docker', ['image', 'inspect', imageName], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    process.on('close', (code) => {
      resolve(code === 0);
    });

    process.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Pull a Docker image if it doesn't exist locally
 */
export async function pullDockerImage(imageName: string): Promise<boolean> {
  log.info(`Pulling Docker image: ${imageName}`);

  return new Promise((resolve) => {
    const process = spawn('docker', ['pull', imageName], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    process.on('close', (code) => {
      if (code === 0) {
        log.info(`Successfully pulled image: ${imageName}`);
        resolve(true);
      } else {
        log.error(`Failed to pull image: ${imageName}`);
        resolve(false);
      }
    });

    process.on('error', (err) => {
      log.error(`Error pulling image: ${imageName}`, { error: err });
      resolve(false);
    });
  });
}

/**
 * Build Docker images from docker-compose
 */
export async function buildDockerImages(): Promise<boolean> {
  log.info('Building Docker images from docker-compose');

  return new Promise((resolve) => {
    const process = spawn('docker-compose', ['build'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.resolve(__dirname, '../..'),  // Project root
    });

    let stderr = '';

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        log.info('Successfully built Docker images');
        resolve(true);
      } else {
        log.error('Failed to build Docker images', { stderr });
        resolve(false);
      }
    });

    process.on('error', (err) => {
      log.error('Error building Docker images', { error: err });
      resolve(false);
    });
  });
}
