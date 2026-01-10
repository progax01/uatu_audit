import "dotenv/config";
import { createServer } from "node:http";
import { URL } from "node:url";
import path from "node:path";
import fs from "fs-extra";
import { recoverStuckJobs } from "../services/jobQueue.js";
import { logger } from "../utils/logger.js";
import { startWorker } from "./worker.js";
import {
  handleAuthRoutes,
  handleGitHubRoutes,
  handleJobRoutes,
  handleReportRoutes,
  handleHealthRoutes,
  handleScanRoutes,
  handleProjectRoutes,
  handlePreAuditRoutes,
  handleBillingRoutes,
  handlePublicAuditRoutes,
  getSessionId,
  loadUserId,
} from "./routes/index.js";

import { GitHubWebhookServer } from "../github/appWebhookServer.js";

const PORT = parseInt(process.env.UATU_PORT || "9090");
const WEBHOOK_PORT = parseInt(process.env.UATU_WEBHOOK_PORT || "9091");
const CONCURRENCY = parseInt(process.env.UATU_CONCURRENCY || "2");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

/**
 * Main request handler - routes requests to appropriate handlers
 */
async function handleRequest(req: any, res: any) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parsed = { pathname: url.pathname, query: Object.fromEntries(url.searchParams) };

  // Log all incoming requests
  logger.info('HTTP Request', {
    method: req.method,
    path: parsed.pathname,
    query: parsed.query,
    userAgent: req.headers['user-agent']
  });

  try {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS,HEAD");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Hub-Signature-256");

    // Handle OPTIONS preflight
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    // Serve React UI
    if (parsed.pathname === "/" || parsed.pathname === "/index.html") {
      const uiPath = path.join(__dirname, "../../dist-ui/index.html");
      if (await fs.pathExists(uiPath)) {
        const content = await fs.readFile(uiPath, "utf8");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.writeHead(200);
        res.end(content);
        return;
      }
      res.statusCode = 404;
      res.end("UI not found");
      return;
    }

    // Serve React UI assets
    if (req.method === "GET" && parsed.pathname.startsWith("/assets/")) {
      const assetPath = path.join(__dirname, "../../dist-ui", parsed.pathname);
      if (await fs.pathExists(assetPath)) {
        const ext = path.extname(assetPath).toLowerCase();
        const contentType =
          ext === ".js"
            ? "application/javascript"
            : ext === ".css"
              ? "text/css"
              : ext === ".json"
                ? "application/json"
                : ext === ".svg"
                  ? "image/svg+xml"
                  : ext === ".png"
                    ? "image/png"
                    : ext === ".jpg" || ext === ".jpeg"
                      ? "image/jpeg"
                      : "application/octet-stream";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=31536000");
        const content = await fs.readFile(assetPath);
        res.end(content);
        return;
      } else {
        res.statusCode = 404;
        res.end(`Asset not found: ${parsed.pathname}`);
        return;
      }
    }

    // Serve static files from dist-ui root (logo.svg, vite.svg, etc.)
    if (req.method === "GET") {
      const staticPath = path.join(__dirname, "../../dist-ui", parsed.pathname);
      if (await fs.pathExists(staticPath)) {
        const stats = await fs.stat(staticPath);
        if (stats.isFile()) {
          const ext = path.extname(staticPath).toLowerCase();
          const contentType =
            ext === ".svg"
              ? "image/svg+xml"
              : ext === ".png"
                ? "image/png"
                : ext === ".jpg" || ext === ".jpeg"
                  ? "image/jpeg"
                  : ext === ".ico"
                    ? "image/x-icon"
                    : "application/octet-stream";
          res.setHeader("Content-Type", contentType);
          res.setHeader("Cache-Control", "public, max-age=31536000");
          const content = await fs.readFile(staticPath);
          res.end(content);
          return;
        }
      }
    }

    // Route to specific handlers
    if (await handleHealthRoutes(req, res, parsed, PORT, CONCURRENCY)) return;
    if (await handleAuthRoutes(req, res, parsed, PORT)) return;
    if (await handleGitHubRoutes(req, res, parsed)) return;
    if (await handleJobRoutes(req, res, parsed)) return;
    if (await handleReportRoutes(req, res, parsed)) return;
    if (await handleScanRoutes(req, res, parsed)) return;
    if (await handlePublicAuditRoutes(req, res, parsed)) return;

    // Project routes (with user context)
    const sessionId = getSessionId(req);
    const userId = sessionId ? await loadUserId(sessionId) : undefined;
    if (await handleProjectRoutes(req, res, { userId: userId || undefined, sessionId: sessionId || undefined })) return;

    // Billing routes (with user context)
    if (await handleBillingRoutes(req, res, { userId: userId || undefined, sessionId: sessionId || undefined })) return;

    // Pre-audit questionnaire routes
    if (await handlePreAuditRoutes(req, res, parsed)) return;

    // SPA fallback - serve index.html for all non-API GET requests (catch-all for client-side routing)
    if (req.method === "GET") {
      const apiPrefixes = ['/api/', '/auth/', '/github/', '/jobs/', '/report/', '/scan/', '/organization/', '/preaudit/', '/healthz'];
      const isApiRequest = apiPrefixes.some(prefix => parsed.pathname.startsWith(prefix));

      if (!isApiRequest) {
        const uiPath = path.join(__dirname, "../../dist-ui/index.html");
        if (await fs.pathExists(uiPath)) {
          const content = await fs.readFile(uiPath, "utf8");
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.writeHead(200);
          res.end(content);
          return;
        }
      }
    }

    // Default 404
    logger.warn('404 Not Found', { path: parsed.pathname, method: req.method });
    res.statusCode = 404;
    res.end("Not found");
  } catch (error) {
    logger.error("Request error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      path: parsed.pathname,
      method: req.method
    });
    res.statusCode = 500;
    res.end("Internal server error");
  }
}

/**
 * Start the daemon server and workers
 */
export async function startDaemon() {
  // Crash recovery
  logger.info("Performing crash recovery...");
  await recoverStuckJobs();

  logger.info(`Starting Uatu daemon`, { port: PORT, concurrency: CONCURRENCY });

  // Start worker pool
  for (let i = 0; i < CONCURRENCY; i++) {
    startWorker(i);
    logger.info(`Started worker ${i}`, { workerId: i });
  }

  // Start GitHub Webhook Server
  if (GITHUB_TOKEN) {
    const webhookServer = new GitHubWebhookServer(WEBHOOK_PORT, GITHUB_TOKEN);
    webhookServer.start();
    logger.info(`GitHub Webhook server listening`, { port: WEBHOOK_PORT });
  } else {
    logger.warn("GITHUB_TOKEN not set, Webhook server disabled");
  }

  // Start HTTP server
  const server = createServer(handleRequest);
  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`HTTP server listening`, { host: '0.0.0.0', port: PORT });
    logger.info(`Server ready at http://0.0.0.0:${PORT}`);
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    logger.info("Shutting down daemon...");
    server.close();
    process.exit(0);
  });
}
