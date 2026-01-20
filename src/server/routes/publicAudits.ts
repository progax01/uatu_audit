/**
 * Public Audits API Routes
 *
 * Provides endpoints for the Public Security Ledger page.
 */

import { logger } from "../../utils/logger.js";
import {
  getPublicAudits,
  getAuditWithResults,
  getAuditByLegacyId,
  getPublicAuditStats,
} from "../../repositories/auditJobRepository.js";

const log = logger.child({ service: "public-audits-routes" });

/**
 * Parse query parameters
 */
function parseQuery(query: any): {
  page: number;
  limit: number;
  network?: string;
  search?: string;
  auditType?: "quick" | "full";
  includeInProgress: boolean;
} {
  return {
    page: Math.max(1, parseInt(String(query.page || "1"))),
    limit: Math.min(100, Math.max(1, parseInt(String(query.limit || "20")))),
    network: query.network as string | undefined,
    search: query.search as string | undefined,
    auditType: query.auditType as "quick" | "full" | undefined,
    includeInProgress: query.includeInProgress === "true",
  };
}

/**
 * Public audits route handlers
 */
export async function handlePublicAuditRoutes(
  req: any,
  res: any,
  parsed: { pathname: string; query: any }
): Promise<boolean> {
  // GET /api/public-audits - List public audits with pagination
  if (req.method === "GET" && parsed.pathname === "/api/public-audits") {
    try {
      const { page, limit, network, search, auditType, includeInProgress } = parseQuery(parsed.query);

      log.info("Fetching public audits", { page, limit, network, search, auditType, includeInProgress });

      const result = await getPublicAudits({
        page,
        limit,
        network,
        searchTerm: search,
        auditType,
        includeInProgress,
      });

      // Transform audits for frontend
      const audits = result.audits.map((audit) => {
        // Normalize status: if completedAt is set, treat as completed regardless of status field
        // This handles stuck jobs that have completedAt but wrong status
        const normalizedStatus = audit.completedAt ? 'completed' : audit.status;
        const normalizedProgressPct = audit.completedAt ? 100 : audit.progressPct;
        const normalizedProgressMessage = audit.completedAt ? 'Scan complete' : audit.progressMessage;

        // Determine display name - prioritize project name, then contract name, then extract from source
        let displayName = audit.projectName || audit.contractName || 'Unknown Project';

        // If no project name or contract name, extract from source
        if (!audit.projectName && !audit.contractName) {
          if (audit.repo.startsWith('scan://')) {
            // For contract scans: scan://base/0xABC... -> 0xABC...4DEF
            const addressMatch = audit.repo.match(/scan:\/\/[^\/]+\/(0x[a-fA-F0-9]+)/);
            if (addressMatch && audit.contractAddress) {
              displayName = `${audit.contractAddress.slice(0, 6)}...${audit.contractAddress.slice(-4)}`;
            } else if (addressMatch) {
              displayName = `${addressMatch[1].slice(0, 6)}...${addressMatch[1].slice(-4)}`;
            }
          } else if (audit.repo.includes('github.com')) {
            // For GitHub repos: extract owner/repo
            const match = audit.repo.match(/github\.com\/([^\/]+\/[^\/\.]+)/);
            displayName = match ? match[1] : audit.repo;
          }
        }

        return {
          id: audit.id,
          legacyId: audit.legacyId,
          auditType: audit.auditType,
          contractAddress: audit.contractAddress,
          network: audit.contractNetwork,
          contractName: audit.contractName,
          isProxy: audit.isProxy,
          repo: audit.repo,
          branch: audit.branch,
          commitSha: audit.commitSha,
          projectName: displayName,
          projectDescription: audit.projectDescription,
          projectLogoUrl: audit.projectLogoUrl,
          projectGithubUrl: audit.projectGithubUrl || audit.repo,
          createdAt: audit.createdAt,
          completedAt: audit.completedAt,
          score: audit.scoreValue,
          grade: audit.scoreLabel,
          summary: audit.summary,
          // Include status fields for in-progress display (normalized)
          status: normalizedStatus,
          progressPct: normalizedProgressPct,
          progressMessage: normalizedProgressMessage,
        };
      });

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          audits,
          pagination: {
            page,
            limit,
            total: result.total,
            hasMore: result.hasMore,
            totalPages: Math.ceil(result.total / limit),
          },
        })
      );
      return true;
    } catch (error: any) {
      log.error("Failed to get public audits", { error: error.message });
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "Failed to fetch audits" }));
      return true;
    }
  }

  // GET /api/public-audits/stats - Get aggregate stats
  if (req.method === "GET" && parsed.pathname === "/api/public-audits/stats") {
    try {
      const stats = await getPublicAuditStats();

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          stats: {
            totalAudits: stats.totalAudits,
            quickScans: stats.quickScans,
            fullAudits: stats.fullAudits,
            avgScore: stats.avgScore,
            queuedCount: stats.queuedCount,
            inProgressCount: stats.inProgressCount,
            totalVulnerabilities: stats.totalVulnerabilities,
            chainsSupported: stats.chainsSupported,
          },
        })
      );
      return true;
    } catch (error: any) {
      log.error("Failed to get stats", { error: error.message });
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "Failed to fetch stats" }));
      return true;
    }
  }

  // GET /api/public-audits/:id - Get single audit details
  const uuidMatch = parsed.pathname?.match(
    /^\/api\/public-audits\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i
  );
  if (req.method === "GET" && uuidMatch) {
    try {
      const jobId = uuidMatch[1];
      const audit = await getAuditWithResults(jobId);

      if (!audit) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: false, error: "Audit not found" }));
        return true;
      }

      // Only show public audits on this endpoint
      if (audit.job.visibility !== "public") {
        res.statusCode = 403;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: false, error: "Audit is not public" }));
        return true;
      }

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          audit: {
            job: {
              id: audit.job.id,
              legacyId: audit.job.legacyId,
              auditType: audit.job.auditType,
              contractAddress: audit.job.contractAddress,
              contractNetwork: audit.job.contractNetwork,
              contractName: audit.job.contractName,
              isProxy: audit.job.isProxy,
              implementationAddress: audit.job.implementationAddress,
              repo: audit.job.repo,
              branch: audit.job.branch,
              status: audit.job.status,
              visibility: audit.job.visibility,
              createdAt: audit.job.createdAt,
              completedAt: audit.job.completedAt,
            },
            results: audit.results
              ? {
                  score: audit.results.scoreValue,
                  grade: audit.results.scoreLabel,
                  vulnerabilities: audit.results.findings,
                  summary: audit.results.summary,
                  metadata: audit.results.metadata,
                  // NEW: Comprehensive report fields (from metadata)
                  technicalChecks: (audit.results.metadata as any)?.technicalChecks || [],
                  businessRiskChecks: (audit.results.metadata as any)?.businessRiskChecks || [],
                  functionOverview: (audit.results.metadata as any)?.functionOverview || [],
                }
              : null,
          },
        })
      );
      return true;
    } catch (error: any) {
      log.error("Failed to get audit", { error: error.message });
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "Failed to fetch audit" }));
      return true;
    }
  }

  // GET /api/public-audits/legacy/:id - Get audit by legacy numeric ID
  const legacyMatch = parsed.pathname?.match(/^\/api\/public-audits\/legacy\/(\d+)$/);
  if (req.method === "GET" && legacyMatch) {
    try {
      const legacyId = parseInt(legacyMatch[1]);
      const audit = await getAuditByLegacyId(legacyId);

      if (!audit) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: false, error: "Audit not found" }));
        return true;
      }

      if (audit.job.visibility !== "public") {
        res.statusCode = 403;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: false, error: "Audit is not public" }));
        return true;
      }

      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          audit: {
            job: {
              id: audit.job.id,
              legacyId: audit.job.legacyId,
              auditType: audit.job.auditType,
              contractAddress: audit.job.contractAddress,
              contractNetwork: audit.job.contractNetwork,
              contractName: audit.job.contractName,
              isProxy: audit.job.isProxy,
              repo: audit.job.repo,
              status: audit.job.status,
              createdAt: audit.job.createdAt,
              completedAt: audit.job.completedAt,
            },
            results: audit.results
              ? {
                  score: audit.results.scoreValue,
                  grade: audit.results.scoreLabel,
                  vulnerabilities: audit.results.findings,
                  summary: audit.results.summary,
                  metadata: audit.results.metadata,
                  // NEW: Comprehensive report fields (from metadata)
                  technicalChecks: (audit.results.metadata as any)?.technicalChecks || [],
                  businessRiskChecks: (audit.results.metadata as any)?.businessRiskChecks || [],
                  functionOverview: (audit.results.metadata as any)?.functionOverview || [],
                }
              : null,
          },
        })
      );
      return true;
    } catch (error: any) {
      log.error("Failed to get audit by legacy ID", { error: error.message });
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "Failed to fetch audit" }));
      return true;
    }
  }

  return false;
}
