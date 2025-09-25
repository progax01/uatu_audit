import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { 
  enqueue, 
  claimNext, 
  complete, 
  updateJobPct, 
  attachRunTimestamp,
  updateJobNote 
} from '../services/jobQueue.js';

// Mock the getUatuHome function
const originalUatuHome = process.env.UATU_HOME;

describe('jobQueue', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uatu-queue-test-'));
    process.env.UATU_HOME = tempDir;
    
    // Create the queue directory structure
    await fs.ensureDir(path.join(tempDir, 'queue'));
    
    // Initialize empty queue file
    await fs.writeJson(path.join(tempDir, 'queue', 'jobs.json'), { nextId: 1, jobs: [] });
  });

  afterEach(async () => {
    await fs.remove(tempDir);
    if (originalUatuHome) {
      process.env.UATU_HOME = originalUatuHome;
    } else {
      delete process.env.UATU_HOME;
    }
  });

  it('should enqueue a job with correct initial state', async () => {
    const job = await enqueue({
      repo: 'https://github.com/test/repo.git',
      project: 'test-project',
      branch: 'main',
      ai: true
    });

    expect(job.id).toBe(1);
    expect(job.repo).toBe('https://github.com/test/repo.git');
    expect(job.project).toBe('test-project');
    expect(job.branch).toBe('main');
    expect(job.ai).toBe(true);
    expect(job.status).toBe('pending');
    expect(job.pct).toBe(0);
    expect(job.createdAt).toBeDefined();
  });

  it('should assign sequential IDs to jobs', async () => {
    const job1 = await enqueue({
      repo: 'https://github.com/test/repo1.git',
      project: 'project1',
      branch: 'main'
    });

    const job2 = await enqueue({
      repo: 'https://github.com/test/repo2.git',
      project: 'project2',
      branch: 'main'
    });

    expect(job1.id).toBe(1);
    expect(job2.id).toBe(2);
  });

  it('should claim next pending job and mark as running', async () => {
    // Enqueue multiple jobs
    await enqueue({
      repo: 'https://github.com/test/repo1.git',
      project: 'project1',
      branch: 'main'
    });

    await enqueue({
      repo: 'https://github.com/test/repo2.git',
      project: 'project2',
      branch: 'main'
    });

    // Claim first job
    const claimed = await claimNext();
    expect(claimed).not.toBeNull();
    expect(claimed!.id).toBe(1);
    expect(claimed!.status).toBe('running');
    expect(claimed!.startedAt).toBeDefined();

    // Claim second job
    const claimed2 = await claimNext();
    expect(claimed2).not.toBeNull();
    expect(claimed2!.id).toBe(2);
    expect(claimed2!.status).toBe('running');
  });

  it('should return null when no pending jobs', async () => {
    const claimed = await claimNext();
    expect(claimed).toBeNull();
  });

  it('should complete job successfully', async () => {
    const job = await enqueue({
      repo: 'https://github.com/test/repo.git',
      project: 'test-project',
      branch: 'main'
    });

    const claimed = await claimNext();
    expect(claimed).not.toBeNull();

    await complete(job.id, true, '/path/to/report.pdf');

    // Verify job is marked as done
    const queueFile = path.join(tempDir, 'queue', 'jobs.json');
    const queue = await fs.readJson(queueFile);
    const completedJob = queue.jobs.find((j: any) => j.id === job.id);

    expect(completedJob.status).toBe('done');
    expect(completedJob.reportPath).toBe('/path/to/report.pdf');
    expect(completedJob.finishedAt).toBeDefined();
    expect(completedJob.pct).toBe(100);
  });

  it('should complete job with failure', async () => {
    const job = await enqueue({
      repo: 'https://github.com/test/repo.git',
      project: 'test-project',
      branch: 'main'
    });

    await claimNext();
    await complete(job.id, false, undefined, 'Test error message');

    const queueFile = path.join(tempDir, 'queue', 'jobs.json');
    const queue = await fs.readJson(queueFile);
    const failedJob = queue.jobs.find((j: any) => j.id === job.id);

    expect(failedJob.status).toBe('failed');
    expect(failedJob.errorMessage).toBe('Test error message');
    expect(failedJob.finishedAt).toBeDefined();
  });

  it('should update job percentage', async () => {
    const job = await enqueue({
      repo: 'https://github.com/test/repo.git',
      project: 'test-project',
      branch: 'main'
    });

    await updateJobPct(job.id, 45);

    const queueFile = path.join(tempDir, 'queue', 'jobs.json');
    const queue = await fs.readJson(queueFile);
    const updatedJob = queue.jobs.find((j: any) => j.id === job.id);

    expect(updatedJob.pct).toBe(45);
  });

  it('should attach run timestamp', async () => {
    const job = await enqueue({
      repo: 'https://github.com/test/repo.git',
      project: 'test-project',
      branch: 'main'
    });

    await attachRunTimestamp(job.id, '1234567890');

    const queueFile = path.join(tempDir, 'queue', 'jobs.json');
    const queue = await fs.readJson(queueFile);
    const updatedJob = queue.jobs.find((j: any) => j.id === job.id);

    expect(updatedJob.runTimestamp).toBe('1234567890');
  });

  it('should update job note', async () => {
    const job = await enqueue({
      repo: 'https://github.com/test/repo.git',
      project: 'test-project',
      branch: 'main'
    });

    await updateJobNote(job.id, 'Currently processing analysis');

    const queueFile = path.join(tempDir, 'queue', 'jobs.json');
    const queue = await fs.readJson(queueFile);
    const updatedJob = queue.jobs.find((j: any) => j.id === job.id);

    expect(updatedJob.note).toBe('Currently processing analysis');
  });
});
