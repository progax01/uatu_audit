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
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  status: JobStatus;
  pct?: number;
  runTimestamp?: string;
  reportPath?: string;
  errorMessage?: string;
  note?: string;
}

interface QueueFile { nextId: number; jobs: AuditJob[]; }

const QDIR = path.join(getUatuHome(), "queue");
const QPATH = path.join(QDIR, "jobs.json");

async function load(): Promise<QueueFile> {
  await fs.ensureDir(QDIR);
  if (!(await fs.pathExists(QPATH))) return { nextId: 1, jobs: [] };
  return fs.readJson(QPATH);
}
async function save(q: QueueFile) { await fs.writeJson(QPATH, q, { spaces: 2 }); }

export async function enqueue(job: Omit<AuditJob, "id" | "status" | "createdAt">) {
  const q = await load();
  const newJob: AuditJob = { id: q.nextId++, createdAt: new Date().toISOString(), status: "pending", pct: 0, ...job };
  q.jobs.push(newJob); await save(q); return newJob;
}
export async function claimNext(): Promise<AuditJob | null> {
  const q = await load();
  const j = q.jobs.find(x => x.status === "pending");
  if (!j) return null;
  j.status = "running"; j.startedAt = new Date().toISOString(); j.pct = 0;
  await save(q); return j;
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
