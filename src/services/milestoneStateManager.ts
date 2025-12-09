import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'milestone-state-manager' });

/**
 * Advanced Milestone State Persistence Manager
 * Handles state persistence, recovery, and checkpoint management for long-running audits
 */

export interface Checkpoint {
  id: string;
  timestamp: Date;
  milestone: number;
  description: string;
  state: any;
  contextHash?: string; // Hash of code context to detect changes
}

export interface StateSnapshot {
  jobId: string;
  timestamp: Date;
  milestones: any[];
  checkpoints: Checkpoint[];
  metadata: {
    version: string;
    framework: string;
  };
}

export class MilestoneStateManager {
  private stateDir: string;
  private jobId: string;
  private checkpoints: Checkpoint[] = [];

  constructor(jobId: string, projectPath: string) {
    this.jobId = jobId;
    this.stateDir = path.join(projectPath, 'context', '.state');
  }

  /**
   * Initialize state directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.stateDir, { recursive: true });
      log.info(`State directory initialized: ${this.stateDir}`);
    } catch (error) {
      log.error(`Failed to initialize state directory:`, error);
      throw error;
    }
  }

  /**
   * Save state snapshot
   */
  async saveSnapshot(snapshot: StateSnapshot): Promise<void> {
    try {
      const filename = `state_${this.jobId}_${Date.now()}.json`;
      const filePath = path.join(this.stateDir, filename);

      await fs.writeFile(
        filePath,
        JSON.stringify(snapshot, null, 2),
        'utf-8'
      );

      // Also save as "latest" for quick recovery
      const latestPath = path.join(this.stateDir, `state_${this.jobId}_latest.json`);
      await fs.writeFile(
        latestPath,
        JSON.stringify(snapshot, null, 2),
        'utf-8'
      );

      log.info(`State snapshot saved: ${filename}`);
    } catch (error) {
      log.error(`Failed to save state snapshot:`, error);
      throw error;
    }
  }

  /**
   * Load latest state snapshot
   */
  async loadLatestSnapshot(): Promise<StateSnapshot | null> {
    try {
      const latestPath = path.join(this.stateDir, `state_${this.jobId}_latest.json`);
      const content = await fs.readFile(latestPath, 'utf-8');
      const snapshot = JSON.parse(content);

      // Convert timestamp strings back to Dates
      snapshot.timestamp = new Date(snapshot.timestamp);
      snapshot.checkpoints = snapshot.checkpoints.map((cp: any) => ({
        ...cp,
        timestamp: new Date(cp.timestamp)
      }));

      log.info(`Loaded latest state snapshot from ${latestPath}`);
      return snapshot;
    } catch (error) {
      log.debug(`No previous state found: ${error}`);
      return null;
    }
  }

  /**
   * Load specific state snapshot by timestamp
   */
  async loadSnapshot(timestamp: number): Promise<StateSnapshot | null> {
    try {
      const filename = `state_${this.jobId}_${timestamp}.json`;
      const filePath = path.join(this.stateDir, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const snapshot = JSON.parse(content);

      snapshot.timestamp = new Date(snapshot.timestamp);
      snapshot.checkpoints = snapshot.checkpoints.map((cp: any) => ({
        ...cp,
        timestamp: new Date(cp.timestamp)
      }));

      log.info(`Loaded state snapshot: ${filename}`);
      return snapshot;
    } catch (error) {
      log.error(`Failed to load snapshot at ${timestamp}:`, error);
      return null;
    }
  }

  /**
   * Create checkpoint
   */
  async createCheckpoint(
    milestone: number,
    description: string,
    state: any,
    contextHash?: string
  ): Promise<Checkpoint> {
    const checkpoint: Checkpoint = {
      id: `cp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      milestone,
      description,
      state,
      contextHash
    };

    this.checkpoints.push(checkpoint);

    // Save checkpoint to disk
    try {
      const filename = `checkpoint_${this.jobId}_${checkpoint.id}.json`;
      const filePath = path.join(this.stateDir, filename);

      await fs.writeFile(
        filePath,
        JSON.stringify(checkpoint, null, 2),
        'utf-8'
      );

      log.info(`Checkpoint created: ${checkpoint.id} at milestone ${milestone}`);
    } catch (error) {
      log.error(`Failed to save checkpoint:`, error);
    }

    return checkpoint;
  }

  /**
   * Load checkpoint by ID
   */
  async loadCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
    try {
      const filename = `checkpoint_${this.jobId}_${checkpointId}.json`;
      const filePath = path.join(this.stateDir, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const checkpoint = JSON.parse(content);

      checkpoint.timestamp = new Date(checkpoint.timestamp);

      log.info(`Loaded checkpoint: ${checkpointId}`);
      return checkpoint;
    } catch (error) {
      log.error(`Failed to load checkpoint ${checkpointId}:`, error);
      return null;
    }
  }

  /**
   * List all checkpoints for this job
   */
  async listCheckpoints(): Promise<Checkpoint[]> {
    try {
      const files = await fs.readdir(this.stateDir);
      const checkpointFiles = files.filter(f =>
        f.startsWith(`checkpoint_${this.jobId}_`)
      );

      const checkpoints: Checkpoint[] = [];
      for (const file of checkpointFiles) {
        try {
          const content = await fs.readFile(
            path.join(this.stateDir, file),
            'utf-8'
          );
          const checkpoint = JSON.parse(content);
          checkpoint.timestamp = new Date(checkpoint.timestamp);
          checkpoints.push(checkpoint);
        } catch (error) {
          log.warn(`Failed to load checkpoint file ${file}:`, error);
        }
      }

      // Sort by timestamp descending
      checkpoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return checkpoints;
    } catch (error) {
      log.error(`Failed to list checkpoints:`, error);
      return [];
    }
  }

  /**
   * Find most recent checkpoint before a specific milestone
   */
  async findCheckpointBeforeMilestone(milestone: number): Promise<Checkpoint | null> {
    const checkpoints = await this.listCheckpoints();

    for (const checkpoint of checkpoints) {
      if (checkpoint.milestone < milestone) {
        return checkpoint;
      }
    }

    return null;
  }

  /**
   * Clean up old checkpoints (keep only last N)
   */
  async cleanupCheckpoints(keepCount: number = 10): Promise<void> {
    try {
      const checkpoints = await this.listCheckpoints();

      if (checkpoints.length <= keepCount) {
        return;
      }

      // Delete oldest checkpoints
      const toDelete = checkpoints.slice(keepCount);
      for (const checkpoint of toDelete) {
        const filename = `checkpoint_${this.jobId}_${checkpoint.id}.json`;
        const filePath = path.join(this.stateDir, filename);

        try {
          await fs.unlink(filePath);
          log.debug(`Deleted old checkpoint: ${checkpoint.id}`);
        } catch (error) {
          log.warn(`Failed to delete checkpoint ${checkpoint.id}:`, error);
        }
      }

      log.info(`Cleaned up ${toDelete.length} old checkpoints`);
    } catch (error) {
      log.error(`Failed to cleanup checkpoints:`, error);
    }
  }

  /**
   * Validate context hasn't changed since checkpoint
   */
  validateContextHash(checkpoint: Checkpoint, currentHash: string): boolean {
    if (!checkpoint.contextHash) {
      log.warn('Checkpoint has no context hash, cannot validate');
      return true; // Assume valid if no hash
    }

    const isValid = checkpoint.contextHash === currentHash;

    if (!isValid) {
      log.warn(
        `Context hash mismatch! Checkpoint: ${checkpoint.contextHash}, Current: ${currentHash}`
      );
      log.warn('Code may have changed since checkpoint was created');
    }

    return isValid;
  }

  /**
   * Export state for debugging or analysis
   */
  async exportState(outputPath: string): Promise<void> {
    try {
      const snapshot = await this.loadLatestSnapshot();
      const checkpoints = await this.listCheckpoints();

      const exportData = {
        snapshot,
        checkpoints,
        exportedAt: new Date().toISOString()
      };

      await fs.writeFile(
        outputPath,
        JSON.stringify(exportData, null, 2),
        'utf-8'
      );

      log.info(`State exported to ${outputPath}`);
    } catch (error) {
      log.error(`Failed to export state:`, error);
      throw error;
    }
  }

  /**
   * Import state from exported file
   */
  async importState(inputPath: string): Promise<void> {
    try {
      const content = await fs.readFile(inputPath, 'utf-8');
      const importData = JSON.parse(content);

      // Restore snapshot
      if (importData.snapshot) {
        await this.saveSnapshot(importData.snapshot);
      }

      // Restore checkpoints
      if (importData.checkpoints) {
        for (const checkpoint of importData.checkpoints) {
          const filename = `checkpoint_${this.jobId}_${checkpoint.id}.json`;
          const filePath = path.join(this.stateDir, filename);

          await fs.writeFile(
            filePath,
            JSON.stringify(checkpoint, null, 2),
            'utf-8'
          );
        }
      }

      log.info(`State imported from ${inputPath}`);
    } catch (error) {
      log.error(`Failed to import state:`, error);
      throw error;
    }
  }

  /**
   * Delete all state for this job (cleanup)
   */
  async deleteAllState(): Promise<void> {
    try {
      const files = await fs.readdir(this.stateDir);
      const jobFiles = files.filter(f =>
        f.startsWith(`state_${this.jobId}_`) || f.startsWith(`checkpoint_${this.jobId}_`)
      );

      for (const file of jobFiles) {
        await fs.unlink(path.join(this.stateDir, file));
      }

      log.info(`Deleted all state for job ${this.jobId} (${jobFiles.length} files)`);
    } catch (error) {
      log.error(`Failed to delete state:`, error);
      throw error;
    }
  }
}
