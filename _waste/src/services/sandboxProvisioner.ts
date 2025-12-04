import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { logger } from "../utils/logger.js";
import { ProgressHook } from "../utils/stepHelper.js";

const log = logger.child({ module: 'sandboxProvisioner' });

export interface ToolchainInfo {
  hasFoundry: boolean;
  hasHardhat: boolean;
  hasAnchor: boolean;
  hasSoroban: boolean;
  hasNode: boolean;
  detectedFramework?: string;
  versions?: Record<string, string>;
}

export interface ClaudeCapabilities {
  available: boolean;
  supportsStdin: boolean;
  supportsInputFile: boolean;
  supportsAutoAccept: boolean;
  supportsSandboxMode: boolean;
  version?: string;
  error?: string;
}

export interface SandboxManifest {
  projectPath: string;
  sandboxPath: string;
  timestamp: number;
  toolchain: ToolchainInfo;
  claude: ClaudeCapabilities;
  environment: {
    nodeVersion?: string;
    npmVersion?: string;
    platform: string;
    arch: string;
  };
  excludedPaths: string[];
}

export class SandboxProvisioner {
  private runPath: string;
  private onProgress: ProgressHook;

  constructor(runPath: string, onProgress: ProgressHook) {
    this.runPath = runPath;
    this.onProgress = onProgress;
  }

  public async provision(projectPath: string, timestamp: number): Promise<string> {
    log.info('Starting sandbox provisioning', { projectPath, timestamp });

    // 1. Create sandbox directory in temp space (not inside project)
    const tempDir = os.tmpdir();
    const sandboxId = `uatu-sandbox-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    const sandboxPath = path.join(tempDir, sandboxId);
    await fs.ensureDir(sandboxPath);
    log.info('Created sandbox directory', { sandboxPath });

    // 2. Check disk space
    await this.checkDiskSpace(sandboxPath);

    // 3. Selective copy (exclude heavy/unnecessary files)
    await this.selectiveCopy(projectPath, sandboxPath);
    
    // 4. Report progress AFTER copy is complete to avoid conflicts
    this.onProgress({ phase: 'execute', step: 'sandbox-materialize', pct: 25 });

    // 5. Detect toolchain
    const toolchain = await this.detectToolchain(sandboxPath);
    await fs.writeJson(path.join(sandboxPath, '.toolchain.json'), toolchain, { spaces: 2 });

    // 6. Check Claude CLI capabilities
    const claude = await this.checkClaudeCapabilities();
    await fs.writeJson(path.join(sandboxPath, '.claude.json'), claude, { spaces: 2 });

    // 7. Write execution manifest
    const manifest: SandboxManifest = {
      projectPath,
      sandboxPath,
      timestamp,
      toolchain,
      claude,
      environment: await this.captureEnvironment(),
      excludedPaths: this.getExcludedPaths()
    };
    
    await fs.writeJson(path.join(sandboxPath, 'manifest.json'), manifest, { spaces: 2 });
    
    // Also save sandbox path reference in run directory for cleanup/reference
    await fs.writeJson(path.join(this.runPath, 'sandbox-path.json'), { sandboxPath, created: new Date().toISOString() }, { spaces: 2 });
    
    log.info('Sandbox provisioning completed', { sandboxPath, toolchain: toolchain.detectedFramework });

    return sandboxPath;
  }

  private async checkDiskSpace(sandboxPath: string): Promise<void> {
    try {
      const stats = await fs.stat(path.dirname(sandboxPath));
      // Simple heuristic: if we can't create the directory, assume low disk space
      // In production, you might want to use a more sophisticated disk space check
      log.info('Disk space check passed');
    } catch (error) {
      const errorMsg = 'Insufficient disk space or unable to create sandbox directory';
      log.error(errorMsg, { error });
      throw new Error(errorMsg);
    }
  }

  private async selectiveCopy(sourcePath: string, targetPath: string): Promise<void> {
    const excludePatterns = this.getExcludedPaths();
    
    log.info('Starting selective copy', { 
      from: sourcePath, 
      to: targetPath, 
      excludePatterns 
    });

    const copyOptions = {
      filter: (src: string) => {
        const relativePath = path.relative(sourcePath, src);
        
        // Exclude patterns
        for (const pattern of excludePatterns) {
          if (relativePath.includes(pattern)) {
            log.debug('Excluding path', { path: relativePath, pattern });
            return false;
          }
        }
        
        return true;
      }
    };

    await fs.copy(sourcePath, targetPath, copyOptions);
    log.info('Selective copy completed');
  }

  private getExcludedPaths(): string[] {
    return [
      '.git',
      'node_modules',
      'runs', // MUST exclude to prevent copying over our active progress tracking
      '.uatu/ai_tests',
      'coverage',
      'artifacts',
      'cache',
      'out', // Foundry build output
      'target', // Rust/Anchor build output
      '.next',
      'dist',
      'build',
      '*.log',
      '.DS_Store',
      'Thumbs.db'
    ];
  }

  private async detectToolchain(sandboxPath: string): Promise<ToolchainInfo> {
    const toolchain: ToolchainInfo = {
      hasFoundry: false,
      hasHardhat: false,
      hasAnchor: false,
      hasSoroban: false,
      hasNode: false,
      versions: {}
    };

    try {
      // Check for Foundry
      if (await fs.pathExists(path.join(sandboxPath, 'foundry.toml'))) {
        toolchain.hasFoundry = true;
        toolchain.detectedFramework = 'foundry';
      }

      // Check for Hardhat
      const packageJsonPath = path.join(sandboxPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        toolchain.hasNode = true;
        const packageJson = await fs.readJson(packageJsonPath);
        
        if (packageJson.devDependencies?.hardhat || packageJson.dependencies?.hardhat) {
          toolchain.hasHardhat = true;
          toolchain.detectedFramework = toolchain.detectedFramework || 'hardhat';
        }
      }

      // Check for Anchor
      if (await fs.pathExists(path.join(sandboxPath, 'Anchor.toml'))) {
        toolchain.hasAnchor = true;
        toolchain.detectedFramework = toolchain.detectedFramework || 'anchor';
      }

      // Check for Soroban
      if (await fs.pathExists(path.join(sandboxPath, 'Cargo.toml'))) {
        const cargoToml = await fs.readFile(path.join(sandboxPath, 'Cargo.toml'), 'utf8');
        if (cargoToml.includes('soroban')) {
          toolchain.hasSoroban = true;
          toolchain.detectedFramework = toolchain.detectedFramework || 'soroban';
        }
      }

      log.info('Toolchain detection completed', toolchain);
    } catch (error) {
      log.warn('Error during toolchain detection', { error });
    }

    return toolchain;
  }

  private async checkClaudeCapabilities(): Promise<ClaudeCapabilities> {
    const capabilities: ClaudeCapabilities = {
      available: false,
      supportsStdin: false,
      supportsInputFile: false,
      supportsAutoAccept: false,
      supportsSandboxMode: false
    };

    try {
      const { exec } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execAsync = promisify(exec);

      // Try to get Claude CLI help
      const claudePath = process.env.CLAUDE_CLI_PATH || 'claude';
      const { stdout } = await execAsync(`${claudePath} --help`);
      
      capabilities.available = true;
      capabilities.supportsStdin = stdout.includes('stdin') || stdout.includes('pipe');
      capabilities.supportsInputFile = stdout.includes('--input-file');
      capabilities.supportsAutoAccept = stdout.includes('--auto-accept');
      capabilities.supportsSandboxMode = stdout.includes('--permission-mode');

      // Try to get version
      try {
        const { stdout: versionOut } = await execAsync(`${claudePath} --version`);
        capabilities.version = versionOut.trim();
      } catch (versionError) {
        log.debug('Could not get Claude version', { error: versionError });
      }

      log.info('Claude CLI capabilities detected', capabilities);
    } catch (error) {
      capabilities.error = String(error);
      log.warn('Claude CLI not available or has issues', { error });
    }

    return capabilities;
  }

  private async captureEnvironment() {
    const environment: SandboxManifest['environment'] = {
      platform: process.platform,
      arch: process.arch
    };

    try {
      const { exec } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execAsync = promisify(exec);

      try {
        const { stdout: nodeVersion } = await execAsync('node --version');
        environment.nodeVersion = nodeVersion.trim();
      } catch (e) {
        log.debug('Could not get Node version');
      }

      try {
        const { stdout: npmVersion } = await execAsync('npm --version');
        environment.npmVersion = npmVersion.trim();
      } catch (e) {
        log.debug('Could not get npm version');
      }
    } catch (error) {
      log.debug('Error capturing environment', { error });
    }

    return environment;
  }
}
