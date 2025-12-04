import path from "node:path";
import fs from "fs-extra";
import { resolveWorkspace } from "../../services/workspaceService.js";

// Report route handlers
export async function handleReportRoutes(
  req: any,
  res: any,
  parsed: { pathname: string; query: any }
): Promise<boolean> {
  // GET /report?project=&branch=&format=pdf|html
  if (req.method === "GET" && parsed.pathname === "/report") {
    const project = String(parsed.query.project || "");
    const branch = String(parsed.query.branch || "");
    const format = String(parsed.query.format || "html");

    if (!project || !branch) {
      res.statusCode = 400;
      res.end("project & branch required");
      return true;
    }

    const { runsPath } = await resolveWorkspace(project, branch);
    const runs = (await fs.pathExists(runsPath)) ? (await fs.readdir(runsPath)).sort() : [];
    if (runs.length === 0) {
      res.statusCode = 404;
      res.end("No runs found");
      return true;
    }

    // Find the latest run that has a report.html
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
      return true;
    }

    if (format === "html") {
      const reportPath = path.join(runPath, "report.html");
      if (!(await fs.pathExists(reportPath))) {
        res.statusCode = 404;
        res.end("report.html not found (v1)");
        return true;
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      const reportData = await fs.readFile(reportPath);
      res.end(reportData);
      return true;
    } else if (format === "pdf") {
      const pdfPath = path.join(runPath, "report.pdf");
      if (!(await fs.pathExists(pdfPath))) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: "pdf_not_generated",
            hint: "Generate PDF via Puppeteer from report.html",
          })
        );
        return true;
      }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${project}-${branch}-audit.pdf"`);
      const reportData = await fs.readFile(pdfPath);
      res.end(reportData);
      return true;
    } else {
      res.statusCode = 400;
      res.end("format must be 'html' or 'pdf'");
      return true;
    }
  }

  // GET /certificate?project=&branch=
  if (req.method === "GET" && parsed.pathname === "/certificate") {
    const project = String(parsed.query.project || "");
    const branch = String(parsed.query.branch || "");

    if (!project || !branch) {
      res.statusCode = 400;
      res.end("project & branch required");
      return true;
    }

    const { runsPath } = await resolveWorkspace(project, branch);
    const runs = (await fs.pathExists(runsPath)) ? (await fs.readdir(runsPath)).sort() : [];
    if (runs.length === 0) {
      res.statusCode = 404;
      res.end("No runs found");
      return true;
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
      return true;
    }

    const certPath = path.join(runPath, "certificate.html");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    const certData = await fs.readFile(certPath);
    res.end(certData);
    return true;
  }

  return false;
}
