import 'dotenv/config';
import { createServer } from "node:http";
import { URL } from "node:url";
import path from "node:path";
import fs from "fs-extra";
import { loadProgress } from "../services/progressService.js";
import { resolveWorkspace } from "../services/workspaceService.js";
import { runAll } from "../services/runAll.js";
import { claimNext, complete, enqueue, recoverStuckJobs, cleanupJobs, cancelJob, listJobs, getJob, JobCancelledError } from "../services/jobQueue.js";
import { getUatuHome, getUserId } from "../constants/paths.js";
import { logger, createJobLogger } from "../utils/logger.js";
import { Metrics } from "../services/metrics.js";
import { readJobLogs } from "../services/jobLogger.js";

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
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`📡 HTTP server listening on http://0.0.0.0:${PORT}`);
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
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS,HEAD");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Serve React UI from dist-ui
    if (parsed.pathname === "/" || parsed.pathname === "/index.html") {
      const uiPath = path.join(__dirname, "../../dist-ui/index.html");
      if (await fs.pathExists(uiPath)) {
        const content = await fs.readFile(uiPath, "utf8");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.writeHead(200);
        res.end(content);
        return;
      }
      // UI not found - return 404
      res.statusCode = 404;
      res.end("UI not found");
      return;
    }

    // Serve React UI assets (JS, CSS, etc.)
    if (req.method === "GET" && parsed.pathname.startsWith("/assets/")) {
      const assetPath = path.join(__dirname, "../../dist-ui", parsed.pathname);
      if (await fs.pathExists(assetPath)) {
        const ext = path.extname(assetPath).toLowerCase();
        const contentType =
          ext === '.js' ? 'application/javascript' :
          ext === '.css' ? 'text/css' :
          ext === '.json' ? 'application/json' :
          'application/octet-stream';
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
        const content = await fs.readFile(assetPath);
        res.end(content);
        return;
      } else {
        res.statusCode = 404;
        res.end(`Asset not found: ${parsed.pathname}`);
        return;
      }
    }

    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Hub-Signature-256");
    if (req.method === "OPTIONS") { res.statusCode = 204; res.end(); return; }

    // Serve brand assets
    if (req.method === "GET" && parsed.pathname.startsWith("/.uatu/brand/")) {
      const assetName = parsed.pathname.split("/").pop();
      if (!assetName) {
        res.statusCode = 404;
        res.end("Asset name required");
        return;
      }
      
      const assetPath = path.resolve(".uatu", "brand", assetName);
      
      if (await fs.pathExists(assetPath)) {
        const ext = path.extname(assetName).toLowerCase();
        const contentType = ext === '.svg' ? 'image/svg+xml' : 
                           ext === '.png' ? 'image/png' : 
                           ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 
                           'application/octet-stream';
        
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
        const asset = await fs.readFile(assetPath);
        res.end(asset);
      } else {
        res.statusCode = 404;
        res.end(`Asset ${assetName} not found`);
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

    // Session management with UUID
    const { v4: uuidv4 } = await import('uuid');

    // In-memory session store (maps session ID to user tokens and userId)
    // In production, use Redis or database
    const sessions = new Map<string, { token: string, userId?: string, createdAt: number }>();

    // Extract session ID from cookie
    function getSessionId(req: any): string | null {
      const cookies = req.headers.cookie || '';
      const match = cookies.match(/session_id=([^;]+)/);
      return match ? match[1] : null;
    }

    // Set session cookie
    function setSessionCookie(res: any, sessionId: string) {
      res.setHeader('Set-Cookie', `session_id=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`); // 30 days
    }

    // Clear session cookie
    function clearSessionCookie(res: any) {
      res.setHeader('Set-Cookie', 'session_id=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    }

    async function tokenPath(sessionId: string) {
      const p = path.join(getUatuHome(), "sessions", sessionId, "secrets");
      await fs.ensureDir(p);
      return path.join(p, "github.json");
    }
    async function saveToken(sessionId: string, token: string, userId?: string) {
      sessions.set(sessionId, { token, userId, createdAt: Date.now() });
      const p = await tokenPath(sessionId);
      await fs.writeJson(p, { token, userId }, { spaces: 2 });
    }
    async function loadToken(sessionId: string): Promise<string | null> {
      // Check in-memory first
      const session = sessions.get(sessionId);
      if (session) return session.token;

      // Fallback to disk
      const p = await tokenPath(sessionId);
      try {
        const j = await fs.readJson(p);
        const token = j?.token || null;
        const userId = j?.userId || null;
        if (token) sessions.set(sessionId, { token, userId, createdAt: Date.now() });
        return token;
      } catch {
        return null;
      }
    }
    async function loadUserId(sessionId: string): Promise<string | null> {
      // Check in-memory first
      const session = sessions.get(sessionId);
      if (session?.userId) return session.userId;

      // Fallback to disk
      const p = await tokenPath(sessionId);
      try {
        const j = await fs.readJson(p);
        return j?.userId || null;
      } catch {
        return null;
      }
    }
    async function deleteToken(sessionId: string) {
      sessions.delete(sessionId);
      const p = await tokenPath(sessionId);
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

        // Fetch GitHub user to get userId
        let userId: string | undefined;
        try {
          const userResp = await fetch("https://api.github.com/user", {
            headers: { Authorization: `Bearer ${t.access_token}`, "User-Agent": "UatuAudit" }
          });
          const userData: any = await userResp.json();
          userId = userData.id ? String(userData.id) : undefined;
        } catch (e) {
          console.error("Failed to fetch GitHub user:", e);
        }

        // Create new session for this user
        const sessionId = uuidv4();
        await saveToken(sessionId, t.access_token, userId);
        setSessionCookie(res, sessionId);

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

        // Fetch GitHub user to get userId
        let userId: string | undefined;
        try {
          const userResp = await fetch("https://api.github.com/user", {
            headers: { Authorization: `Bearer ${t.access_token}`, "User-Agent": "UatuAudit" }
          });
          const userData: any = await userResp.json();
          userId = userData.id ? String(userData.id) : undefined;
        } catch (e) {
          console.error("Failed to fetch GitHub user:", e);
        }

        // Create new session for this user
        const sessionId = uuidv4();
        await saveToken(sessionId, t.access_token, userId);
        setSessionCookie(res, sessionId);

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(`<script>window.opener||window.opener;window.location='/'</script><p>GitHub auth ok. You can close this tab and return to the test UI.</p>`);
      } catch (e: any) { res.statusCode = 500; res.end(String(e?.message||e)); }
      return;
    }

    if (req.method === "GET" && parsed.pathname === "/auth/github/me") {
      const sessionId = getSessionId(req);
      if (!sessionId) { res.statusCode = 401; res.end(JSON.stringify({ authed: false })); return; }

      const tok = await loadToken(sessionId);
      if (!tok) { res.statusCode = 401; res.end(JSON.stringify({ authed: false })); return; }

      const u = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${tok}`, "User-Agent": "UatuAudit" }});
      const j = await u.json();
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ authed: true, user: j })); return;
    }

    if (req.method === "POST" && parsed.pathname === "/auth/github/logout") {
      const sessionId = getSessionId(req);
      if (sessionId) {
        await deleteToken(sessionId);
      }
      clearSessionCookie(res);
      res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ ok: true })); return;
    }

    // GET /github/repos?org=<org>
    if (req.method === "GET" && parsed.pathname === "/github/repos") {
      const sessionId = getSessionId(req);
      if (!sessionId) { res.statusCode = 401; res.end(JSON.stringify({error:"not authed"})); return; }

      const token = await loadToken(sessionId);
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
      const sessionId = getSessionId(req);
      if (!sessionId) { res.statusCode = 401; res.end(JSON.stringify({error:"not authed"})); return; }

      const token = await loadToken(sessionId);
      if (!token) { res.statusCode = 401; res.end(JSON.stringify({error:"not authed"})); return; }

      const repo = String(parsed.query.repo || "");
      if (!repo || !repo.includes("/")) { res.statusCode = 400; res.end("repo=owner/name required"); return; }
      const r = await fetch(`https://api.github.com/repos/${repo}/branches?per_page=200`,
        { headers: { Authorization: `Bearer ${token}`, "User-Agent": "UatuAudit" }});
      const list = await r.json() as any[];
      const slim = list.map(b => ({ name: b.name, protected: !!b.protected }));
      res.setHeader("Content-Type","application/json"); res.end(JSON.stringify(slim)); return;
    }

    // GET /github/files?repo=owner/name&branch=main - Fetch repository file tree
    if (req.method === "GET" && parsed.pathname === "/github/files") {
      const sessionId = getSessionId(req);
      if (!sessionId) { res.statusCode = 401; res.end(JSON.stringify({error:"not authed"})); return; }

      const token = await loadToken(sessionId);
      if (!token) { res.statusCode = 401; res.end(JSON.stringify({error:"not authed"})); return; }

      const repo = String(parsed.query.repo || "");
      const branch = String(parsed.query.branch || "main");
      if (!repo || !repo.includes("/")) { res.statusCode = 400; res.end("repo=owner/name required"); return; }

      try {
        // Get the tree SHA for the branch
        const branchRes = await fetch(`https://api.github.com/repos/${repo}/branches/${encodeURIComponent(branch)}`,
          { headers: { Authorization: `Bearer ${token}`, "User-Agent": "UatuAudit" }});
        if (!branchRes.ok) {
          res.statusCode = branchRes.status;
          res.end(JSON.stringify({ error: "Failed to fetch branch info" }));
          return;
        }
        const branchData: any = await branchRes.json();
        const treeSha = branchData.commit?.sha;

        if (!treeSha) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Branch has no commits" }));
          return;
        }

        // Fetch the full tree recursively
        const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees/${treeSha}?recursive=1`,
          { headers: { Authorization: `Bearer ${token}`, "User-Agent": "UatuAudit" }});
        if (!treeRes.ok) {
          res.statusCode = treeRes.status;
          res.end(JSON.stringify({ error: "Failed to fetch file tree" }));
          return;
        }
        const treeData: any = await treeRes.json();

        // Convert flat tree to nested structure
        interface FileNode {
          name: string;
          path: string;
          type: 'file' | 'dir';
          size?: number;
          children?: FileNode[];
        }

        const buildTree = (items: any[]): FileNode[] => {
          const root: { [key: string]: FileNode } = {};

          // First pass: create all nodes
          for (const item of items) {
            const parts = item.path.split('/');
            let current = root;

            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              const currentPath = parts.slice(0, i + 1).join('/');
              const isLast = i === parts.length - 1;

              if (!current[part]) {
                current[part] = {
                  name: part,
                  path: currentPath,
                  type: isLast ? (item.type === 'blob' ? 'file' : 'dir') : 'dir',
                  size: isLast && item.type === 'blob' ? item.size : undefined,
                  children: isLast && item.type === 'blob' ? undefined : []
                };
              }

              if (!isLast) {
                if (!current[part].children) {
                  current[part].children = [];
                }
                // Create a map for the children
                const childMap: { [key: string]: FileNode } = {};
                for (const child of current[part].children!) {
                  childMap[child.name] = child;
                }
                current = childMap;
                // Update the children array reference for next iteration
                current[part] = current[part] || {
                  name: part,
                  path: currentPath,
                  type: 'dir',
                  children: []
                };
              }
            }
          }

          // Convert to array format
          const toArray = (obj: { [key: string]: FileNode }): FileNode[] => {
            return Object.values(obj).sort((a, b) => {
              // Directories first, then alphabetical
              if (a.type === 'dir' && b.type !== 'dir') return -1;
              if (a.type !== 'dir' && b.type === 'dir') return 1;
              return a.name.localeCompare(b.name);
            });
          };

          return toArray(root);
        };

        // Build proper nested tree from flat list
        const flatTree = treeData.tree || [];
        const nestedFiles: FileNode[] = [];
        const pathMap = new Map<string, FileNode>();

        // Sort by path to ensure parents are processed first
        flatTree.sort((a: any, b: any) => a.path.localeCompare(b.path));

        for (const item of flatTree) {
          const parts = item.path.split('/');
          const name = parts[parts.length - 1];
          const parentPath = parts.slice(0, -1).join('/');

          const node: FileNode = {
            name,
            path: item.path,
            type: item.type === 'blob' ? 'file' : 'dir',
            size: item.type === 'blob' ? item.size : undefined,
            children: item.type === 'tree' ? [] : undefined
          };

          pathMap.set(item.path, node);

          if (parentPath === '') {
            // Root level item
            nestedFiles.push(node);
          } else {
            // Find parent and add as child
            const parent = pathMap.get(parentPath);
            if (parent && parent.children) {
              parent.children.push(node);
            }
          }
        }

        // Sort children: dirs first, then alphabetical
        const sortChildren = (nodes: FileNode[]) => {
          nodes.sort((a, b) => {
            if (a.type === 'dir' && b.type !== 'dir') return -1;
            if (a.type !== 'dir' && b.type === 'dir') return 1;
            return a.name.localeCompare(b.name);
          });
          for (const node of nodes) {
            if (node.children) {
              sortChildren(node.children);
            }
          }
        };
        sortChildren(nestedFiles);

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ files: nestedFiles }));
      } catch (error) {
        console.error("Error fetching file tree:", error);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "Failed to fetch file tree" }));
      }
      return;
    }

    // GET /logs?project=&branch=&tail=100
    if (req.method === "GET" && parsed.pathname === "/logs") {
      const project = String(parsed.query.project || "");
      const branch = String(parsed.query.branch || "");
      const tail = Math.max(10, Math.min(5000, parseInt(String(parsed.query.tail || "400"),10)));
      if (!project || !branch) { res.statusCode = 400; res.end("project & branch required"); return; }
      
      const { runsPath } = await resolveWorkspace(project, branch);
      const runs = (await fs.pathExists(runsPath)) ? (await fs.readdir(runsPath)).sort() : [];
      const last = runs.at(-1); 
      
      if (!last) { 
        // No runs yet - return empty logs
        const payload = { 
          run: "none", 
          execute: "No runs yet - audit is starting...", 
          cli: "Waiting for job to begin..." 
        };
        res.setHeader("Content-Type","application/json"); 
        res.end(JSON.stringify(payload)); 
        return;
      }
      
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

      // Initial progress template
      const initialProgress = {
        overall_pct: 0,
        last_event: "Starting audit...",
        phases: [
          { name: "bootstrap", pct: 0, step: "initializing" },
          { name: "inventory", pct: 0, step: "waiting" },
          { name: "analysis", pct: 0, step: "waiting" },
          { name: "testgen", pct: 0, step: "waiting" },
          { name: "execute", pct: 0, step: "waiting" }
        ]
      };

      // Check for active (pending/running) jobs for this project/branch
      const activeJobs = await listJobs({ status: ['pending', 'running'] });
      const activeJob = activeJobs.find(j => j.project === project && j.branch === branch);

      // Check if there are any runs
      const { runsPath } = await resolveWorkspace(project, branch);
      const runs = (await fs.pathExists(runsPath)) ? (await fs.readdir(runsPath)).sort() : [];
      const last = runs.at(-1);

      // If there's an active job but no run folder yet, return initial progress
      if (activeJob && (!activeJob.runTimestamp || !runs.includes(activeJob.runTimestamp))) {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(initialProgress));
        return;
      }

      if (!last) {
        // No runs yet - return initial progress
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(initialProgress));
        return;
      }

      const rp = path.join(runsPath, last);
      const prog = await loadProgress(rp);
      if (!prog) {
        // Progress file doesn't exist yet - return initial progress
        initialProgress.last_event = "Setting up workspace...";
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(initialProgress));
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

      // Initial progress template
      const initialProgress = {
        overall_pct: 0,
        last_event: "Starting audit...",
        timestamp: new Date().toISOString(),
        phases: [
          { name: "bootstrap", pct: 0, step: "initializing" },
          { name: "inventory", pct: 0, step: "waiting" },
          { name: "analysis", pct: 0, step: "waiting" },
          { name: "testgen", pct: 0, step: "waiting" },
          { name: "execute", pct: 0, step: "waiting" }
        ]
      };

      const sendProgress = async () => {
        try {
          // Check for active jobs for this project/branch
          const activeJobs = await listJobs({ status: ['pending', 'running'] });
          const activeJob = activeJobs.find(j => j.project === project && j.branch === branch);

          const runs = (await fs.pathExists(runsPath)) ? (await fs.readdir(runsPath)).sort() : [];
          const last = runs.at(-1);

          // If there's an active job but no run folder yet, send initial progress
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
              // Progress file doesn't exist yet
              res.write(`data: ${JSON.stringify(initialProgress)}\n\n`);
            }
          } else {
            // No runs yet
            res.write(`data: ${JSON.stringify(initialProgress)}\n\n`);
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
      const sessionId = getSessionId(req);
      const mine = parsed.query.mine === 'true';
      const statusFilter = parsed.query.status ? String(parsed.query.status).split(',') as any[] : undefined;
      const limit = parsed.query.limit ? parseInt(String(parsed.query.limit)) : undefined;

      // Get userId for filtering (preferred over sessionId)
      let userId: string | undefined;
      if (mine && sessionId) {
        userId = await loadUserId(sessionId) || undefined;
      }

      const jobs = await listJobs({
        userId: mine ? userId : undefined,
        sessionId: mine && !userId && sessionId ? sessionId : undefined,
        status: statusFilter,
        limit
      });

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ jobs }));
      return;
    }

    // GET /jobs/:id/logs - Get job-specific logs for UI streaming
    const jobLogsMatch = parsed.pathname?.match(/^\/jobs\/(\d+)\/logs$/);
    if (req.method === "GET" && jobLogsMatch) {
      const jobId = parseInt(jobLogsMatch[1]);
      const offset = parseInt(String(parsed.query.offset || "0"));
      const limit = parseInt(String(parsed.query.limit || "100"));

      // Find job to get runTimestamp
      const qpath = path.join(getUatuHome(), "queue", "jobs.json");
      const jobsData = await fs.readJson(qpath).catch(() => ({ jobs: [] }));
      const job = jobsData.jobs.find((j: any) => j.id === jobId);

      if (!job) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Job not found" }));
        return;
      }

      if (!job.runTimestamp) {
        // Job hasn't started yet - no logs available
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ logs: [], nextOffset: 0, totalSize: 0, status: job.status }));
        return;
      }

      // Resolve workspace to get run path
      const { runsPath } = await resolveWorkspace(job.project, job.branch);
      const runPath = path.join(runsPath, job.runTimestamp);

      const result = await readJobLogs(runPath, { offset, limit });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ...result, status: job.status }));
      return;
    }

    // POST /jobs/:id/cancel - Cancel a job
    const jobCancelMatch = parsed.pathname?.match(/^\/jobs\/(\d+)\/cancel$/);
    if (req.method === "POST" && jobCancelMatch) {
      const jobId = parseInt(jobCancelMatch[1]);

      // Authorization check - only owner can cancel
      const sessionId = getSessionId(req);
      const job = await getJob(jobId);
      if (job && sessionId) {
        const userId = await loadUserId(sessionId);
        if (userId && job.userId && job.userId !== userId) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, message: 'Not authorized to cancel this job' }));
          return;
        }
      }

      const result = await cancelJob(jobId);

      // Reset progress to 0% after cancellation
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
              timestamp: new Date().toISOString()
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
      return;
    }

    // POST /jobs/:id/rerun - Re-run a completed/failed job
    const jobRerunMatch = parsed.pathname?.match(/^\/jobs\/(\d+)\/rerun$/);
    if (req.method === "POST" && jobRerunMatch) {
      const jobId = parseInt(jobRerunMatch[1]);
      const originalJob = await getJob(jobId);

      if (!originalJob) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: false, error: "Job not found" }));
        return;
      }

      // Get session for authorization and new job
      const sessionId = getSessionId(req);
      let accessToken: string | undefined;
      let userId: string | undefined;
      if (sessionId) {
        accessToken = await loadToken(sessionId) || undefined;
        userId = await loadUserId(sessionId) || undefined;
      }

      // Authorization check - only owner can rerun
      if (userId && originalJob.userId && originalJob.userId !== userId) {
        res.statusCode = 403;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: false, error: 'Not authorized to rerun this job' }));
        return;
      }

      // Create new job with same parameters
      const newJob = await enqueue({
        repo: originalJob.repo,
        project: originalJob.project,
        branch: originalJob.branch,
        ai: originalJob.ai,
        testStyles: originalJob.testStyles,
        accessToken,
        sessionId: sessionId || undefined,
        userId: userId || undefined
      });

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, job: newJob }));
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
      if (runs.length === 0) {
        res.statusCode = 404;
        res.end("No runs found");
        return;
      }

      // Find the latest run that has a report.html (completed runs)
      let runPath: string | null = null;
      for (let i = runs.length - 1; i >= 0; i--) {
        const candidatePath = path.join(runsPath, runs[i]);
        const reportExists = await fs.pathExists(path.join(candidatePath, "report.html"));
        if (reportExists) {
          runPath = candidatePath;
          break;
        }
      }

      if (!runPath) {
        res.statusCode = 404;
        res.end("No completed runs with report found");
        return;
      }
      
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

    // GET /certificate?project=&branch= - Serve certificate.html
    if (req.method === "GET" && parsed.pathname === "/certificate") {
      const project = String(parsed.query.project || "");
      const branch = String(parsed.query.branch || "");

      if (!project || !branch) {
        res.statusCode = 400;
        res.end("project & branch required");
        return;
      }

      const { runsPath } = await resolveWorkspace(project, branch);
      const runs = (await fs.pathExists(runsPath)) ? (await fs.readdir(runsPath)).sort() : [];
      if (runs.length === 0) {
        res.statusCode = 404;
        res.end("No runs found");
        return;
      }

      // Find the latest run that has a certificate.html
      let runPath: string | null = null;
      for (let i = runs.length - 1; i >= 0; i--) {
        const candidatePath = path.join(runsPath, runs[i]);
        const certExists = await fs.pathExists(path.join(candidatePath, "certificate.html"));
        if (certExists) {
          runPath = candidatePath;
          break;
        }
      }

      if (!runPath) {
        res.statusCode = 404;
        res.end("No certificate found");
        return;
      }

      const certPath = path.join(runPath, "certificate.html");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      const certData = await fs.readFile(certPath);
      res.end(certData);
      return;
    }

    if (req.method === "POST" && parsed.pathname === "/enqueue") {
      try {
        const chunks: any[] = [];
        for await (const c of req) chunks.push(c);
        const body = Buffer.concat(chunks).toString("utf8");
        console.log("Enqueue request body:", body);
        let payload: any = {};
        try { payload = JSON.parse(body || '{}'); } catch (e) { console.error("JSON parse error:", e); }
        let { repo, project, branch, ai, testStyles, selectedFiles } = payload || {};
        console.log("Enqueue params:", { repo, project, branch, ai, testStyles, selectedFiles: selectedFiles?.length || 0 });
        if (!repo || !project || !branch) { res.statusCode = 400; res.end(JSON.stringify({ ok:false, error: "repo, project, branch required" })); return; }

        // Get user's access token and userId from session
        const sessionId = getSessionId(req);
        console.log("Session ID from cookie:", sessionId || "NULL (no session cookie)");
        let accessToken: string | undefined;
        let userId: string | undefined;
        if (sessionId) {
          accessToken = await loadToken(sessionId) || undefined;
          userId = await loadUserId(sessionId) || undefined;
          console.log("User access token found:", accessToken ? "yes (length: " + accessToken.length + ")" : "no");
          console.log("User ID found:", userId || "no");
        } else {
          console.log("No sessionId cookie - user not logged in");
        }

        // Require authentication to start audits
        if (!userId) {
          console.log("AUTH FAILURE: No userId - returning 401. SessionId:", sessionId || "NULL");
          res.statusCode = 401;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            ok: false,
            error: "Authentication required",
            hint: "Please login with GitHub OAuth before starting an audit"
          }));
          return;
        }

        // Normalize repo input: allow "owner/name" shorthand, reject clearly invalid values
        if (typeof repo === 'string') {
          const trimmed = repo.trim();
          const ownerRepo = /^([\w.-]+)\/([\w.-]+)$/; // owner/name
          const urlLike = /^(https?:\/\/|git@)/i;
          if (ownerRepo.test(trimmed)) {
            const [, owner, name] = trimmed.match(ownerRepo)!;
            repo = `https://github.com/${owner}/${name}.git`;
          } else if (!urlLike.test(trimmed)) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok:false, error: "invalid_repo", hint: "Use https URL or owner/name" }));
            return;
          }
        }

        const job = await enqueue({ repo, project, branch, ai: !!ai, testStyles: testStyles || ["behavioral", "stride"], selectedFiles: selectedFiles || [], accessToken, sessionId: sessionId || undefined, userId: userId || undefined });
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

    if (req.method === "POST" && parsed.pathname === "/cleanup") {
      try {
        const result = await cleanupJobs();
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ 
          ok: true, 
          message: `Cleaned up ${result.removed} old jobs`, 
          removed: result.removed,
          remaining: result.remaining 
        }));
        return;
      } catch (error) {
        console.error("Cleanup error:", error);
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: false, error: "Cleanup failed" }));
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
          selectedFiles: job.selectedFiles || [],
          ai: job.ai,
          jobId: job.id,
          accessToken: job.accessToken
        });

        await complete(job.id, true, htmlPath);
        jobLog.info(`Job completed successfully`, {
          htmlPath,
          score,
          grade,
          workerId
        });
      } catch (error) {
        // Handle cancellation gracefully - job status already updated by cancelJob()
        if (error instanceof JobCancelledError) {
          jobLog.info(`Job cancelled by user`, { workerId });
          // Job status is already marked as failed with "Cancelled by user" message
          // No need to call complete() again
          continue;
        }

        jobLog.error(`Job failed`, { error: String(error), workerId });
        await complete(job.id, false, undefined, String(error));
      }
    } catch (error) {
      log.error(`Worker error`, { error: String(error) });
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}
