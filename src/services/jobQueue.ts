import path from "node:path";
import fs from "fs-extra";
import { getUatuHome } from "../constants/paths.js";

export type JobStatus = "pending" | "running" | "done" | "failed";
export interface AuditJob {
  id: number;
  repo: string;
  project: string;
  branch: string;
  ai?: boolean;
  testStyles?: string[];
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  status: JobStatus;
  pct?: number;
  runTimestamp?: string;
  reportPath?: string;
  errorMessage?: string;
  note?: string;
  // Durability fields
  key?: string; // repo@branch@commit for deduplication
  attempts?: number;
  nextRunAt?: string;
  commit?: string;
}

interface QueueFile { nextId: number; jobs: AuditJob[]; }

const QDIR = path.join(getUatuHome(), "queue");
const QPATH = path.join(QDIR, "jobs.json");

// Simple in-process mutex to serialize queue mutations within this process
let queueLock: Promise<void> = Promise.resolve();
function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = queueLock.then(fn, fn);
  // Ensure the lock always resolves
  queueLock = next.then(() => undefined, () => undefined);
  return next;
}

async function load(): Promise<QueueFile> {
  await fs.ensureDir(QDIR);
  if (!(await fs.pathExists(QPATH))) return { nextId: 1, jobs: [] };

  // Retry on JSON parse errors (corruption from concurrent writes)
  for (let i = 0; i < 3; i++) {
    try {
      const raw = await fs.readJson(QPATH).catch(() => ({}));
      // Enforce structure on read (belt & suspenders)
      const q: QueueFile = { 
        nextId: Number.isInteger(raw.nextId) ? raw.nextId : 1,
        jobs: Array.isArray(raw.jobs) ? raw.jobs : [] 
      };
      return q;
    } catch (error) {
      console.warn(`Queue load attempt ${i + 1} failed:`, error);
      if (i === 2) {
        // Last attempt failed, reset to empty queue
        console.error('Queue file corrupted, resetting to empty queue');
        await fs.writeJson(QPATH, { nextId: 1, jobs: [] }, { spaces: 2 });
        return { nextId: 1, jobs: [] };
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    }
  }
  return { nextId: 1, jobs: [] };
}

async function writeJsonAtomic(file: string, data: unknown) {
  const dir = path.dirname(file);
  await fs.ensureDir(dir);
  const rand = Math.random().toString(36).slice(2);
  const tmp = path.join(dir, `.${path.basename(file)}.tmp.${Date.now()}.${rand}`);
  await fs.writeJson(tmp, data, { spaces: 2 });
  try {
    await fs.rename(tmp, file); // atomic on same fs
  } catch {
    await fs.move(tmp, file, { overwrite: true }); // cross-device / race fallback
  }
}

async function save(q: QueueFile) { 
  await writeJsonAtomic(QPATH, q);
}

export async function enqueue(job: Omit<AuditJob, "id" | "status" | "createdAt">) {
  return withQueueLock(async () => {
    const q = await load();

    // Always create a new job - users should be able to re-run audits
    const key = `${job.repo}@${job.branch}@${job.commit ?? "-"}`;
    
    // Check if there's an existing job for logging purposes
    const existing = q.jobs.find(j => j.status !== "failed" && j.key === key);
    if (existing) {
      console.log(`Previous job exists for ${key} (ID ${existing.id}), but creating new job as requested`);
    }

    const newJob: AuditJob = {
      id: q.nextId++,
      createdAt: new Date().toISOString(),
      status: "pending",
      pct: 0,
      key,
      attempts: 0,
      ...job
    };
    q.jobs.push(newJob);
    await save(q);
    
    console.log(`New job created: ID ${newJob.id} for ${key}`);
    
    // Optional: Clean up old completed jobs to prevent queue bloat
    await cleanupOldJobs(q);
    
    return newJob;
  });
}
export async function claimNext(): Promise<AuditJob | null> {
  // Retry claim operation to handle race conditions
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Serialize claim to avoid concurrent writers stepping on each other
      const j = await withQueueLock(async () => {
        const q = await load();
      const now = new Date();
      
      // Find pending job that's ready to run (respects backoff)
        const job = q.jobs.find(x => 
        x.status === "pending" && 
        (!x.nextRunAt || new Date(x.nextRunAt) <= now)
      );
        if (!job) return null;
      
      // Guardrail: Max 5 attempts before permanent failure
        const attempts = (job.attempts || 0) + 1;
      if (attempts > 5) {
          job.status = "failed";
          job.errorMessage = `Max attempts (${attempts}) exceeded`;
          job.finishedAt = new Date().toISOString();
        await save(q);
          return undefined; // Try next iteration
      }
      
        job.status = "running"; 
        job.startedAt = new Date().toISOString(); 
        job.pct = 0;
        job.attempts = attempts;
      
      await save(q); 
        return job;
      });
      if (j === undefined) continue;
      return j;
    } catch (error) {
      console.warn(`Claim attempt ${attempt + 1} failed:`, error);
      if (attempt === 2) throw error;
      // Random backoff to reduce contention
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));
    }
  }
  return null;
}

// Crash recovery - call on daemon start
export async function recoverStuckJobs() {
  await withQueueLock(async () => {
    const q = await load();
    let recovered = 0;
    for (const j of q.jobs) {
      if (j.status === "running") {
        j.status = "pending";
        j.startedAt = undefined;
        j.pct = 0;
        const attempts = j.attempts || 0;
        const backoffMs = Math.min(Math.pow(2, attempts) * 30 * 1000, 15 * 60 * 1000);
        j.nextRunAt = new Date(Date.now() + backoffMs).toISOString();
        recovered++;
      }
    }
    if (recovered > 0) {
      await save(q);
      console.log(`Recovered ${recovered} stuck jobs`);
    }
  });
}
export async function complete(jobId: number, ok: boolean, reportPath?: string, errorMessage?: string) {
  await withQueueLock(async () => {
    const q = await load();
    const j = q.jobs.find(x => x.id === jobId); if (!j) return;
    j.status = ok ? "done" : "failed"; j.finishedAt = new Date().toISOString();
    if (ok && reportPath) j.reportPath = reportPath; if (!ok && errorMessage) j.errorMessage = errorMessage;
    j.pct = ok ? 100 : (j.pct ?? 0); await save(q);
  });
}

// NEW: mirrors
export async function updateJobPct(jobId: number, pct: number) {
  await withQueueLock(async () => {
    const q = await load(); const j = q.jobs.find(x => x.id === jobId); if (!j) return;
    j.pct = Math.max(0, Math.min(100, Math.round(pct))); await save(q);
  });
}
export async function attachRunTimestamp(jobId: number, ts: string) {
  await withQueueLock(async () => {
    const q = await load(); const j = q.jobs.find(x => x.id === jobId); if (!j) return;
    j.runTimestamp = ts; await save(q);
  });
}
export async function updateJobNote(jobId: number, note: string) {
  await withQueueLock(async () => {
    const q = await load(); const j = q.jobs.find(x => x.id === jobId); if (!j) return;
    j.note = note; await save(q);
  });
}

// Clean up old completed jobs to prevent queue bloat
async function cleanupOldJobs(q: QueueFile): Promise<void> {
  const maxCompletedJobs = parseInt(process.env.UATU_MAX_COMPLETED_JOBS || '50');
  const maxJobAge = parseInt(process.env.UATU_MAX_JOB_AGE_DAYS || '7');
  
  if (maxCompletedJobs <= 0 && maxJobAge <= 0) {
    return; // Cleanup disabled
  }
  
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - (maxJobAge * 24 * 60 * 60 * 1000));
  
  const initialCount = q.jobs.length;
  
  // Remove jobs that are too old
  if (maxJobAge > 0) {
    q.jobs = q.jobs.filter(job => {
      if (job.status === 'pending' || job.status === 'running') {
        return true; // Never remove active jobs
      }
      
      const jobDate = new Date(job.finishedAt || job.createdAt);
      return jobDate > cutoffDate;
    });
  }
  
  // Keep only the most recent completed jobs if we have too many
  if (maxCompletedJobs > 0) {
    const completedJobs = q.jobs
      .filter(job => job.status === 'done' || job.status === 'failed')
      .sort((a, b) => new Date(b.finishedAt || b.createdAt).getTime() - new Date(a.finishedAt || a.createdAt).getTime());
    
    const activeJobs = q.jobs.filter(job => job.status === 'pending' || job.status === 'running');
    const recentCompleted = completedJobs.slice(0, maxCompletedJobs);
    
    q.jobs = [...activeJobs, ...recentCompleted];
  }
  
  const finalCount = q.jobs.length;
  if (finalCount < initialCount) {
    console.log(`Cleaned up ${initialCount - finalCount} old jobs (${finalCount} remaining)`);
    await save(q);
  }
}

// Public function to manually trigger cleanup
export async function cleanupJobs(): Promise<{ removed: number; remaining: number }> {
  return withQueueLock(async () => {
    const q = await load();
    const initialCount = q.jobs.length;
    await cleanupOldJobs(q);
    const finalCount = q.jobs.length;
    
    return {
      removed: initialCount - finalCount,
      remaining: finalCount
    };
  });
}
