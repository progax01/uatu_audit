import { getSessionId, loadToken } from "./auth.js";
import { verifyAuth } from "../middleware/auth.js";
import { db } from "../../db/index.js";
import { sessions } from "../../db/schema.js";
import { eq, and, isNull, gt } from "drizzle-orm";
import { getDecryptedGithubToken } from "../../repositories/sessionRepository.js";

/**
 * Get GitHub token from request - checks PAT header, session cookie, then JWT auth
 */
async function getGitHubToken(req: any): Promise<string | null> {
  // First check for PAT in header (from Settings page)
  const patHeader = req.headers['x-github-token'];
  if (patHeader && typeof patHeader === 'string' && patHeader.trim()) {
    return patHeader.trim();
  }

  // Check session cookie (OAuth flow)
  const sessionId = getSessionId(req);
  if (sessionId) {
    const token = await loadToken(sessionId);
    if (token) return token;
  }

  // Fall back to JWT auth - look up user's active GitHub session
  const jwtAuth = await verifyAuth(req);
  console.log('[getGitHubToken] JWT auth result:', jwtAuth ? `userId=${jwtAuth.user.id}` : 'NONE');

  if (jwtAuth) {
    // Find user's most recent active session with GitHub token
    const userSessions = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, jwtAuth.user.id),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
          eq(sessions.authMethod, 'github')
        )
      )
      .orderBy(sessions.createdAt)
      .limit(1);

    console.log('[getGitHubToken] Found GitHub sessions:', userSessions.length);

    if (userSessions.length > 0) {
      console.log('[getGitHubToken] Session has encrypted token:', !!userSessions[0].githubTokenEncrypted);

      if (userSessions[0].githubTokenEncrypted) {
        const githubToken = getDecryptedGithubToken(userSessions[0]);
        console.log('[getGitHubToken] Decrypted token:', githubToken ? 'SUCCESS' : 'FAILED');
        if (githubToken) return githubToken;
      }
    }
  }

  console.log('[getGitHubToken] No GitHub token found via any method');
  return null;
}

// GitHub route handlers
export async function handleGitHubRoutes(
  req: any,
  res: any,
  parsed: { pathname: string; query: any }
): Promise<boolean> {
  // GET /github/repos?org=<org>
  if (req.method === "GET" && parsed.pathname === "/github/repos") {
    const token = await getGitHubToken(req);
    if (!token) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: "not authed" }));
      return true;
    }

    const org = String(parsed.query.org || "");
    const base = org
      ? `https://api.github.com/orgs/${encodeURIComponent(org)}/repos?per_page=100`
      : `https://api.github.com/user/repos?per_page=100`;
    const r = await fetch(base, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "UatuAudit" },
    });
    const list: any = await r.json();

    // Handle GitHub API error responses
    if (!Array.isArray(list)) {
      res.statusCode = r.status >= 400 ? r.status : 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: list?.message || "Failed to fetch repos" }));
      return true;
    }

    const slim = list.map((r: any) => ({
      id: r.id,
      full_name: r.full_name,
      default_branch: r.default_branch,
      clone_url: r.clone_url,
      private: r.private,
    }));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(slim));
    return true;
  }

  // GET /github/branches?repo=owner/name
  if (req.method === "GET" && parsed.pathname === "/github/branches") {
    const token = await getGitHubToken(req);
    if (!token) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: "not authed" }));
      return true;
    }

    const repo = String(parsed.query.repo || "");
    if (!repo || !repo.includes("/")) {
      res.statusCode = 400;
      res.end("repo=owner/name required");
      return true;
    }
    const r = await fetch(`https://api.github.com/repos/${repo}/branches?per_page=200`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "UatuAudit" },
    });
    const list = (await r.json()) as any[];
    const slim = list.map((b) => ({ name: b.name, protected: !!b.protected }));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(slim));
    return true;
  }

  // GET /github/files?repo=owner/name&branch=main
  if (req.method === "GET" && parsed.pathname === "/github/files") {
    const token = await getGitHubToken(req);
    if (!token) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: "not authed" }));
      return true;
    }

    const repo = String(parsed.query.repo || "");
    const branch = String(parsed.query.branch || "main");
    if (!repo || !repo.includes("/")) {
      res.statusCode = 400;
      res.end("repo=owner/name required");
      return true;
    }

    try {
      // Get the tree SHA for the branch
      const branchRes = await fetch(
        `https://api.github.com/repos/${repo}/branches/${encodeURIComponent(branch)}`,
        { headers: { Authorization: `Bearer ${token}`, "User-Agent": "UatuAudit" } }
      );
      if (!branchRes.ok) {
        res.statusCode = branchRes.status;
        res.end(JSON.stringify({ error: "Failed to fetch branch info" }));
        return true;
      }
      const branchData: any = await branchRes.json();
      const treeSha = branchData.commit?.sha;

      if (!treeSha) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Branch has no commits" }));
        return true;
      }

      // Fetch the full tree recursively
      const treeRes = await fetch(
        `https://api.github.com/repos/${repo}/git/trees/${treeSha}?recursive=1`,
        { headers: { Authorization: `Bearer ${token}`, "User-Agent": "UatuAudit" } }
      );
      if (!treeRes.ok) {
        res.statusCode = treeRes.status;
        res.end(JSON.stringify({ error: "Failed to fetch file tree" }));
        return true;
      }
      const treeData: any = await treeRes.json();

      // Convert flat tree to nested structure
      interface FileNode {
        name: string;
        path: string;
        type: "file" | "dir";
        size?: number;
        children?: FileNode[];
      }

      const flatTree = treeData.tree || [];
      const nestedFiles: FileNode[] = [];
      const pathMap = new Map<string, FileNode>();

      // Sort by path to ensure parents are processed first
      flatTree.sort((a: any, b: any) => a.path.localeCompare(b.path));

      for (const item of flatTree) {
        const parts = item.path.split("/");
        const name = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join("/");

        const node: FileNode = {
          name,
          path: item.path,
          type: item.type === "blob" ? "file" : "dir",
          size: item.type === "blob" ? item.size : undefined,
          children: item.type === "tree" ? [] : undefined,
        };

        pathMap.set(item.path, node);

        if (parentPath === "") {
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
          if (a.type === "dir" && b.type !== "dir") return -1;
          if (a.type !== "dir" && b.type === "dir") return 1;
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
    return true;
  }

  return false;
}
