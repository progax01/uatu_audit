import 'dotenv/config';
import { createServer } from "node:http";
import { URL } from "node:url";
import path from "node:path";
import fs from "fs-extra";
import { loadProgress } from "../services/progressService.js";
import { resolveWorkspace } from "../services/workspaceService.js";
import { runAll } from "../services/runAll.js";
import { claimNext, complete, enqueue, recoverStuckJobs } from "../services/jobQueue.js";
import { getUatuHome, getUserId } from "../constants/paths.js";
import { logger, createJobLogger } from "../utils/logger.js";
import { Metrics } from "../services/metrics.js";

const PORT = parseInt(process.env.UATU_PORT || "9090");
const CONCURRENCY = parseInt(process.env.UATU_CONCURRENCY || "2");

export async function startDaemon() {
  // Crash recovery - reconcile stuck jobs before starting workers  
  logger.info('Performing crash recovery...');
  await recoverStuckJobs();
  
  console.log(`🚀 Starting Uatu daemon on port ${PORT} with ${CONCURRENCY} workers`);
  
  // Start worker pool
  for (let i = 0; i < CONCURRENCY; i++) {
    startWorker(i);
  }

  // Start HTTP server
  const server = createServer(handleRequest);
  server.listen(PORT, () => {
    console.log(`📡 HTTP server listening on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down daemon...');
    server.close();
    process.exit(0);
  });
}

async function handleRequest(req: any, res: any) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parsed = { pathname: url.pathname, query: Object.fromEntries(url.searchParams) };

  try {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Hub-Signature-256");
    if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }

    // Serve timeline UI at / and /index.html if present
    if (req.method === "GET" && (parsed.pathname === "/" || parsed.pathname === "/index.html")) {
      const uiPath = path.resolve("index.html");
      if (await fs.pathExists(uiPath)) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        const html = await fs.readFile(uiPath);
        res.end(html);
      } else {
        res.statusCode = 404;
        res.end("index.html not found in project root");
      }
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/healthz") {
      res.setHeader("Content-Type", "application/json");
      try {
        // Basic health checks
        const queueFile = path.join(getUatuHome(), "queue", "jobs.json");
        const queueReadable = await fs.pathExists(queueFile);
        const stats = await fs.stat('.').catch(() => null);
        const diskSpaceOk = !stats || stats.size > 100 * 1024 * 1024; // 100MB threshold
        
        const health = {
          ok: queueReadable && diskSpaceOk,
          timestamp: new Date().toISOString(),
          checks: {
            queueReadable,
            diskSpaceOk,
            port: PORT,
            workers: CONCURRENCY
          }
        };
        
        res.statusCode = health.ok ? 200 : 503;
        res.end(JSON.stringify(health));
      } catch (error) {
        res.statusCode = 503;
        res.end(JSON.stringify({ ok: false, error: String(error) }));
      }
      return;
    }

    if (req.method === "GET" && parsed.pathname === "/metrics") {
      res.setHeader("Content-Type", "text/plain");
      try {
        const prometheusMetrics = Metrics.toPrometheus();
        res.end(prometheusMetrics);
      } catch (error) {
        res.statusCode = 500;
        res.end(`# Error generating metrics: ${error}\n`);
      }
      return;
    }

    // OAuth helpers
    const GH_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
    const GH_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";
    const GH_CALLBACK = process.env.GITHUB_OAUTH_CALLBACK || `http://localhost:${PORT}/auth/github/callback`;

    async function tokenPath() {
      const p = path.join(getUatuHome(), "users", getUserId(), "secrets");
      await fs.ensureDir(p);
      return path.join(p, "github.json");
    }
    async function saveToken(token: string) {
      const p = await tokenPath();
      await fs.writeJson(p, { token }, { spaces: 2 });
    }
    async function loadToken(): Promise<string | null> {
      const p = await tokenPath();
      try { const j = await fs.readJson(p); return j?.token || null; } catch { return null; }
    }
    async function deleteToken() {
      const p = await tokenPath();
      if (await fs.pathExists(p)) await fs.remove(p);
    }

    if (req.method === "GET" && parsed.pathname === "/auth/github/login") {
      if (!GH_CLIENT_ID) { res.statusCode = 500; res.end("GITHUB_CLIENT_ID not set"); return; }
      const scope = encodeURIComponent("repo read:org admin:repo_hook");
      const redirect = `https://github.com/login/oauth/authorize?client_id=${GH_CLIENT_ID}&redirect_uri=${encodeURIComponent(GH_CALLBACK)}&scope=${scope}`;
      res.statusCode = 302; res.setHeader("Location", redirect); res.end(); return;
    }

    if (req.method === "GET" && parsed.pathname === "/auth/github/callback") {
      try {
        const params = new URLSearchParams(parsed.query as any);
        const code = params.get("code");
        if (!code) { res.statusCode = 400; res.end("missing code"); return; }
        const r = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: { "Accept": "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: GH_CLIENT_ID, client_secret: GH_CLIENT_SECRET, code, redirect_uri: GH_CALLBACK })
        });
        const t: any = await r.json();
        if (!t.access_token) { res.statusCode = 400; res.end(JSON.stringify(t)); return; }
        await saveToken(t.access_token);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`<script>window.opener||window.opener;window.location='/'</script><p>GitHub auth ok. You can close this tab and return to the test UI.</p>`);
      } catch (e: any) { res.statusCode = 500; res.end(String(e?.message||e)); }
      return;
    }

    // Alias for /auth/callback → /auth/github/callback (GitHub apps sometimes use shorter path)
    if (req.method === "GET" && parsed.pathname === "/auth/callback") {
      try {
        const params = new URLSearchParams(parsed.query as any);
        const code = params.get("code");
        if (!code) { res.statusCode = 400; res.end("missing code"); return; }
        const r = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: { "Accept": "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: GH_CLIENT_ID, client_secret: GH_CLIENT_SECRET, code, redirect_uri: GH_CALLBACK })
        });
        const t: any = await r.json();
        if (!t.access_token) { res.statusCode = 400; res.end(JSON.stringify(t)); return; }
        await saveToken(t.access_token);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`<script>window.opener||window.opener;window.location='/'</script><p>GitHub auth ok. You can close this tab and return to the test UI.</p>`);
      } catch (e: any) { res.statusCode = 500; res.end(String(e?.message||e)); }
      return;
    }

    if (req.method === "GET" && parsed.pathname === "/auth/github/me") {
      const tok = await loadToken();
      if (!tok) { res.statusCode = 401; res.end(JSON.stringify({ authed: false })); return; }
      const u = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${tok}`, "User-Agent": "UatuAudit" }});
      const j = await u.json();
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ authed: true, user: j })); return;
    }

    if (req.method === "POST" && parsed.pathname === "/auth/github/logout") {
      await deleteToken();
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ ok: true })); return;
    }

    // GET /github/repos?org=<org>
    if (req.method === "GET" && parsed.pathname === "/github/repos") {
      const token = await loadToken();
      if (!token) { res.statusCode = 401; res.end(JSON.stringify({error:"not authed"})); return; }
      const org = String(parsed.query.org || "");
      const base = org
        ? `https://api.github.com/orgs/${encodeURIComponent(org)}/repos?per_page=100`
        : `https://api.github.com/user/repos?per_page=100`;
      const r = await fetch(base, { headers: { Authorization: `Bearer ${token}`, "User-Agent": "UatuAudit" }});
      const list = await r.json() as any[];
      const slim = list.map(r => ({
        id: r.id,
        full_name: r.full_name,
        default_branch: r.default_branch,
        clone_url: r.clone_url,
        private: r.private
      }));
      res.setHeader("Content-Type","application/json"); res.end(JSON.stringify(slim)); return;
    }

    // GET /github/branches?repo=owner/name
    if (req.method === "GET" && parsed.pathname === "/github/branches") {
      const token = await loadToken();
      if (!token) { res.statusCode = 401; res.end(JSON.stringify({error:"not authed"})); return; }
      const repo = String(parsed.query.repo || "");
      if (!repo || !repo.includes("/")) { res.statusCode = 400; res.end("repo=owner/name required"); return; }
      const r = await fetch(`https://api.github.com/repos/${repo}/branches?per_page=200`,
        { headers: { Authorization: `Bearer ${token}`, "User-Agent": "UatuAudit" }});
      const list = await r.json() as any[];
      const slim = list.map(b => ({ name: b.name, protected: !!b.protected }));
      res.setHeader("Content-Type","application/json"); res.end(JSON.stringify(slim)); return;
    }

    // GET /logs?project=&branch=&tail=100
    if (req.method === "GET" && parsed.pathname === "/logs") {
      const project = String(parsed.query.project || "");
      const branch = String(parsed.query.branch || "");
      const tail = Math.max(10, Math.min(5000, parseInt(String(parsed.query.tail || "400"),10)));
      if (!project || !branch) { res.statusCode = 400; res.end("project & branch required"); return; }
      const { runsPath } = await resolveWorkspace(project, branch);
      const runs = (await fs.pathExists(runsPath)) ? (await fs.readdir(runsPath)).sort() : [];
      const last = runs.at(-1); if (!last) { res.statusCode = 404; res.end("No runs"); return; }
      const rp = path.join(runsPath, last);
      const execLog = path.join(rp, "execute.log");
      const cliLog  = path.join(rp, "cli.log");
      const readTail = async (p: string) => (await fs.pathExists(p)) ? (await fs.readFile(p,"utf8")).split("\n").slice(-tail).join("\n") : "";
      const payload = { run: last, execute: await readTail(execLog), cli: await readTail(cliLog) };
      res.setHeader("Content-Type","application/json"); res.end(JSON.stringify(payload)); return;
    }
    if (req.method === "GET" && parsed.pathname === "/progress") {
      const project = String(parsed.query.project || "");
      const branch = String(parsed.query.branch || "");
      if (!project || !branch) { 
        res.statusCode = 400; 
        res.end("project & branch required"); 
        return; 
      }
      const { runsPath } = await resolveWorkspace(project, branch);
      const runs = (await fs.pathExists(runsPath)) ? (await fs.readdir(runsPath)).sort() : [];
      const last = runs.at(-1); 
      if (!last) { 
        res.statusCode = 404; 
        res.end("No runs"); 
        return; 
      }
      const rp = path.join(runsPath, last);
      const prog = await loadProgress(rp);
      if (!prog) { 
        res.statusCode = 404; 
        res.end("No progress yet"); 
        return; 
      }
      res.setHeader("Content-Type", "application/json"); 
      res.end(JSON.stringify(prog)); 
      return;
    }

    // SSE Progress Stream (buttery smooth UI updates)
    if (req.method === "GET" && parsed.pathname === "/progress/stream") {
      const project = String(parsed.query.project || "");
      const branch = String(parsed.query.branch || "");
      if (!project || !branch) {
        res.statusCode = 400;
        res.end("project & branch required");
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      const { runsPath } = await resolveWorkspace(project, branch);
      
      const sendProgress = async () => {
        try {
          const runs = (await fs.pathExists(runsPath)) ? (await fs.readdir(runsPath)).sort() : [];
          const last = runs.at(-1);
          if (last) {
            const rp = path.join(runsPath, last);
            const prog = await loadProgress(rp);
            if (prog) {
              res.write(`data: ${JSON.stringify(prog)}\n\n`);
            }
          }
        } catch (error) {
          res.write(`data: ${JSON.stringify({ error: String(error) })}\n\n`);
        }
      };

      // Send initial progress
      await sendProgress();

      // Send updates every 2 seconds
      const interval = setInterval(sendProgress, 2000);

      // Cleanup on client disconnect
      req.on('close', () => {
        clearInterval(interval);
      });

      return;
    }

    if (req.method === "GET" && parsed.pathname === "/jobs") {
      const qpath = path.join(getUatuHome(), "queue", "jobs.json");
      const j = await fs.readJson(qpath).catch(()=>({ jobs: [] }));
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(j));
      return;
    }

    // GET /report?project=&branch=&format=pdf|html (v1 only)
    if (req.method === "GET" && parsed.pathname === "/report") {
      const project = String(parsed.query.project || "");
      const branch = String(parsed.query.branch || "");
      const format = String(parsed.query.format || "html"); // default to HTML v1
      
      if (!project || !branch) { 
        res.statusCode = 400; 
        res.end("project & branch required"); 
        return; 
      }
      
      const { runsPath } = await resolveWorkspace(project, branch);
      const runs = (await fs.pathExists(runsPath)) ? (await fs.readdir(runsPath)).sort() : [];
      const last = runs.at(-1); 
      if (!last) { 
        res.statusCode = 404; 
        res.end("No runs found"); 
        return; 
      }
      
      const runPath = path.join(runsPath, last);
      
      if (format === "html") {
        // V1 HTML report (always available)
        const reportPath = path.join(runPath, "report.html");
        if (!(await fs.pathExists(reportPath))) {
          res.statusCode = 404;
          res.end("report.html not found (v1)");
          return;
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("X-Frame-Options", "SAMEORIGIN");
        const reportData = await fs.readFile(reportPath);
        res.end(reportData);
        return;
      } else if (format === "pdf") {
        // PDF only available if puppeteer generated it
        const pdfPath = path.join(runPath, "report.pdf");
        if (!(await fs.pathExists(pdfPath))) {
          res.statusCode = 404;
          res.setHeader("Content-Type","application/json");
          res.end(JSON.stringify({ error: "pdf_not_generated", hint: "Generate PDF via Puppeteer from report.html" }));
          return;
        }
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${project}-${branch}-audit.pdf"`);
        const reportData = await fs.readFile(pdfPath);
        res.end(reportData);
        return;
      } else {
        res.statusCode = 400;
        res.end("format must be 'html' or 'pdf'");
        return;
      }
    }

    if (req.method === "POST" && parsed.pathname === "/enqueue") {
      try {
        const chunks: any[] = [];
        for await (const c of req) chunks.push(c);
        const body = Buffer.concat(chunks).toString("utf8");
        console.log("Enqueue request body:", body);
        let payload: any = {};
        try { payload = JSON.parse(body || '{}'); } catch (e) { console.error("JSON parse error:", e); }
        const { repo, project, branch, ai, testStyles } = payload || {};
        console.log("Enqueue params:", { repo, project, branch, ai, testStyles });
        if (!repo || !project || !branch) { res.statusCode = 400; res.end(JSON.stringify({ ok:false, error: "repo, project, branch required" })); return; }
        const job = await enqueue({ repo, project, branch, ai: !!ai, testStyles: testStyles || ["behavioral", "stride"] });
        console.log("Job created:", job);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, job }));
        return;
      } catch (error) {
        console.error("Enqueue error:", error);
        res.statusCode = 500;
        res.end("Internal server error");
        return;
      }
    }

    // Default 404
    res.statusCode = 404;
    res.end("Not found");
  } catch (error) {
    console.error("Request error:", error);
    res.statusCode = 500;
    res.end("Internal server error");
  }
}

async function startWorker(workerId: number) {
  const log = logger.child({ workerId });
  log.info(`Worker started`);
  
  while (true) {
    try {
      const job = await claimNext();
      if (!job) {
        // No jobs available, wait a bit
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      const jobLog = createJobLogger(job.id, job.project, job.branch);
      jobLog.info(`Worker processing job`, { workerId });
      
      try {
        const { htmlPath, score, grade } = await runAll({
          repo: job.repo,
          project: job.project,
          branch: job.branch,
          testStyles: job.testStyles || ["behavioral", "stride"],
          ai: job.ai,
          jobId: job.id
        });
        
        await complete(job.id, true, htmlPath);
        jobLog.info(`Job completed successfully`, { 
          htmlPath, 
          score, 
          grade, 
          workerId 
        });
      } catch (error) {
        jobLog.error(`Job failed`, { error: String(error), workerId });
        await complete(job.id, false, undefined, String(error));
      }
    } catch (error) {
      log.error(`Worker error`, { error: String(error) });
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}
