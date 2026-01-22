/**
 * .uatu Folder Management Service
 *
 * Manages the .uatu/ directory which stores all audit state, metadata, and progress.
 * This allows audits to be resumed, provides transparency, and keeps audit data organized.
 */

import fs from 'fs-extra';
import path from 'node:path';
import { createHash } from 'crypto';

export interface UatuSessionData {
  jobId: string;
  projectName: string;
  startedAt: string;
  lastUpdatedAt: string;
  auditDepth: 'quick' | 'standard' | 'deep';
  status: 'running' | 'paused' | 'completed' | 'failed';
  completedSteps: string[];
  totalSteps: number;
  currentStep?: string;
  sopId: string;
  framework: string;
  fileHashes: Record<string, string>; // For change detection
}

export interface UatuStepData {
  stepId: string;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  success: boolean;
  data?: any; // Step output data
  findings?: any[];
  error?: string;
}

export interface UatuCheckpoint {
  checkpointId: string;
  createdAt: string;
  stepId: string;
  stepData: Map<string, any>;
  findings: any[];
  message: string;
}

/**
 * Initialize .uatu folder structure in the project directory
 */
export async function initializeUatuFolder(projectPath: string, jobId: string): Promise<string> {
  const uatuPath = path.join(projectPath, '.uatu');

  // Create folder structure
  await fs.ensureDir(uatuPath);
  await fs.ensureDir(path.join(uatuPath, 'checkpoints'));
  await fs.ensureDir(path.join(uatuPath, 'logs'));

  console.log(`Initialized .uatu folder at ${uatuPath}`);

  return uatuPath;
}

/**
 * Create or update session data
 */
export async function saveSessionData(
  projectPath: string,
  sessionData: UatuSessionData
): Promise<void> {
  const sessionPath = path.join(projectPath, '.uatu', 'session.json');

  await fs.writeJSON(sessionPath, {
    ...sessionData,
    lastUpdatedAt: new Date().toISOString(),
  }, { spaces: 2 });

  console.log('Saved session data to .uatu/session.json');
}

/**
 * Load session data
 */
export async function loadSessionData(projectPath: string): Promise<UatuSessionData | null> {
  const sessionPath = path.join(projectPath, '.uatu', 'session.json');

  try {
    const data = await fs.readJSON(sessionPath);
    console.log('Loaded session data from .uatu/session.json');
    return data;
  } catch (error) {
    console.log('No existing session data found');
    return null;
  }
}

/**
 * Save step data
 */
export async function saveStepData(
  projectPath: string,
  stepId: string,
  stepData: UatuStepData
): Promise<void> {
  const stepsDataPath = path.join(projectPath, '.uatu', 'stepData.json');

  let allStepsData: Record<string, UatuStepData> = {};

  // Load existing step data
  try {
    allStepsData = await fs.readJSON(stepsDataPath);
  } catch {
    // File doesn't exist yet
  }

  // Update with new step data
  allStepsData[stepId] = {
    ...stepData,
    completedAt: stepData.completedAt || new Date().toISOString(),
  };

  await fs.writeJSON(stepsDataPath, allStepsData, { spaces: 2 });

  console.log(`Saved step data for ${stepId} to .uatu/stepData.json`);
}

/**
 * Load all step data
 */
export async function loadStepData(projectPath: string): Promise<Record<string, UatuStepData>> {
  const stepsDataPath = path.join(projectPath, '.uatu', 'stepData.json');

  try {
    return await fs.readJSON(stepsDataPath);
  } catch {
    return {};
  }
}

/**
 * Create a checkpoint for resuming
 */
export async function createCheckpoint(
  projectPath: string,
  checkpoint: UatuCheckpoint
): Promise<void> {
  const checkpointPath = path.join(
    projectPath,
    '.uatu',
    'checkpoints',
    `${checkpoint.checkpointId}.json`
  );

  // Convert Map to object for JSON serialization
  const stepDataObject: Record<string, any> = {};
  checkpoint.stepData.forEach((value, key) => {
    stepDataObject[key] = value;
  });

  await fs.writeJSON(checkpointPath, {
    ...checkpoint,
    stepData: stepDataObject,
  }, { spaces: 2 });

  console.log(`Created checkpoint ${checkpoint.checkpointId}`);
}

/**
 * Load the latest checkpoint
 */
export async function loadLatestCheckpoint(projectPath: string): Promise<UatuCheckpoint | null> {
  const checkpointsDir = path.join(projectPath, '.uatu', 'checkpoints');

  try {
    const files = await fs.readdir(checkpointsDir);
    if (files.length === 0) return null;

    // Sort by creation time (most recent first)
    const checkpoints = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(checkpointsDir, file);
        const data = await fs.readJSON(filePath);
        return { ...data, filePath };
      })
    );

    checkpoints.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const latest = checkpoints[0];

    // Convert stepData object back to Map
    const stepDataMap = new Map<string, any>();
    if (latest.stepData) {
      Object.entries(latest.stepData).forEach(([key, value]) => {
        stepDataMap.set(key, value);
      });
    }

    return {
      ...latest,
      stepData: stepDataMap,
    };
  } catch (error) {
    console.log('No checkpoints found');
    return null;
  }
}

/**
 * Calculate file hash for change detection
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return '';
  }
}

/**
 * Calculate hashes for all contract files in src/
 */
export async function calculateProjectHashes(projectPath: string): Promise<Record<string, string>> {
  const srcDir = path.join(projectPath, 'src');
  const hashes: Record<string, string> = {};

  try {
    const files = await fs.readdir(srcDir, { withFileTypes: true });

    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.sol')) {
        const filePath = path.join(srcDir, file.name);
        hashes[file.name] = await calculateFileHash(filePath);
      } else if (file.isDirectory()) {
        // Recursively hash subdirectories
        const subFiles = await fs.readdir(path.join(srcDir, file.name), { recursive: true });
        for (const subFile of subFiles as any[]) {
          if (typeof subFile === 'string' && subFile.endsWith('.sol')) {
            const relativePath = path.join(file.name, subFile);
            const fullPath = path.join(srcDir, relativePath);
            hashes[relativePath] = await calculateFileHash(fullPath);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Failed to calculate project hashes:', error);
  }

  return hashes;
}

/**
 * Check if code has changed since last audit
 */
export async function hasCodeChanged(
  projectPath: string,
  previousHashes: Record<string, string>
): Promise<boolean> {
  const currentHashes = await calculateProjectHashes(projectPath);

  // Check if any file hash changed
  for (const [file, hash] of Object.entries(currentHashes)) {
    if (previousHashes[file] !== hash) {
      console.log(`Code changed: ${file}`);
      return true;
    }
  }

  // Check if files were added or removed
  const previousFiles = Object.keys(previousHashes);
  const currentFiles = Object.keys(currentHashes);

  if (previousFiles.length !== currentFiles.length) {
    console.log('File count changed');
    return true;
  }

  console.log('No code changes detected');
  return false;
}

/**
 * Save audit metadata summary
 */
export async function saveAuditSummary(
  projectPath: string,
  summary: {
    jobId: string;
    completedAt: string;
    duration: number;
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    score: number;
    testsGenerated: number;
    testsExecuted: number;
  }
): Promise<void> {
  const summaryPath = path.join(projectPath, '.uatu', 'summary.json');

  await fs.writeJSON(summaryPath, {
    ...summary,
    generatedAt: new Date().toISOString(),
  }, { spaces: 2 });

  console.log('Saved audit summary to .uatu/summary.json');
}

/**
 * Clean up old checkpoints (keep last 5)
 */
export async function cleanupOldCheckpoints(projectPath: string): Promise<void> {
  const checkpointsDir = path.join(projectPath, '.uatu', 'checkpoints');

  try {
    const files = await fs.readdir(checkpointsDir);
    if (files.length <= 5) return;

    // Sort by creation time
    const checkpoints = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(checkpointsDir, file);
        const stats = await fs.stat(filePath);
        return { file, filePath, time: stats.mtime.getTime() };
      })
    );

    checkpoints.sort((a, b) => b.time - a.time);

    // Delete all except the 5 most recent
    for (let i = 5; i < checkpoints.length; i++) {
      await fs.remove(checkpoints[i].filePath);
      console.log(`Deleted old checkpoint: ${checkpoints[i].file}`);
    }
  } catch (error) {
    console.warn('Failed to cleanup old checkpoints:', error);
  }
}

/**
 * Export all .uatu data for debugging
 */
export async function exportUatuData(projectPath: string): Promise<any> {
  const uatuPath = path.join(projectPath, '.uatu');

  try {
    const sessionData = await loadSessionData(projectPath);
    const stepData = await loadStepData(projectPath);
    const latestCheckpoint = await loadLatestCheckpoint(projectPath);

    return {
      session: sessionData,
      steps: stepData,
      latestCheckpoint,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Failed to export .uatu data:', error);
    return null;
  }
}
