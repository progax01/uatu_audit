import { createServer } from "node:http";
import { URL } from "node:url";
import path from "node:path";
import fs from "fs-extra";
import { loadProgress } from "../services/progressService.js";
import { resolveWorkspace } from "../services/workspaceService.js";
import { runAll } from "../services/runAll.js";
import { claimNext, complete, enqueue as enqueueJob } from "../services/jobQueue.js";
import { getUatuHome, getUserId } from "../constants/paths.js";

const PORT = parseInt(process.env.UATU_PORT || "9090");
const CONCURRENCY = parseInt(process.env.UATU_CONCURRENCY || "2");

export async function startDaemon() {
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
    if (req.method === "GET" && parsed.pathname === "/healthz") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true }));
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

    if (req.method === "GET" && parsed.pathname === "/jobs") {
      const qpath = path.join(getUatuHome(), "queue", "jobs.json");
      const j = await fs.readJson(qpath).catch(()=>({ jobs: [] }));
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(j));
      return;
    }

    if (req.method === "GET" && parsed.pathname === "/report") {
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
      const reportPath = path.join(runsPath, last, "report.pdf");
      if (!(await fs.pathExists(reportPath))) {
        res.statusCode = 404;
        res.end("No report found");
        return;
      }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${project}-${branch}-report.pdf"`);
      const reportData = await fs.readFile(reportPath);
      res.end(reportData);
      return;
    }

    if (req.method === "POST" && parsed.pathname === "/enqueue") {
      const chunks: any[] = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks).toString("utf8");
      let payload: any = {};
      try { payload = JSON.parse(body || '{}'); } catch {}
      const { repo, project, branch, ai } = payload || {};
      if (!repo || !project || !branch) { res.statusCode = 400; res.end(JSON.stringify({ ok:false, error: "repo, project, branch required" })); return; }
      const job = await enqueueJob({ repo, project, branch, ai: !!ai, status: "pending", pct: 0 } as any);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, job }));
      return;
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
  console.log(`👷 Worker ${workerId} started`);
  
  while (true) {
    try {
      const job = await claimNext();
      if (!job) {
        // No jobs available, wait a bit
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      console.log(`🔧 Worker ${workerId} processing job ${job.id}: ${job.project}#${job.branch}`);
      
      try {
        const { pdfPath } = await runAll({
          repo: job.repo,
          project: job.project,
          branch: job.branch,
          ai: job.ai,
          jobId: job.id
        });
        
        await complete(job.id, true, pdfPath);
        console.log(`✅ Worker ${workerId} completed job ${job.id}: ${pdfPath}`);
      } catch (error) {
        console.error(`❌ Worker ${workerId} failed job ${job.id}:`, error);
        await complete(job.id, false, undefined, String(error));
      }
    } catch (error) {
      console.error(`💥 Worker ${workerId} error:`, error);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}
