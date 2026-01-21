import fetch from "node-fetch";
import { URL } from "node:url";
import { logger } from "../utils/logger.js";
import type { ExternalReference } from "./liabilityMap.js";
import { getDb } from "../db/index.js";
import { projects, auditJobs, auditResults, components } from "../db/schema.js";
import { eq, and, desc, sql } from "drizzle-orm";

const log = logger.child({ service: "dependency-verifier" });

export interface AuditedProjectMatch {
  projectId: string;
  projectName: string;
  auditJobId: string;
  score: number;
  grade: string;
  auditedAt: Date;
  badgeUrl?: string;
}

export interface VerificationResult {
  ok: boolean;
  reason?: string;
  normalized?: ExternalReference;
  auditedProject?: AuditedProjectMatch;
  scoreAdjustment?: {
    type: 'audited' | 'third_party';
    scoreRecovery: number; // Points to add back
    percentage: number; // Percentage recovered (70% for third-party, 100% for audited)
    reason: string;
  };
}

/**
 * Check if a GitHub URL matches any of our audited projects
 */
async function findAuditedProject(githubUrl: string): Promise<AuditedProjectMatch | null> {
  try {
    const u = new URL(githubUrl);
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return null;

    const owner = segments[0];
    const repo = segments[1].replace('.git', '');
    const repoUrl = `https://github.com/${owner}/${repo}`;

    const db = getDb();

    // Get all projects with their components
    const allProjects = await db.select().from(projects);

    // Check each project's components for matching GitHub repo
    for (const project of allProjects) {
      // Get project components
      const projectComponents = await db
        .select()
        .from(components)
        .where(eq(components.projectId, project.id));

      // Check if any component matches the GitHub URL
      const matchingComponent = projectComponents.find(comp => {
        if (comp.type === 'github-repo' && comp.config) {
          const config: any = comp.config;
          return config.repoUrl?.includes(`${owner}/${repo}`) ||
                 config.url?.includes(`${owner}/${repo}`);
        }
        return false;
      });

      if (!matchingComponent) continue;

      // Get latest completed audit with results for this project
      const [latestAuditWithResults] = await db
        .select({
          jobId: auditJobs.id,
          completedAt: auditJobs.completedAt,
          score: auditResults.scoreValue,
          grade: auditResults.scoreLabel,
        })
        .from(auditJobs)
        .leftJoin(auditResults, eq(auditResults.jobId, auditJobs.id))
        .where(
          and(
            eq(auditJobs.projectId, project.id),
            eq(auditJobs.status, 'completed')
          )
        )
        .orderBy(desc(auditJobs.completedAt))
        .limit(1);

      if (latestAuditWithResults && latestAuditWithResults.score !== null) {
        log.info('Found matching audited project', {
          projectId: project.id,
          projectName: project.name,
          score: latestAuditWithResults.score,
          dependencyUrl: githubUrl
        });

        return {
          projectId: project.id,
          projectName: project.name,
          auditJobId: latestAuditWithResults.jobId,
          score: latestAuditWithResults.score,
          grade: latestAuditWithResults.grade || calculateGrade(latestAuditWithResults.score),
          auditedAt: latestAuditWithResults.completedAt!,
          badgeUrl: `https://audit.uatu.xyz/badge/${project.id}`
        };
      }
    }

    return null;
  } catch (err) {
    log.warn('Error checking for audited project', { error: String(err) });
    return null;
  }
}

function calculateGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Calculate score adjustment for a dependency finding
 * @param originalDeduction - Points deducted for this finding
 * @param isAudited - Whether the dependency was audited by us
 * @param auditScore - Score from our audit (if available)
 */
function calculateScoreAdjustment(
  originalDeduction: number,
  isAudited: boolean,
  auditScore?: number
): {
  type: 'audited' | 'third_party';
  scoreRecovery: number;
  percentage: number;
  reason: string;
} {
  if (isAudited && auditScore !== undefined) {
    // Dependency was audited by us - full score recovery based on their audit grade
    const recoveryPercentage = auditScore / 100; // Scale audit score to percentage
    const scoreRecovery = Math.round(originalDeduction * recoveryPercentage);

    return {
      type: 'audited',
      scoreRecovery,
      percentage: Math.round(recoveryPercentage * 100),
      reason: `This dependency has been audited by Uatu (Score: ${auditScore}/100). Score penalty reduced proportionally.`
    };
  } else {
    // Third-party dependency NOT audited by us - 70% recovery (or let Claude suggest)
    const recoveryPercentage = 0.70; // Default 70%
    const scoreRecovery = Math.round(originalDeduction * recoveryPercentage);

    return {
      type: 'third_party',
      scoreRecovery,
      percentage: 70,
      reason: `This is a third-party dependency. ${70}% of the score penalty is recovered as external liability.`
    };
  }
}

/**
 * Very lightweight verifier:
 * - Checks that the URL is a valid GitHub repo/file link
 * - Optionally checks HEAD/GET to ensure it exists
 * - Checks if the dependency was audited by us
 */
export async function verifyGitHubDependency(
  rawUrl: string,
  originalDeduction: number = 0
): Promise<VerificationResult> {
  try {
    const u = new URL(rawUrl);
    if (u.hostname !== "github.com") {
      return { ok: false, reason: "Not a github.com URL" };
    }

    // Pattern: /owner/repo[/...]
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return { ok: false, reason: "GitHub URL missing owner/repo" };
    }

    // HEAD request to check existence
    const resp = await fetch(u.toString(), { method: "HEAD" });
    if (!resp.ok) {
      return { ok: false, reason: `GitHub returned ${resp.status}` };
    }

    const normalized: ExternalReference = {
      type: "github",
      url: u.toString(),
      verified: true,
      last_verified_at: new Date().toISOString(),
    };

    // Check if this dependency was audited by us
    const auditedProject = await findAuditedProject(u.toString());

    // Calculate score adjustment if deduction was specified
    let scoreAdjustment;
    if (originalDeduction > 0) {
      scoreAdjustment = calculateScoreAdjustment(
        originalDeduction,
        !!auditedProject,
        auditedProject?.score
      );
    }

    return {
      ok: true,
      normalized,
      auditedProject: auditedProject || undefined,
      scoreAdjustment
    };
  } catch (err: any) {
    log.warn("Failed to verify GitHub dependency", { error: String(err) });
    return { ok: false, reason: "Invalid URL or network error" };
  }
}

/**
 * Verify npm package dependency
 */
export async function verifyNpmDependency(
  packageName: string,
  originalDeduction: number = 0
): Promise<VerificationResult> {
  try {
    // Check if package exists on npm registry
    const resp = await fetch(`https://registry.npmjs.org/${packageName}`);
    if (!resp.ok) {
      return { ok: false, reason: `npm package not found` };
    }

    const data: any = await resp.json();
    const githubUrl = data.repository?.url
      ?.replace('git+', '')
      ?.replace('git://', 'https://')
      ?.replace('.git', '');

    // If package has GitHub repo, check if we audited it
    let auditedProject;
    if (githubUrl && githubUrl.includes('github.com')) {
      auditedProject = await findAuditedProject(githubUrl);
    }

    const normalized: ExternalReference = {
      type: "npm",
      url: `https://www.npmjs.com/package/${packageName}`,
      verified: true,
      last_verified_at: new Date().toISOString(),
    };

    let scoreAdjustment;
    if (originalDeduction > 0) {
      scoreAdjustment = calculateScoreAdjustment(
        originalDeduction,
        !!auditedProject,
        auditedProject?.score
      );
    }

    return {
      ok: true,
      normalized,
      auditedProject: auditedProject || undefined,
      scoreAdjustment
    };
  } catch (err: any) {
    log.warn("Failed to verify npm dependency", { error: String(err) });
    return { ok: false, reason: "Invalid package or network error" };
  }
}

/**
 * Verify generic URL (website, docs, etc.)
 */
export async function verifyGenericUrl(
  rawUrl: string,
  originalDeduction: number = 0
): Promise<VerificationResult> {
  try {
    const u = new URL(rawUrl);

    // Simple HEAD request to check if URL exists
    const resp = await fetch(u.toString(), { method: "HEAD" });
    if (!resp.ok) {
      return { ok: false, reason: `URL returned ${resp.status}` };
    }

    const normalized: ExternalReference = {
      type: "other",
      url: u.toString(),
      verified: true,
      last_verified_at: new Date().toISOString(),
    };

    // Third-party URLs always get 70% recovery (not audited by us)
    let scoreAdjustment;
    if (originalDeduction > 0) {
      scoreAdjustment = calculateScoreAdjustment(originalDeduction, false);
    }

    return {
      ok: true,
      normalized,
      scoreAdjustment
    };
  } catch (err: any) {
    log.warn("Failed to verify URL", { error: String(err) });
    return { ok: false, reason: "Invalid URL or network error" };
  }
}

