import path from "node:path";
import fs from "fs-extra";
import { getUatuHome } from "../../constants/paths.js";
import { Metrics } from "../../services/metrics.js";

// Health and metrics route handlers
export async function handleHealthRoutes(
  req: any,
  res: any,
  parsed: { pathname: string; query: any },
  PORT: number,
  CONCURRENCY: number
): Promise<boolean> {
  // GET /healthz
  if (req.method === "GET" && parsed.pathname === "/healthz") {
    res.setHeader("Content-Type", "application/json");
    try {
      const queueFile = path.join(getUatuHome(), "queue", "jobs.json");
      const queueReadable = await fs.pathExists(queueFile);
      const stats = await fs.stat(".").catch(() => null);
      const diskSpaceOk = !stats || stats.size > 100 * 1024 * 1024; // 100MB threshold

      const health = {
        ok: queueReadable && diskSpaceOk,
        timestamp: new Date().toISOString(),
        checks: {
          queueReadable,
          diskSpaceOk,
          port: PORT,
          workers: CONCURRENCY,
        },
      };

      res.statusCode = health.ok ? 200 : 503;
      res.end(JSON.stringify(health));
    } catch (error) {
      res.statusCode = 503;
      res.end(JSON.stringify({ ok: false, error: String(error) }));
    }
    return true;
  }

  // GET /metrics
  if (req.method === "GET" && parsed.pathname === "/metrics") {
    res.setHeader("Content-Type", "text/plain");
    try {
      const prometheusMetrics = Metrics.toPrometheus();
      res.end(prometheusMetrics);
    } catch (error) {
      res.statusCode = 500;
      res.end(`# Error generating metrics: ${error}\n`);
    }
    return true;
  }

  // Serve brand assets
  if (req.method === "GET" && parsed.pathname.startsWith("/.uatu/brand/")) {
    const assetName = parsed.pathname.split("/").pop();
    if (!assetName) {
      res.statusCode = 404;
      res.end("Asset name required");
      return true;
    }

    const assetPath = path.resolve(".uatu", "brand", assetName);

    if (await fs.pathExists(assetPath)) {
      const ext = path.extname(assetName).toLowerCase();
      const contentType =
        ext === ".svg"
          ? "image/svg+xml"
          : ext === ".png"
            ? "image/png"
            : ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : "application/octet-stream";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=3600");
      const asset = await fs.readFile(assetPath);
      res.end(asset);
    } else {
      res.statusCode = 404;
      res.end(`Asset ${assetName} not found`);
    }
    return true;
  }

  return false;
}
