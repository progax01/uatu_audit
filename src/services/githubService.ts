import { logger } from "../utils/logger.js";

const log = logger.child({ service: "githubService" });

/**
 * Parse owner and repo from GitHub URL
 * Supports: https://github.com/owner/repo.git or https://github.com/owner/repo
 */
export function parseGitHubRepo(repoUrl: string): { owner: string; repo: string } | null {
  // Skip non-GitHub URLs (e.g., scan:// protocol)
  if (!repoUrl.includes("github.com")) {
    return null;
  }

  // Match patterns like:
  // https://github.com/owner/repo.git
  // https://github.com/owner/repo
  // git@github.com:owner/repo.git
  const httpsMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  const sshMatch = repoUrl.match(/github\.com:([^\/]+)\/([^\/\.]+)/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  return null;
}

/**
 * Build the public report URL
 * Uses UATU_PUBLIC_URL env var (e.g., https://audit.uatu.xyz)
 */
export function buildReportUrl(project: string, branch: string, runTimestamp: string): string {
  const baseUrl = process.env.UATU_PUBLIC_URL || `http://localhost:${process.env.UATU_PORT || 9090}`;

  log.info("[GitHub Update] Building report URL", {
    baseUrl,
    project,
    branch,
    runTimestamp,
    UATU_PUBLIC_URL: process.env.UATU_PUBLIC_URL || "NOT SET"
  });

  const params = new URLSearchParams({
    project,
    branch,
    run: runTimestamp,
    format: "html"
  });
  const fullUrl = `${baseUrl}/report?${params.toString()}`;
  log.info("[GitHub Update] Report URL built", { fullUrl });
  return fullUrl;
}

/**
 * Update GitHub repository homepage URL (About section)
 * Uses PATCH /repos/{owner}/{repo} API
 */
export async function updateRepoHomepage(
  accessToken: string,
  repoUrl: string,
  reportUrl: string
): Promise<{ success: boolean; error?: string }> {
  log.info("[GitHub Update] Starting updateRepoHomepage", {
    repoUrl,
    reportUrl,
    hasAccessToken: !!accessToken,
    accessTokenLength: accessToken?.length || 0
  });

  const parsed = parseGitHubRepo(repoUrl);
  if (!parsed) {
    log.warn("[GitHub Update] Skipping - not a GitHub repo", { repoUrl });
    return { success: false, error: "Not a GitHub repository" };
  }

  const { owner, repo } = parsed;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

  log.info("[GitHub Update] Calling GitHub API", { owner, repo, apiUrl, reportUrl });

  try {
    const response = await fetch(apiUrl, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/vnd.github+json",
        "User-Agent": "UatuAudit",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({
        homepage: reportUrl
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      log.error("GitHub API error", {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
        owner,
        repo
      });
      return {
        success: false,
        error: `GitHub API returned ${response.status}: ${response.statusText}`
      };
    }

    log.info("Successfully updated GitHub repo homepage", { owner, repo, reportUrl });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("Failed to update GitHub repo homepage", {
      error: errorMessage,
      owner,
      repo
    });
    return { success: false, error: errorMessage };
  }
}
