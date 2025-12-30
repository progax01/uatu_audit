import { Octokit } from "@octokit/rest";
import { logger } from "../utils/logger.js";

const log = logger.child({ service: "github-checks-client" });

export class GitHubChecksClient {
  private octokit: Octokit;

  constructor(auth: { token: string }) {
    this.octokit = new Octokit({ auth: auth.token });
  }

  async createCheckRun(owner: string, repo: string, head_sha: string, name: string = "uatu/gate") {
    log.info("Creating GitHub Check Run", { owner, repo, head_sha, name });
    
    try {
      const response = await this.octokit.checks.create({
        owner,
        repo,
        head_sha,
        name,
        status: "queued",
        started_at: new Date().toISOString(),
      });
      return response.data;
    } catch (error: any) {
      log.error("Failed to create GitHub Check Run", { error: error.message });
      throw error;
    }
  }

  async updateCheckRun(
    owner: string, 
    repo: string, 
    check_run_id: number, 
    status: "in_progress" | "completed", 
    conclusion?: "success" | "failure" | "neutral" | "action_required",
    output?: { title: string; summary: string; text?: string }
  ) {
    log.info("Updating GitHub Check Run", { owner, repo, check_run_id, status, conclusion });

    try {
      await this.octokit.checks.update({
        owner,
        repo,
        check_run_id,
        status,
        conclusion,
        output,
        completed_at: status === "completed" ? new Date().toISOString() : undefined,
      });
    } catch (error: any) {
      log.error("Failed to update GitHub Check Run", { error: error.message });
      throw error;
    }
  }
}

