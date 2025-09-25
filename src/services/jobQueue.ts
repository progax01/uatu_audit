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

async function save(q: QueueFile) { 
  // Atomic write using temporary file
  const tmpPath = QPATH + '.tmp.' + Date.now();
  try {
    await fs.writeJson(tmpPath, q, { spaces: 2 });
    await fs.move(tmpPath, QPATH, { overwrite: true });
  } catch (error) {
    // Clean up temp file on error
    await fs.remove(tmpPath).catch(() => {});
    throw error;
  }
}

export async function enqueue(job: Omit<AuditJob, "id" | "status" | "createdAt">) {
  const q = await load();
  
  // Idempotent enqueue - check for existing work
  const key = `${job.repo}@${job.branch}@${job.commit ?? "-"}`;
  const existing = q.jobs.find(j => j.status !== "failed" && j.key === key);
  if (existing) {
    console.log(`Job already exists for ${key}, returning existing job ${existing.id}`);
    return existing;
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
  return newJob;
}
export async function claimNext(): Promise<AuditJob | null> {
  // Retry claim operation to handle race conditions
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const q = await load();
      const now = new Date();
      
      // Find pending job that's ready to run (respects backoff)
      const j = q.jobs.find(x => 
        x.status === "pending" && 
        (!x.nextRunAt || new Date(x.nextRunAt) <= now)
      );
      if (!j) return null;
      
      // Guardrail: Max 5 attempts before permanent failure
      const attempts = (j.attempts || 0) + 1;
      if (attempts > 5) {
        j.status = "failed";
        j.errorMessage = `Max attempts (${attempts}) exceeded`;
        j.finishedAt = new Date().toISOString();
        await save(q);
        continue; // Try next job
      }
      
      j.status = "running"; 
      j.startedAt = new Date().toISOString(); 
      j.pct = 0;
      j.attempts = attempts;
      
      await save(q); 
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
  const q = await load();
  let recovered = 0;
  
  for (const j of q.jobs) {
    if (j.status === "running") {
      j.status = "pending"; // Reset to pending for retry
      j.startedAt = undefined;
      j.pct = 0;
      
      // Apply backoff based on attempts
      const attempts = j.attempts || 0;
      const backoffMs = Math.min(Math.pow(2, attempts) * 30 * 1000, 15 * 60 * 1000); // Max 15 min
      j.nextRunAt = new Date(Date.now() + backoffMs).toISOString();
      recovered++;
    }
  }
  
  if (recovered > 0) {
    await save(q);
    console.log(`Recovered ${recovered} stuck jobs`);
  }
}
export async function complete(jobId: number, ok: boolean, reportPath?: string, errorMessage?: string) {
  const q = await load();
  const j = q.jobs.find(x => x.id === jobId); if (!j) return;
  j.status = ok ? "done" : "failed"; j.finishedAt = new Date().toISOString();
  if (ok && reportPath) j.reportPath = reportPath; if (!ok && errorMessage) j.errorMessage = errorMessage;
  j.pct = ok ? 100 : (j.pct ?? 0); await save(q);
}

// NEW: mirrors
export async function updateJobPct(jobId: number, pct: number) {
  const q = await load(); const j = q.jobs.find(x => x.id === jobId); if (!j) return;
  j.pct = Math.max(0, Math.min(100, Math.round(pct))); await save(q);
}
export async function attachRunTimestamp(jobId: number, ts: string) {
  const q = await load(); const j = q.jobs.find(x => x.id === jobId); if (!j) return;
  j.runTimestamp = ts; await save(q);
}
export async function updateJobNote(jobId: number, note: string) {
  const q = await load(); const j = q.jobs.find(x => x.id === jobId); if (!j) return;
  j.note = note; await save(q);
}
