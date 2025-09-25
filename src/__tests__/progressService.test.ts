import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { 
  newProgress, 
  saveProgress, 
  loadProgress, 
  setPhasePct, 
  bumpPhase,
  PHASE_WEIGHTS 
} from '../services/progressService.js';

describe('progressService', () => {
  let tempDir: string;
  let runPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uatu-test-'));
    runPath = path.join(tempDir, 'run1');
    await fs.ensureDir(runPath);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should create new progress with correct initial state', () => {
    const progress = newProgress('test-project', 'main', '123456789');
    
    expect(progress.project).toBe('test-project');
    expect(progress.branch).toBe('main');
    expect(progress.timestamp).toBe('123456789');
    expect(progress.overall_pct).toBe(0);
    expect(progress.phases).toHaveLength(5);
    
    // All phases should start at 0%
    progress.phases.forEach(phase => {
      expect(phase.pct).toBe(0);
      expect(PHASE_WEIGHTS[phase.name]).toBeDefined();
    });
  });

  it('should save and load progress correctly', async () => {
    const original = newProgress('test-project', 'main', '123456789');
    original.last_event = 'Test event';
    
    await saveProgress(runPath, original);
    const loaded = await loadProgress(runPath);
    
    expect(loaded).not.toBeNull();
    expect(loaded!.project).toBe('test-project');
    expect(loaded!.last_event).toBe('Test event');
  });

  it('should calculate overall percentage correctly', async () => {
    const progress = newProgress('test-project', 'main', '123456789');
    await saveProgress(runPath, progress);
    
    // Set bootstrap to 100% (weight: 10)
    await setPhasePct(runPath, 'bootstrap', 100);
    const updated1 = await loadProgress(runPath);
    expect(updated1!.overall_pct).toBe(10); // 10% * 100% = 10%
    
    // Set inventory to 50% (weight: 20)
    await setPhasePct(runPath, 'inventory', 50);
    const updated2 = await loadProgress(runPath);
    expect(updated2!.overall_pct).toBe(20); // 10 + (20 * 0.5) = 20%
    
    // Set analysis to 100% (weight: 35)
    await setPhasePct(runPath, 'analysis', 100);
    const updated3 = await loadProgress(runPath);
    expect(updated3!.overall_pct).toBe(55); // 10 + 10 + 35 = 55%
  });

  it('should bump phase percentage correctly', async () => {
    const progress = newProgress('test-project', 'main', '123456789');
    await saveProgress(runPath, progress);
    
    await bumpPhase(runPath, 'bootstrap', 25, 'First step');
    const updated1 = await loadProgress(runPath);
    expect(updated1!.phases[0].pct).toBe(25);
    expect(updated1!.phases[0].step).toBe('First step');
    
    await bumpPhase(runPath, 'bootstrap', 30);
    const updated2 = await loadProgress(runPath);
    expect(updated2!.phases[0].pct).toBe(55);
    
    // Should cap at 100%
    await bumpPhase(runPath, 'bootstrap', 50);
    const updated3 = await loadProgress(runPath);
    expect(updated3!.phases[0].pct).toBe(100);
  });

  it('should handle missing progress file gracefully', async () => {
    const loaded = await loadProgress(path.join(tempDir, 'nonexistent'));
    expect(loaded).toBeNull();
  });

  it('should validate weight sum equals 100', () => {
    const totalWeight = Object.values(PHASE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(totalWeight).toBe(100);
  });
});
