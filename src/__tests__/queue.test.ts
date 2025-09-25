import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import { enqueue, claimNext, complete, recoverStuckJobs } from '../services/jobQueue.js';

// Use a temporary directory for tests
const testQueueDir = path.join(os.tmpdir(), 'uatu-test-queue');
const testQueueFile = path.join(testQueueDir, 'jobs.json');

// Mock getUatuHome to use test directory
vi.mock('../constants/paths.js', () => ({
  getUatuHome: () => testQueueDir,
  getUserId: () => 'test-user'
}));

describe('Job Queue Durability', () => {
  beforeEach(async () => {
    await fs.ensureDir(testQueueDir);
    await fs.remove(testQueueFile).catch(() => {});
  });

  afterEach(async () => {
    await fs.remove(testQueueDir).catch(() => {});
  });

  test('recovers from corrupted jobs.json', async () => {
    // Write corrupted JSON
    await fs.writeFile(testQueueFile, '{not json', 'utf8');
    
    // Should still be able to enqueue
    const job = await enqueue({ 
      repo: 'https://github.com/test/repo.git', 
      project: 'test', 
      branch: 'main' 
    });
    
    expect(job.id).toBeGreaterThanOrEqual(1);
    expect(job.status).toBe('pending');
  });

  test('handles undefined structure gracefully', async () => {
    // Write invalid structure
    await fs.writeFile(testQueueFile, '{"invalid": true}', 'utf8');
    
    const job = await enqueue({ 
      repo: 'https://github.com/test/repo.git', 
      project: 'test', 
      branch: 'main' 
    });
    
    expect(job.id).toBe(1);
    expect(job.attempts).toBe(0);
  });

  test('deduplicates jobs by key', async () => {
    const jobData = { 
      repo: 'https://github.com/test/repo.git', 
      project: 'test', 
      branch: 'main',
      commit: 'abc123' 
    };
    
    const job1 = await enqueue(jobData);
    const job2 = await enqueue(jobData);
    
    expect(job1.id).toBe(job2.id);
    expect(job1.key).toBe(job2.key);
  });

  test('marks running jobs as pending on recovery', async () => {
    // Create a "running" job directly in file
    await fs.writeJson(testQueueFile, {
      nextId: 2,
      jobs: [{
        id: 1,
        repo: 'https://github.com/test/repo.git',
        project: 'test',
        branch: 'main',
        status: 'running',
        createdAt: new Date().toISOString(),
        attempts: 1
      }]
    });
    
    await recoverStuckJobs();
    
    const job = await claimNext();
    expect(job?.id).toBe(1);
    expect(job?.status).toBe('running'); // Now claimed and running again
    expect(job?.attempts).toBe(2); // Incremented
  });

  test('respects backoff timing', async () => {
    // Create job with future nextRunAt
    const futureTime = new Date(Date.now() + 10000).toISOString();
    await fs.writeJson(testQueueFile, {
      nextId: 2,
      jobs: [{
        id: 1,
        repo: 'https://github.com/test/repo.git',
        project: 'test',
        branch: 'main',
        status: 'pending',
        createdAt: new Date().toISOString(),
        nextRunAt: futureTime
      }]
    });
    
    // Should not claim job due to backoff
    const job = await claimNext();
    expect(job).toBeNull();
  });

  test('completes job workflow', async () => {
    const job = await enqueue({ 
      repo: 'https://github.com/test/repo.git', 
      project: 'test', 
      branch: 'main' 
    });
    
    const claimed = await claimNext();
    expect(claimed?.id).toBe(job.id);
    expect(claimed?.status).toBe('running');
    
    await complete(job.id, true, '/path/to/report.html');
    
    // Verify completion
    const queueData = await fs.readJson(testQueueFile);
    const completedJob = queueData.jobs.find((j: any) => j.id === job.id);
    expect(completedJob.status).toBe('done');
    expect(completedJob.reportPath).toBe('/path/to/report.html');
  });
});
