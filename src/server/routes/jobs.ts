import path from "node:path";
import fs from "fs-extra";
import { loadProgress } from "../../services/progressService.js";
import { resolveWorkspace } from "../../services/workspaceService.js";
import {
  enqueue,
  listJobs,
  getJob,
  cancelJob,
  cleanupJobs,
} from "../../services/jobQueue.js";
import { getUatuHome } from "../../constants/paths.js";
import { logger } from "../../utils/logger.js";
import { readJobLogs } from "../../services/jobLogger.js";
import { getSessionId, loadToken, loadUserId } from "./auth.js";

// Job route handlers
export async function handleJobRoutes(
  req: any,
  res: any,
  parsed: { pathname: string; query: any }
): Promise<boolean> {
  // GET /logs?project=&branch=&tail=100
  if (req.method === "GET" && parsed.pathname === "/logs") {
    const project = String(parsed.query.project || "");
    const branch = String(parsed.query.branch || "");
    const tail = Math.max(10, Math.min(5000, parseInt(String(parsed.query.tail || "400"), 10)));
    if (!project || !branch) {
      res.statusCode = 400;
      res.end("project & branch required");
      return true;
    }

    const { runsPath } = await resolveWorkspace(project, branch);
    const runs = (await fs.pathExists(runsPath)) ? (await fs.readdir(runsPath)).sort() : [];
    const last = runs.at(-1);

    if (!last) {
      const payload = {
        run: "none",
        execute: "No runs yet - audit is starting...",
        cli: "Waiting for job to begin...",
      };
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(payload));
      return true;
    }

    const rp = path.join(runsPath, last);
    const execLog = path.join(rp, "execute.log");
    const cliLog = path.join(rp, "cli.log");
    const readTail = async (p: string) =>
      (await fs.pathExists(p))
        ? (await fs.readFile(p, "utf8")).split("\n").slice(-tail).join("\n")
        : "";
    const payload = { run: last, execute: await readTail(execLog), cli: await readTail(cliLog) };
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(payload));
    return true;
  }

  // GET /progress
  if (req.method === "GET" && parsed.pathname === "/progress") {
    const project = String(parsed.query.project || "");
    const branch = String(parsed.query.branch || "");
    if (!project || !branch) {
      res.statusCode = 400;
      res.end("project & branch required");
      return true;
    }

    const initialProgress = {
      overall_pct: 0,
      last_event: "Starting audit...",
      phases: [
        { name: "bootstrap", pct: 0, step: "initializing" },
        { name: "inventory", pct: 0, step: "waiting" },
        { name: "analysis", pct: 0, step: "waiting" },
        { name: "testgen", pct: 0, step: "waiting" },
        { name: "execute", pct: 0, step: "waiting" },
      ],
    };

    const activeJobs = await listJobs({ status: ["pending", "running"] });
    const activeJob = activeJobs.find((j) => j.project === project && j.branch === branch);

    const { runsPath } = await resolveWorkspace(project, branch);
    const runs = (await fs.pathExists(runsPath)) ? (await fs.readdir(runsPath)).sort() : [];
    const last = runs.at(-1);

    if (activeJob && (!activeJob.runTimestamp || !runs.includes(activeJob.runTimestamp))) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(initialProgress));
      return true;
    }

    if (!last) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(initialProgress));
      return true;
    }

    const rp = path.join(runsPath, last);
    const prog = await loadProgress(rp);
    if (!prog) {
      initialProgress.last_event = "Setting up workspace...";
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(initialProgress));
      return true;
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(prog));
    return true;
  }

  // SSE Progress Stream
  if (req.method === "GET" && parsed.pathname === "/progress/stream") {
    const project = String(parsed.query.project || "");
    const branch = String(parsed.query.branch || "");
    if (!project || !branch) {
      res.statusCode = 400;
      res.end("project & branch required");
      return true;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const { runsPath } = await resolveWorkspace(project, branch);

    const initialProgress = {
      overall_pct: 0,
      last_event: "Starting audit...",
      timestamp: new Date().toISOString(),
      phases: [
        { name: "bootstrap", pct: 0, step: "initializing" },
        { name: "inventory", pct: 0, step: "waiting" },
        { name: "analysis", pct: 0, step: "waiting" },
        { name: "testgen", pct: 0, step: "waiting" },
        { name: "execute", pct: 0, step: "waiting" },
      ],
    };

    const sendProgress = async () => {
      try {
        const activeJobs = await listJobs({ status: ["pending", "running"] });
        const activeJob = activeJobs.find((j) => j.project === project && j.branch === branch);

        const runs = (await fs.pathExists(runsPath)) ? (await fs.readdir(runsPath)).sort() : [];
        const last = runs.at(-1);

        if (activeJob && (!activeJob.runTimestamp || !runs.includes(activeJob.runTimestamp))) {
          res.write(`data: ${JSON.stringify(initialProgress)}\n\n`);
          return;
        }

        if (last) {
          const rp = path.join(runsPath, last);
          const prog = await loadProgress(rp);
          if (prog) {
            res.write(`data: ${JSON.stringify(prog)}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify(initialProgress)}\n\n`);
          }
        } else {
          res.write(`data: ${JSON.stringify(initialProgress)}\n\n`);
        }
      } catch (error) {
        res.write(`data: ${JSON.stringify({ error: String(error) })}\n\n`);
      }
    };

    await sendProgress();
    const interval = setInterval(sendProgress, 2000);

    req.on("close", () => {
      clearInterval(interval);
    });

    return true;
  }

  // GET /jobs
  if (req.method === "GET" && parsed.pathname === "/jobs") {
    const sessionId = getSessionId(req);
    const mine = parsed.query.mine === "true";
    const statusFilter = parsed.query.status
      ? String(parsed.query.status).split(",")
      : undefined;
    const limit = parsed.query.limit ? parseInt(String(parsed.query.limit)) : undefined;

    let userId: string | undefined;
    if (mine && sessionId) {
      userId = (await loadUserId(sessionId)) || undefined;
    }

    const jobs = await listJobs({
      userId: mine ? userId : undefined,
      sessionId: mine && !userId && sessionId ? sessionId : undefined,
      status: statusFilter as any,
      limit,
    });

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ jobs }));
    return true;
  }

  // GET /jobs/:id/logs
  const jobLogsMatch = parsed.pathname?.match(/^\/jobs\/(\d+)\/logs$/);
  if (req.method === "GET" && jobLogsMatch) {
    const jobId = parseInt(jobLogsMatch[1]);
    const offset = parseInt(String(parsed.query.offset || "0"));
    const limit = parseInt(String(parsed.query.limit || "100"));

    const qpath = path.join(getUatuHome(), "queue", "jobs.json");
    const jobsData = await fs.readJson(qpath).catch(() => ({ jobs: [] }));
    const job = jobsData.jobs.find((j: any) => j.id === jobId);

    if (!job) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Job not found" }));
      return true;
    }

    if (!job.runTimestamp) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ logs: [], nextOffset: 0, totalSize: 0, status: job.status }));
      return true;
    }

    const { runsPath } = await resolveWorkspace(job.project, job.branch);
    const runPath = path.join(runsPath, job.runTimestamp);

    const result = await readJobLogs(runPath, { offset, limit });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ...result, status: job.status }));
    return true;
  }

  // POST /jobs/:id/cancel
  const jobCancelMatch = parsed.pathname?.match(/^\/jobs\/(\d+)\/cancel$/);
  if (req.method === "POST" && jobCancelMatch) {
    const jobId = parseInt(jobCancelMatch[1]);

    const sessionId = getSessionId(req);
    const job = await getJob(jobId);
    if (job && sessionId) {
      const userId = await loadUserId(sessionId);
      if (userId && job.userId && job.userId !== userId) {
        res.statusCode = 403;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: false, message: "Not authorized to cancel this job" }));
        return true;
      }
    }

    const result = await cancelJob(jobId);

    if (result.success && job && job.runTimestamp) {
      try {
        const { runsPath } = await resolveWorkspace(job.project, job.branch);
        const runPath = path.join(runsPath, job.runTimestamp);
        const progressFile = path.join(runPath, "progress.json");

        if (await fs.pathExists(progressFile)) {
          const cancelledProgress = {
            overall_pct: 0,
            phases: [],
            last_event: "Cancelled",
            timestamp: new Date().toISOString(),
          };
          await fs.writeJson(progressFile, cancelledProgress, { spaces: 2 });
          logger.info(`Reset progress to 0% for cancelled job ${jobId}`);
        }
      } catch (err) {
        logger.error(`Failed to reset progress for job ${jobId}:`, err);
      }
    }

    res.setHeader("Content-Type", "application/json");
    res.statusCode = result.success ? 200 : 400;
    res.end(JSON.stringify(result));
    return true;
  }

  // POST /jobs/:id/rerun
  const jobRerunMatch = parsed.pathname?.match(/^\/jobs\/(\d+)\/rerun$/);
  if (req.method === "POST" && jobRerunMatch) {
    const jobId = parseInt(jobRerunMatch[1]);
    const originalJob = await getJob(jobId);

    if (!originalJob) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "Job not found" }));
      return true;
    }

    const sessionId = getSessionId(req);
    let accessToken: string | undefined;
    let userId: string | undefined;
    if (sessionId) {
      accessToken = (await loadToken(sessionId)) || undefined;
      userId = (await loadUserId(sessionId)) || undefined;
    }

    if (userId && originalJob.userId && originalJob.userId !== userId) {
      res.statusCode = 403;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "Not authorized to rerun this job" }));
      return true;
    }

    const newJob = await enqueue({
      repo: originalJob.repo,
      project: originalJob.project,
      branch: originalJob.branch,
      ai: originalJob.ai,
      testStyles: originalJob.testStyles,
      accessToken,
      sessionId: sessionId || undefined,
      userId: userId || undefined,
    });

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, job: newJob }));
    return true;
  }

  // POST /enqueue
  if (req.method === "POST" && parsed.pathname === "/enqueue") {
    try {
      const chunks: any[] = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks).toString("utf8");
      console.log("Enqueue request body:", body);
      let payload: any = {};
      try {
        payload = JSON.parse(body || "{}");
      } catch (e) {
        console.error("JSON parse error:", e);
      }
      let { repo, project, branch, ai, testStyles, selectedFiles } = payload || {};
      console.log("Enqueue params:", {
        repo,
        project,
        branch,
        ai,
        testStyles,
        selectedFiles: selectedFiles?.length || 0,
      });
      if (!repo || !project || !branch) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, error: "repo, project, branch required" }));
        return true;
      }

      const sessionId = getSessionId(req);
      console.log("Session ID from cookie:", sessionId || "NULL (no session cookie)");
      let accessToken: string | undefined;
      let userId: string | undefined;
      if (sessionId) {
        accessToken = (await loadToken(sessionId)) || undefined;
        userId = (await loadUserId(sessionId)) || undefined;
        console.log(
          "User access token found:",
          accessToken ? "yes (length: " + accessToken.length + ")" : "no"
        );
        console.log("User ID found:", userId || "no");
      } else {
        console.log("No sessionId cookie - user not logged in");
      }

      if (!userId) {
        console.log("AUTH FAILURE: No userId - returning 401. SessionId:", sessionId || "NULL");
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            ok: false,
            error: "Authentication required",
            hint: "Please login with GitHub OAuth before starting an audit",
          })
        );
        return true;
      }

      // Normalize repo input
      if (typeof repo === "string") {
        const trimmed = repo.trim();
        const ownerRepo = /^([\w.-]+)\/([\w.-]+)$/;
        const urlLike = /^(https?:\/\/|git@)/i;
        if (ownerRepo.test(trimmed)) {
          const [, owner, name] = trimmed.match(ownerRepo)!;
          repo = `https://github.com/${owner}/${name}.git`;
        } else if (!urlLike.test(trimmed)) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({ ok: false, error: "invalid_repo", hint: "Use https URL or owner/name" })
          );
          return true;
        }
      }

      const job = await enqueue({
        repo,
        project,
        branch,
        ai: !!ai,
        testStyles: testStyles || ["behavioral", "stride"],
        selectedFiles: selectedFiles || [],
        accessToken,
        sessionId: sessionId || undefined,
        userId: userId || undefined,
      });
      console.log("Job created:", job);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, job }));
      return true;
    } catch (error) {
      console.error("Enqueue error:", error);
      res.statusCode = 500;
      res.end("Internal server error");
      return true;
    }
  }

  // POST /cleanup
  if (req.method === "POST" && parsed.pathname === "/cleanup") {
    try {
      const result = await cleanupJobs();
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          message: `Cleaned up ${result.removed} old jobs`,
          removed: result.removed,
          remaining: result.remaining,
        })
      );
      return true;
    } catch (error) {
      console.error("Cleanup error:", error);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "Cleanup failed" }));
      return true;
    }
  }

  return false;
}
