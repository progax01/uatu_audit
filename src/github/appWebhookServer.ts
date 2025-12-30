import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { logger } from "../utils/logger.js";
import { GitHubChecksClient } from "./checksClient.js";

const log = logger.child({ service: "github-webhook-server" });

export class GitHubWebhookServer {
  private port: number;
  private checksClient: GitHubChecksClient;

  constructor(port: number, githubToken: string) {
    this.port = port;
    this.checksClient = new GitHubChecksClient({ token: githubToken });
  }

  start() {
    const server = createServer((req, res) => this.handleRequest(req, res));
    server.listen(this.port, () => {
      log.info("GitHub Webhook Server listening", { port: this.port });
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end("Method Not Allowed");
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        const event = req.headers["x-github-event"] as string;

        log.info("Received GitHub Webhook", { event, action: payload.action });

        if (event === "pull_request" && (payload.action === "opened" || payload.action === "synchronize")) {
          await this.handlePullRequest(payload);
        }

        res.statusCode = 200;
        res.end("OK");
      } catch (error: any) {
        log.error("Failed to process webhook", { error: error.message });
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    });
  }

  private async handlePullRequest(payload: any) {
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const sha = payload.pull_request.head.sha;

    log.info("Handling Pull Request Event", { owner, repo, sha });

    // Create GitHub Check Run
    await this.checksClient.createCheckRun(owner, repo, sha);
    
    // In a real scenario, this would trigger the runAll pipeline
    // for the specific SHA using WorkspaceManager.
  }
}

