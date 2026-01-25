/**
 * Unified Audit Service
 *
 * Single entry point for all audit types (GitHub repo, deployed contract, manual upload).
 * Orchestrates the entire audit flow from source acquisition to report generation.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { auditJobs, auditReports, auditResults, users, contractClassifications, projects } from '../db/schema';
import type {
  SOPDefinition,
  AuditDepth,
  StepFinding,
  UnifiedAuditOptions,
} from '../sops/definitions/types';
import { SOPOrchestrator } from '../sops/orchestrator/sopOrchestrator';
import { selectSOP } from './sopSelectionService';
import { MicroStepProgressService, getJobProgress } from './microStepProgressService';
import { detectContractType } from './contractTypeDetector';
import { calculateDependencyScores } from './dependencyScoreCalculator';
import { logger } from '../utils/logger';

const log = logger.child({ module: 'unified-audit' });

// ============================================================================
// Types
// ============================================================================

export interface GitHubRepoInput {
  type: 'github-repo';
  owner: string;
  repo: string;
  repoUrl: string;
  branch?: string;
  commitSha?: string;
  accessToken?: string;
  includePaths?: string[];
  excludePaths?: string[];
}

export interface DeployedContractInput {
  type: 'deployed-contract';
  address: string;
  network: string;
  chainId: number;
  explorerApiKey?: string;
}

export interface ManualUploadInput {
  type: 'manual-upload';
  uploadId: string;
  projectPath: string;
}

export type AuditSourceInput = GitHubRepoInput | DeployedContractInput | ManualUploadInput;

export interface UnifiedAuditRequest {
  source: AuditSourceInput;
  depth: AuditDepth;
  visibility: 'private' | 'public';
  userId?: string;
  projectId?: string;
  options?: {
    forceFramework?: string;
    forceSOP?: string;
    skipTools?: string[];
    enabledSteps?: string[];
    disabledSteps?: string[];
  };
}

export interface UnifiedAuditResult {
  success: boolean;
  jobId: string;
  progressUrl: string;
  sseUrl: string;
  estimatedDurationSeconds: number;
  sopId: string;
  sopVersion: string;
  detectedFramework?: string;
  detectedLanguage?: string;
  totalSteps: number;
}

export interface AuditCompletionResult {
  success: boolean;
  jobId: string;
  score: number;
  findings: StepFinding[];
  reportId?: string;
  durationSeconds: number;
  error?: string;
}

// ============================================================================
// Unified Audit Service
// ============================================================================

export class UnifiedAuditService extends EventEmitter {
  private static instance: UnifiedAuditService;

  static getInstance(): UnifiedAuditService {
    if (!UnifiedAuditService.instance) {
      UnifiedAuditService.instance = new UnifiedAuditService();
    }
    return UnifiedAuditService.instance;
  }

  /**
   * Start a new audit
   */
  async startAudit(request: UnifiedAuditRequest): Promise<UnifiedAuditResult> {
    log.info('Starting unified audit', {
      sourceType: request.source.type,
      depth: request.depth,
      userId: request.userId,
    });

    // Create job record
    const jobId = crypto.randomUUID();
    const createdAt = new Date();

    // Determine repo and branch values based on source type
    let repo = '';
    let branch = 'main';

    if (request.source.type === 'github-repo') {
      const githubSource = request.source as GitHubRepoInput;
      repo = githubSource.repoUrl;
      branch = githubSource.branch || 'main';
    } else if (request.source.type === 'deployed-contract') {
      const contractSource = request.source as DeployedContractInput;
      repo = `contract:${contractSource.network}:${contractSource.address}`;
      branch = 'n/a';
    } else if (request.source.type === 'manual-upload') {
      repo = `upload:${(request.source as ManualUploadInput).uploadId}`;
      branch = 'n/a';
    }

    // Validate projectId if provided
    let validatedProjectId: string | null = null;
    if (request.projectId) {
      const { projects } = await import('../db/schema.js');
      const [project] = await db.select().from(projects).where(eq(projects.id, request.projectId));
      if (project) {
        validatedProjectId = request.projectId;
        log.info('Audit linked to project', { projectId: request.projectId, projectName: project.name });
      } else {
        log.warn('Project not found in database, audit will be created without projectId', {
          projectId: request.projectId
        });
      }
    }

    try {
      await db.insert(auditJobs).values({
        id: jobId,
        userId: request.userId,
        projectId: validatedProjectId, // Only set if project exists in DB
        repo,
        branch,
        status: 'pending',
        progressPct: 0,
        sourceType: request.source.type,
        auditDepth: request.depth,
        visibility: request.visibility,
        createdAt,
      });
    } catch (insertError: any) {
      // Log the full error object to see all properties
      log.error('Database insert failed - full error', {
        errorString: JSON.stringify(insertError, Object.getOwnPropertyNames(insertError)),
        message: insertError.message,
        stack: insertError.stack,
        cause: insertError.cause,
      });

      // Check if there's a cause property with the real PostgreSQL error
      const pgError = insertError.cause || insertError;
      log.error('PostgreSQL error details', {
        message: pgError.message,
        code: pgError.code,
        detail: pgError.detail,
        hint: pgError.hint,
        position: pgError.position,
        constraint: pgError.constraint_name || pgError.constraint,
      });

      throw new Error(`Failed to create audit job: ${insertError.message}`);
    }

    try {
      // Acquire source code
      const projectPath = await this.acquireSource(request.source, jobId);

      // Update job with project path
      await db
        .update(auditJobs)
        .set({ projectPath })
        .where(eq(auditJobs.id, jobId));

      // Detect contract type (for Solidity projects only)
      let contractClassification;
      try {
        log.info('Detecting contract type', { jobId, projectPath });
        contractClassification = await detectContractType(projectPath);

        // Store classification in database
        await db.insert(contractClassifications).values({
          jobId,
          category: contractClassification.category,
          subCategory: contractClassification.subCategory,
          interfaces: contractClassification.interfaces,
          patterns: contractClassification.patterns,
          confidence: contractClassification.confidence,
          detectionMetadata: contractClassification.detectionMetadata,
        });

        log.info('Contract type detected and stored', {
          jobId,
          category: contractClassification.category,
          confidence: contractClassification.confidence,
        });
      } catch (detectionError: any) {
        // Don't fail audit if detection fails, just log and continue
        log.warn('Contract type detection failed, continuing with generic', {
          jobId,
          error: detectionError.message,
        });
        contractClassification = {
          category: 'generic' as const,
          interfaces: [],
          patterns: [],
          confidence: 0,
          detectionMetadata: { filesAnalyzed: 0 },
        };
      }

      // Select SOP
      const sopResult = await selectSOP({
        projectPath,
        preferredDepth: request.depth,
        forceFramework: request.options?.forceFramework as any,
        forceSOP: request.options?.forceSOP,
      });

      // Update job with detection info and mark as started
      await db
        .update(auditJobs)
        .set({
          status: 'running',
          startedAt: new Date(),
          detectedFramework: sopResult.detection.framework,
          sopId: sopResult.sop.id,
          sopVersion: sopResult.sop.version,
        })
        .where(eq(auditJobs.id, jobId));

      // Calculate estimated duration
      const depthConfig = sopResult.sop.depths[request.depth];
      const estimatedDurationSeconds = depthConfig.estimatedDurationMinutes * 60;

      // Get step count for this depth
      const enabledSteps = sopResult.sop.steps.filter(
        (s) => depthConfig.enabledSteps.includes(s.id)
      );

      log.info('Audit initialized', {
        jobId,
        sopId: sopResult.sop.id,
        framework: sopResult.detection.framework,
        stepCount: enabledSteps.length,
        estimatedDuration: estimatedDurationSeconds,
      });

      // Launch orchestrator in background
      this.runOrchestrator(jobId, projectPath, sopResult.sop, request);

      return {
        success: true,
        jobId,
        progressUrl: `/api/audit/${jobId}/progress`,
        sseUrl: `/api/audit/${jobId}/progress/stream`,
        estimatedDurationSeconds,
        sopId: sopResult.sop.id,
        sopVersion: sopResult.sop.version,
        detectedFramework: sopResult.detection.framework,
        detectedLanguage: sopResult.detection.language,
        totalSteps: enabledSteps.length,
      };
    } catch (error: any) {
      log.error('Failed to start audit', {
        jobId,
        error: error.message,
      });

      await db
        .update(auditJobs)
        .set({
          status: 'failed',
          errorMessage: 'Audit initialization failed. Please retry the audit.',
        })
        .where(eq(auditJobs.id, jobId));

      throw error;
    }
  }

  /**
   * Get audit progress
   */
  async getProgress(jobId: string) {
    return getJobProgress(jobId);
  }

  /**
   * Cancel a running audit
   */
  async cancelAudit(jobId: string): Promise<void> {
    log.info('Cancelling audit', { jobId });

    await db
      .update(auditJobs)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(auditJobs.id, jobId));

    this.emit('audit:cancelled', jobId);
  }

  /**
   * Resume a pending audit job
   * Used by database queue worker to resume jobs after server restart
   */
  async resumeAudit(jobId: string): Promise<void> {
    log.info('Resuming audit', { jobId });

    // Get job from database
    const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (!job.projectPath) {
      throw new Error(`Job ${jobId} has no project path - cannot resume`);
    }

    if (!job.sopId) {
      throw new Error(`Job ${jobId} has no SOP assigned - cannot resume`);
    }

    // Validate checkpoint and detect code changes
    try {
      await this.validateCheckpoint(jobId, job.projectPath);
    } catch (checkpointError: any) {
      log.warn('Checkpoint validation failed - continuing anyway', {
        jobId,
        error: checkpointError.message,
      });
      // Don't fail resume on checkpoint validation errors
      // Just log and continue
    }

    // Load SOP
    const { loadSOP } = await import('../sops/definitions/index.js');
    const sop = await loadSOP(job.sopId);

    if (!sop) {
      throw new Error(`SOP ${job.sopId} not found`);
    }

    // Construct minimal request for orchestrator
    const request: UnifiedAuditRequest = {
      source: {
        type: job.sourceType as any,
        // We don't need full source details since we already have the code
      } as any,
      depth: job.auditDepth as AuditDepth,
      visibility: job.visibility as 'private' | 'public',
      userId: job.userId || undefined,
      projectId: job.projectId || undefined,
    };

    log.info('Resuming orchestrator', {
      jobId,
      sopId: job.sopId,
      currentStep: job.currentStepId,
      progress: job.progressPct,
    });

    // Resume orchestrator
    this.runOrchestrator(jobId, job.projectPath, sop, request);
  }

  /**
   * Validates checkpoint before resuming - checks if code has changed since last checkpoint
   */
  private async validateCheckpoint(jobId: string, projectPath: string): Promise<void> {
    const { MilestoneStateManager } = await import('./milestoneStateManager.js');
    const stateManager = new MilestoneStateManager(jobId, projectPath);

    // Load latest checkpoint
    const snapshot = await stateManager.loadLatestSnapshot();

    if (!snapshot || !snapshot.checkpoints || snapshot.checkpoints.length === 0) {
      log.debug('No checkpoint found - this is a fresh start or checkpoint not created');
      return;
    }

    // Get latest checkpoint with context hash
    const latestCheckpoint = snapshot.checkpoints
      .filter(cp => cp.contextHash)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (!latestCheckpoint || !latestCheckpoint.contextHash) {
      log.debug('No checkpoint with context hash found');
      return;
    }

    // Generate current context hash
    const currentHash = await this.generateContextHash(projectPath);

    // Compare hashes
    if (currentHash !== latestCheckpoint.contextHash) {
      log.warn('CODE CHANGED since last checkpoint', {
        jobId,
        checkpointId: latestCheckpoint.id,
        checkpointTime: latestCheckpoint.timestamp,
        previousHash: latestCheckpoint.contextHash.substring(0, 8),
        currentHash: currentHash.substring(0, 8),
        recommendation: 'Consider starting a new audit if significant changes were made',
      });

      // Update job metadata to record this warning
      const [currentJob] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));
      await db.update(auditJobs)
        .set({
          metadata: {
            ...(currentJob?.metadata as any || {}),
            checkpointValidation: {
              codeChanged: true,
              lastCheckpoint: latestCheckpoint.id,
              detectedAt: new Date().toISOString(),
            },
          },
        })
        .where(eq(auditJobs.id, jobId));
    } else {
      log.info('Checkpoint validated - code unchanged since last checkpoint', {
        jobId,
        checkpointId: latestCheckpoint.id,
      });
    }
  }

  /**
   * Generates a hash of the current code context to detect changes
   */
  private async generateContextHash(projectPath: string): Promise<string> {
    const crypto = await import('crypto');
    const fg = await import('fast-glob');
    const fs = await import('fs/promises');
    const path = await import('path');

    // Find all Solidity files
    const solidityFiles = await fg.default('**/*.sol', {
      cwd: projectPath,
      ignore: ['node_modules/**', 'test/**', 'script/**', 'lib/**'],
      absolute: false,
    });

    // Read and concatenate all file contents
    const contents: string[] = [];
    for (const file of solidityFiles.sort()) {
      try {
        const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
        contents.push(`${file}:${content}`);
      } catch (error) {
        // File might have been deleted - skip it
        log.debug(`Could not read file for hash: ${file}`);
      }
    }

    // Generate hash
    const hash = crypto
      .createHash('sha256')
      .update(contents.join('\n'))
      .digest('hex');

    return hash;
  }

  /**
   * Acquire source code from various inputs
   */
  private async acquireSource(source: AuditSourceInput, jobId: string): Promise<string> {
    switch (source.type) {
      case 'github-repo':
        return this.cloneGitHubRepo(source, jobId);

      case 'deployed-contract':
        return this.fetchContractSource(source, jobId);

      case 'manual-upload':
        return source.projectPath;

      default:
        throw new Error(`Unknown source type: ${(source as any).type}`);
    }
  }

  /**
   * Clone a GitHub repository using shared workspace manager
   */
  private async cloneGitHubRepo(input: GitHubRepoInput, jobId: string): Promise<string> {
    // Parse repo URL to get clean repository identifier
    const repoMatch = input.repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) {
      throw new Error('Invalid GitHub URL');
    }

    const [, owner, repo] = repoMatch;
    const repoName = repo.replace('.git', '');
    const branch = input.branch || 'main';

    // Use access token if provided (required for private repos)
    const accessToken = input.accessToken;
    if (!accessToken) {
      log.info('No access token provided - public repo or user needs to connect GitHub for private repos');
    }

    // Get or create shared workspace (reuses existing clones)
    const { getOrCreateSharedWorkspace, getAuditWorkspace } = await import('./workspaceManager.js');
    const { getFullCommitHash } = await import('./gitService.js');

    try {
      // Get shared workspace - this will reuse existing clone if available
      log.info('Getting shared workspace', { owner, repo: repoName, branch, hasToken: !!accessToken });
      const workspace = await getOrCreateSharedWorkspace(
        owner,
        repoName,
        branch,
        accessToken
      );

      log.info('Shared workspace ready', {
        sourcePath: workspace.sourcePath,
        auditsPath: workspace.auditsPath,
        testsPath: workspace.testsPath,
      });

      // Create job-specific audit directory
      const auditDir = getAuditWorkspace(workspace, jobId);
      await fs.ensureDir(auditDir);
      log.info('Created job-specific audit directory', { auditDir });

      // Capture commit SHA immediately after clone/pull
      const commitSha = await getFullCommitHash(workspace.sourcePath);

      if (commitSha) {
        log.info('Captured commit SHA', { commitSha: commitSha.substring(0, 7), full: commitSha });

        // Update audit job with commit SHA and workspace metadata
        const { db } = await import('../db/index.js');
        const { auditJobs } = await import('../db/schema.js');
        const { eq } = await import('drizzle-orm');

        await db
          .update(auditJobs)
          .set({
            commitSha,
            branch,
            metadata: {
              workspace: {
                repoPath: workspace.repoPath,
                sourcePath: workspace.sourcePath,
                auditsPath: workspace.auditsPath,
                testsPath: workspace.testsPath,
                auditDir,
                shared: true,
                owner,
                repo: repoName,
                branch,
              },
            },
          })
          .where(eq(auditJobs.id, jobId));

        log.info('Updated audit job with commit SHA and workspace info', {
          jobId,
          commitSha: commitSha.substring(0, 7),
          shared: true,
        });
      } else {
        log.warn('Failed to capture commit SHA', { sourcePath: workspace.sourcePath });
      }

      // Install dependencies after cloning
      try {
        await this.installDependencies(workspace.sourcePath);
      } catch (installError: any) {
        log.warn('Failed to install dependencies, continuing anyway', {
          error: installError.message,
        });
      }

      // Create ignore files to exclude node_modules and other directories from analysis
      await this.createIgnoreFiles(workspace.sourcePath);

      return workspace.sourcePath;
    } catch (error: any) {
      log.error('Failed to clone GitHub repository', {
        error: error.message,
        owner,
        repo: repoName,
        branch,
      });
      throw new Error(`Git clone failed: ${error.message}`);
    }
  }

  /**
   * Install project dependencies (npm/yarn/pnpm)
   */
  private async installDependencies(projectPath: string): Promise<void> {
    log.info('Installing project dependencies', { projectPath });

    // Detect package manager from lock files
    let packageManager = 'npm';
    let installCommand = 'npm install';

    if (await fs.pathExists(path.join(projectPath, 'pnpm-lock.yaml'))) {
      packageManager = 'pnpm';
      installCommand = 'pnpm install --frozen-lockfile';
    } else if (await fs.pathExists(path.join(projectPath, 'yarn.lock'))) {
      packageManager = 'yarn';
      installCommand = 'yarn install --frozen-lockfile';
    } else if (await fs.pathExists(path.join(projectPath, 'package-lock.json'))) {
      packageManager = 'npm';
      installCommand = 'npm ci'; // Use ci for faster, reproducible installs
    } else if (await fs.pathExists(path.join(projectPath, 'package.json'))) {
      // package.json exists but no lock file - use regular install
      packageManager = 'npm';
      installCommand = 'npm install';
    } else {
      // No package.json - skip dependency installation
      log.info('No package.json found, skipping dependency installation');
      return;
    }

    log.info('Running dependency installation', { packageManager, command: installCommand });

    const { spawn } = await import('child_process');

    return new Promise((resolve, reject) => {
      const [cmd, ...args] = installCommand.split(' ');

      const proc = spawn(cmd, args, {
        cwd: projectPath,
        timeout: 300000, // 5 minutes timeout
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          log.info('Dependencies installed successfully', {
            packageManager,
            stdout: stdout.slice(0, 500), // First 500 chars
          });
          resolve();
        } else {
          log.error('Dependency installation failed', {
            packageManager,
            exitCode: code,
            stderr: stderr.slice(0, 1000),
          });
          reject(new Error(`${packageManager} install failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        log.error('Failed to spawn dependency installation process', { error: err.message });
        reject(err);
      });
    });
  }

  /**
   * Create ignore files to exclude unwanted directories from analysis
   */
  private async createIgnoreFiles(projectPath: string): Promise<void> {
    // Directories to exclude from analysis
    const excludeDirs = [
      'node_modules',
      '.git',
      'dist',
      'build',
      'out',
      'cache',
      'artifacts',
      'coverage',
      '.next',
      '.turbo',
      'test',
      'tests',
      'scripts',
      'docs',
    ];

    // Create .slitherignore
    const slitherIgnorePath = path.join(projectPath, '.slitherignore');
    await fs.writeFile(slitherIgnorePath, excludeDirs.join('\n'));

    // Create .semgrepignore
    const semgrepIgnorePath = path.join(projectPath, '.semgrepignore');
    await fs.writeFile(semgrepIgnorePath, excludeDirs.join('\n'));

    log.info('Created ignore files to exclude directories', {
      excludeDirs,
      projectPath,
    });
  }

  /**
   * Fetch source code for a deployed contract
   */
  private async fetchContractSource(input: DeployedContractInput, jobId: string): Promise<string> {
    const workDir = path.join(process.env.WORK_DIR || '/tmp/audits', jobId);
    await fs.ensureDir(workDir);

    // Determine explorer API URL
    const explorerUrls: Record<string, string> = {
      'ethereum': 'https://api.etherscan.io/api',
      'mainnet': 'https://api.etherscan.io/api',
      'goerli': 'https://api-goerli.etherscan.io/api',
      'sepolia': 'https://api-sepolia.etherscan.io/api',
      'polygon': 'https://api.polygonscan.com/api',
      'arbitrum': 'https://api.arbiscan.io/api',
      'optimism': 'https://api-optimistic.etherscan.io/api',
      'bsc': 'https://api.bscscan.com/api',
      'avalanche': 'https://api.snowtrace.io/api',
    };

    const apiUrl = explorerUrls[input.network.toLowerCase()];
    if (!apiUrl) {
      throw new Error(`Unsupported network: ${input.network}`);
    }

    // Fetch contract source
    const apiKey = input.explorerApiKey || process.env.ETHERSCAN_API_KEY;
    const url = `${apiUrl}?module=contract&action=getsourcecode&address=${input.address}&apikey=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json() as {
      status: string;
      message?: string;
      result?: Array<{ SourceCode: string; ContractName: string }>;
    };

    if (data.status !== '1' || !data.result?.[0]?.SourceCode) {
      throw new Error(`Failed to fetch contract source: ${data.message || 'Contract not verified'}`);
    }

    const sourceCode = data.result[0].SourceCode;
    const contractName = data.result[0].ContractName;

    // Handle different source code formats
    const sourceDir = path.join(workDir, 'source', 'src');
    await fs.ensureDir(sourceDir);

    if (sourceCode.startsWith('{')) {
      // Multi-file source (JSON)
      try {
        // Handle double-encoded JSON
        let parsed = sourceCode.startsWith('{{')
          ? JSON.parse(sourceCode.slice(1, -1))
          : JSON.parse(sourceCode);

        if (parsed.sources) {
          // Standard JSON input format
          for (const [filePath, fileData] of Object.entries(parsed.sources)) {
            const fullPath = path.join(workDir, 'source', filePath);
            await fs.ensureDir(path.dirname(fullPath));
            await fs.writeFile(fullPath, (fileData as any).content);
          }
        }
      } catch {
        // Single file
        await fs.writeFile(
          path.join(sourceDir, `${contractName}.sol`),
          sourceCode
        );
      }
    } else {
      // Single file source
      await fs.writeFile(
        path.join(sourceDir, `${contractName}.sol`),
        sourceCode
      );
    }

    // Create minimal foundry.toml
    await fs.writeFile(
      path.join(workDir, 'source', 'foundry.toml'),
      `[profile.default]\nsrc = "src"\nout = "out"\nlibs = ["lib"]\n`
    );

    return path.join(workDir, 'source');
  }

  /**
   * Run the SOP orchestrator
   */
  private async runOrchestrator(
    jobId: string,
    projectPath: string,
    sop: SOPDefinition,
    request: UnifiedAuditRequest
  ): Promise<void> {
    const orchestrator = new SOPOrchestrator({
      sop,
      jobId,
      projectPath,
      auditDepth: request.depth,
      userId: request.userId,
      projectId: request.projectId,
    });

    // Set up event listeners
    orchestrator.on('step:start', (stepId, stepName) => {
      this.emit('step:start', jobId, stepId, stepName);
    });

    orchestrator.on('step:progress', (stepId, pct, message) => {
      this.emit('step:progress', jobId, stepId, pct, message);
    });

    orchestrator.on('step:complete', (stepId, result) => {
      this.emit('step:complete', jobId, stepId, result);
    });

    orchestrator.on('step:failed', (stepId, error) => {
      this.emit('step:failed', jobId, stepId, error);
    });

    orchestrator.on('audit:complete', async (findings, score) => {
      await this.handleAuditComplete(jobId, findings, score, request);
    });

    orchestrator.on('audit:failed', async (error) => {
      await this.handleAuditFailed(jobId, error);
    });

    // Execute
    try {
      await orchestrator.execute();
    } catch (error: any) {
      await this.handleAuditFailed(jobId, error.message);
    }
  }

  /**
   * Handle audit completion
   */
  private async handleAuditComplete(
    jobId: string,
    findings: StepFinding[],
    score: number,
    request: UnifiedAuditRequest
  ): Promise<void> {
    log.info('Audit completed', {
      jobId,
      findingsCount: findings.length,
      score,
    });

    // Apply final filtering to remove any noise that slipped through
    const filteredFindings = this.filterNoisyFindings(findings);
    const removedCount = findings.length - filteredFindings.length;

    if (removedCount > 0) {
      log.info('Filtered noisy findings', {
        jobId,
        originalCount: findings.length,
        filteredCount: filteredFindings.length,
        removed: removedCount,
      });
    }

    // Calculate grade
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

    // Calculate dependency scores
    const dependencyScores = calculateDependencyScores(filteredFindings);

    // Generate report
    const reportId = crypto.randomUUID();
    const report = this.generateReport(filteredFindings, score, request);

    // Save structured results to audit_results table
    // Use UPSERT to handle retry cases where results already exist
    await db.insert(auditResults).values({
      jobId,
      scoreValue: score,
      scoreLabel: grade,
      findings: filteredFindings as any, // JSONB field
      summary: `Found ${filteredFindings.length} findings with audit score ${score}`,
      metadata: {
        findingsCount: filteredFindings.length,
        filteredOutCount: removedCount,
        bySeverity: {
          critical: filteredFindings.filter(f => f.severity === 'critical').length,
          high: filteredFindings.filter(f => f.severity === 'high').length,
          medium: filteredFindings.filter(f => f.severity === 'medium').length,
          low: filteredFindings.filter(f => f.severity === 'low').length,
          info: filteredFindings.filter(f => f.severity === 'info').length,
        },
        depth: request.depth,
        dependencyScores, // Add dependency scores to metadata
      },
    }).onConflictDoUpdate({
      target: auditResults.jobId,
      set: {
        scoreValue: score,
        scoreLabel: grade,
        findings: filteredFindings as any,
        summary: `Found ${filteredFindings.length} findings with audit score ${score}`,
        metadata: {
          findingsCount: filteredFindings.length,
          filteredOutCount: removedCount,
          bySeverity: {
            critical: filteredFindings.filter(f => f.severity === 'critical').length,
            high: filteredFindings.filter(f => f.severity === 'high').length,
            medium: filteredFindings.filter(f => f.severity === 'medium').length,
            low: filteredFindings.filter(f => f.severity === 'low').length,
            info: filteredFindings.filter(f => f.severity === 'info').length,
          },
          depth: request.depth,
          dependencyScores,
        },
      },
    });

    // Save report
    await db.insert(auditReports).values({
      id: reportId,
      jobId,
      reportData: report,
      createdAt: new Date(),
    });

    // Generate post-audit clarification questions for liability triage (with intelligence)
    try {
      const { generatePostAuditClarifications } = await import('./postAuditClarificationGenerator.js');
      const { analyzeAllClarificationNeeds, generateIntelligenceReport } = await import('./clarificationIntelligence.js');

      // Map StepFinding to Finding type for clarification generator
      const mappedFindings = filteredFindings.map(f => ({
        id: f.findingId || crypto.randomUUID(),
        title: f.title || 'Unknown',
        description: f.description || '',
        severity: f.severity as 'critical' | 'high' | 'medium' | 'low' | 'info',
        location: f.location ? {
          file: f.location.file,
          line: f.location.line
        } : undefined,
        recommendation: f.recommendation,
        rawOutput: f.rawOutput,
      }));

      // Get business risk checks from audit results (may not exist for all audit types)
      const businessRisks: any[] = []; // TODO: Extract from results when available

      // Run clarification intelligence analysis
      const intelligence = analyzeAllClarificationNeeds(mappedFindings, businessRisks);

      // Log intelligence report for debugging
      const report = generateIntelligenceReport(mappedFindings, businessRisks);
      log.info('Clarification intelligence analysis', {
        jobId,
        questionsNeeded: intelligence.questionsNeeded,
        questionsSkipped: intelligence.questionsSkipped,
        report
      });

      // Generate only questions that intelligence system approves
      const questionCount = await generatePostAuditClarifications(jobId, mappedFindings, intelligence);

      log.info('Post-audit clarifications generated', {
        jobId,
        questionCount,
        intelligentlySkipped: intelligence.questionsSkipped
      });
    } catch (error: any) {
      log.error('Failed to generate post-audit clarifications', { jobId, error: error.message });
      // Don't fail the audit if clarification generation fails
    }

    // Generate OG image for social sharing
    try {
      const { generateOGImage } = await import('./ogImageGenerator.js');

      // Determine project name from source
      let projectName = 'Smart Contract';
      if (request.source.type === 'github-repo') {
        const repoUrl = request.source.repoUrl;
        if (repoUrl && typeof repoUrl === 'string') {
          const match = repoUrl.match(/github\.com\/[^/]+\/([^/.]+)/);
          projectName = match ? match[1] : projectName;
        }
      } else if (request.source.type === 'deployed-contract') {
        const address = request.source.address;
        if (address && typeof address === 'string') {
          // Use first 8 chars of address as fallback name
          projectName = address.slice(0, 10) + '...';
        }
      }

      // Fetch project logo if projectId is provided
      let projectLogoUrl: string | undefined;
      if (request.projectId) {
        try {
          const [project] = await db.select().from(projects).where(eq(projects.id, request.projectId));
          if (project?.logoUrl) {
            projectLogoUrl = project.logoUrl;
            log.info('Found project logo for OG image', { projectId: request.projectId });
          }
        } catch (err: any) {
          log.warn('Failed to fetch project logo', { projectId: request.projectId, error: err.message });
        }
      }

      // Determine status based on score
      let status: 'verified' | 'warning' | 'critical' = 'verified';
      const criticalCount = filteredFindings.filter(f => f.severity === 'critical').length;
      const highCount = filteredFindings.filter(f => f.severity === 'high').length;

      if (criticalCount > 0) {
        status = 'critical';
      } else if (highCount > 0 || score < 70) {
        status = 'warning';
      }

      // Get component scores (top 3 for OG image)
      const componentScoresForImage = dependencyScores.slice(0, 3).map((c) => ({
        library: c.library,
        grade: c.grade,
        score: c.score,
      }));

      await generateOGImage(jobId, {
        projectName,
        auditType: request.depth,
        grade,
        score,
        status,
        reportId: jobId.slice(0, 8).toUpperCase(),
        projectLogoUrl, // Pass project logo if available
        severityCounts: {
          critical: filteredFindings.filter(f => f.severity === 'critical').length,
          high: filteredFindings.filter(f => f.severity === 'high').length,
          medium: filteredFindings.filter(f => f.severity === 'medium').length,
          low: filteredFindings.filter(f => f.severity === 'low').length,
        },
        componentScores: componentScoresForImage, // Include top 3 component scores
      });

      log.info('OG image generated', { jobId, projectName, hasProjectLogo: !!projectLogoUrl });
    } catch (error: any) {
      log.error('Failed to generate OG image', { jobId, error: error.message });
      // Don't fail the audit if OG image generation fails
    }

    // Update job status with completedAt timestamp
    await db
      .update(auditJobs)
      .set({
        status: 'completed',
        progressPct: 100,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(auditJobs.id, jobId));

    this.emit('audit:complete', {
      jobId,
      reportId,
      findings,
      score,
    });
  }

  /**
   * Sanitize error message to be user-friendly (hide technical details)
   */
  private sanitizeErrorMessage(error: string, currentStep?: string): string {
    // Log the real error for debugging
    log.debug('Original error message', { error });

    // If we have a current step, show a clean message
    if (currentStep) {
      return `Audit incomplete. Last step: ${currentStep}. Please retry the audit.`;
    }

    // Generic fallback message
    return 'Audit failed. Please retry the audit.';
  }

  /**
   * Handle audit failure
   */
  private async handleAuditFailed(jobId: string, error: string): Promise<void> {
    log.error('Audit failed', { jobId, error });

    // Get current step name for better error message
    const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));
    const currentStep = job?.currentStepName || undefined;

    // Sanitize error message for users
    const userFriendlyError = this.sanitizeErrorMessage(error, currentStep);

    await db
      .update(auditJobs)
      .set({
        status: 'failed',
        errorMessage: userFriendlyError,
        updatedAt: new Date(),
      })
      .where(eq(auditJobs.id, jobId));

    this.emit('audit:failed', { jobId, error });
  }

  /**
   * Filter out noisy findings before storage
   */
  private filterNoisyFindings(findings: StepFinding[]): StepFinding[] {
    return findings.filter(finding => {
      // Filter out findings with invalid/empty descriptions
      if (!finding.description || finding.description.trim().length < 3) {
        return false;
      }

      // Filter out findings that only contain non-alphabetic characters
      if (/^[^a-zA-Z]*$/.test(finding.description)) {
        return false;
      }

      // Filter out frontend files that slipped through
      const filePath = finding.location?.file || '';
      const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();

      const frontendPaths = [
        'frontend/',
        'ui/',
        'app/',
        'pages/',
        'components/',
        'examples/',
        'public/',
        'dist/',
        'build/',
        '.next/',
        '.nuxt/',
      ];

      if (frontendPaths.some(dir => normalizedPath.includes(dir))) {
        return false;
      }

      const frontendExtensions = ['.tsx', '.jsx', '.vue', '.svelte', '.html', '.css', '.scss'];
      if (frontendExtensions.some(ext => normalizedPath.endsWith(ext))) {
        return false;
      }

      // Keep the finding if it passed all filters
      return true;
    });
  }

  /**
   * Generate audit report
   */
  private generateReport(
    findings: StepFinding[],
    score: number,
    request: UnifiedAuditRequest
  ): Record<string, any> {
    // Group findings by severity
    const bySeverity = {
      critical: findings.filter((f) => f.severity === 'critical'),
      high: findings.filter((f) => f.severity === 'high'),
      medium: findings.filter((f) => f.severity === 'medium'),
      low: findings.filter((f) => f.severity === 'low'),
      info: findings.filter((f) => f.severity === 'info'),
    };

    // Group findings by category
    const byCategory: Record<string, StepFinding[]> = {};
    for (const finding of findings) {
      const category = finding.stepId.split('-')[0] || 'other';
      if (!byCategory[category]) {
        byCategory[category] = [];
      }
      byCategory[category].push(finding);
    }

    // Calculate grade
    let grade: string;
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';

    return {
      generatedAt: new Date().toISOString(),
      source: {
        type: request.source.type,
        ...(request.source.type === 'github-repo' && { repoUrl: (request.source as GitHubRepoInput).repoUrl }),
        ...(request.source.type === 'deployed-contract' && {
          address: (request.source as DeployedContractInput).address,
          network: (request.source as DeployedContractInput).network,
          chainId: (request.source as DeployedContractInput).chainId,
        }),
      },
      auditDepth: request.depth,
      summary: {
        score,
        grade,
        totalFindings: findings.length,
        bySeverity: {
          critical: bySeverity.critical.length,
          high: bySeverity.high.length,
          medium: bySeverity.medium.length,
          low: bySeverity.low.length,
          info: bySeverity.info.length,
        },
      },
      findings,
      findingsBySeverity: bySeverity,
      findingsByCategory: byCategory,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const unifiedAuditService = UnifiedAuditService.getInstance();

// ============================================================================
// Convenience Functions
// ============================================================================

export async function startUnifiedAudit(request: UnifiedAuditRequest): Promise<UnifiedAuditResult> {
  return unifiedAuditService.startAudit(request);
}

export async function getAuditProgress(jobId: string) {
  return unifiedAuditService.getProgress(jobId);
}

export async function cancelAudit(jobId: string): Promise<void> {
  return unifiedAuditService.cancelAudit(jobId);
}
