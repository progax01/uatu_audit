import path from "node:path";
import fs from "fs-extra";
import { getUatuHome } from "../../constants/paths.js";
import { logger } from "../../utils/logger.js";

// In-memory session store (maps session ID to user tokens and userId)
const sessions = new Map<string, { token: string; userId?: string; createdAt: number }>();

// Extract session ID from cookie
export function getSessionId(req: any): string | null {
  const cookies = req.headers.cookie || "";
  const match = cookies.match(/session_id=([^;]+)/);
  return match ? match[1] : null;
}

// Set session cookie
export function setSessionCookie(res: any, sessionId: string) {
  res.setHeader(
    "Set-Cookie",
    `session_id=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`
  ); // 30 days
}

// Clear session cookie
export function clearSessionCookie(res: any) {
  res.setHeader("Set-Cookie", "session_id=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
}

async function tokenPath(sessionId: string) {
  const p = path.join(getUatuHome(), "sessions", sessionId, "secrets");
  await fs.ensureDir(p);
  return path.join(p, "github.json");
}

export async function saveToken(sessionId: string, token: string, userId?: string) {
  sessions.set(sessionId, { token, userId, createdAt: Date.now() });
  const p = await tokenPath(sessionId);
  await fs.writeJson(p, { token, userId }, { spaces: 2 });
}

export async function loadToken(sessionId: string): Promise<string | null> {
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

export async function loadUserId(sessionId: string): Promise<string | null> {
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

export async function deleteToken(sessionId: string) {
  sessions.delete(sessionId);
  const p = await tokenPath(sessionId);
  if (await fs.pathExists(p)) await fs.remove(p);
}

// Auth route handlers
export async function handleAuthRoutes(
  req: any,
  res: any,
  parsed: { pathname: string; query: any },
  PORT: number
): Promise<boolean> {
  const GH_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
  const GH_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";
  const GH_CALLBACK =
    process.env.GITHUB_OAUTH_CALLBACK || `http://localhost:${PORT}/auth/github/callback`;

  const { v4: uuidv4 } = await import("uuid");

  // GET /auth/github/login
  if (req.method === "GET" && parsed.pathname === "/auth/github/login") {
    logger.info("GitHub OAuth login initiated");
    if (!GH_CLIENT_ID) {
      logger.error("GitHub OAuth login failed: GITHUB_CLIENT_ID not set");
      res.statusCode = 500;
      res.end("GITHUB_CLIENT_ID not set");
      return true;
    }
    const scope = encodeURIComponent("repo read:org admin:repo_hook");
    const redirect = `https://github.com/login/oauth/authorize?client_id=${GH_CLIENT_ID}&redirect_uri=${encodeURIComponent(GH_CALLBACK)}&scope=${scope}`;
    logger.info("Redirecting to GitHub OAuth", { redirect });
    res.statusCode = 302;
    res.setHeader("Location", redirect);
    res.end();
    return true;
  }

  // GET /auth/github/callback
  if (req.method === "GET" && parsed.pathname === "/auth/github/callback") {
    logger.info("GitHub OAuth callback received", { query: parsed.query });
    try {
      const code = parsed.query.code;
      if (!code) {
        logger.error("GitHub OAuth callback failed: missing code");
        res.statusCode = 400;
        res.end("missing code");
        return true;
      }
      logger.info("Exchanging OAuth code for access token");
      const r = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: GH_CLIENT_ID,
          client_secret: GH_CLIENT_SECRET,
          code,
          redirect_uri: GH_CALLBACK,
        }),
      });
      const t: any = await r.json();
      if (!t.access_token) {
        logger.error("GitHub OAuth token exchange failed", { response: t });
        res.statusCode = 400;
        res.end(JSON.stringify(t));
        return true;
      }

      logger.info("GitHub OAuth token received successfully");

      // Fetch GitHub user to get userId
      let userId: string | undefined;
      try {
        logger.info("Fetching GitHub user information");
        const userResp = await fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${t.access_token}`, "User-Agent": "UatuAudit" },
        });
        const userData: any = await userResp.json();
        userId = userData.id ? String(userData.id) : undefined;
        logger.info("GitHub user fetched successfully", { userId, login: userData.login });
      } catch (e) {
        logger.error("Failed to fetch GitHub user", {
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined
        });
      }

      // Create new session for this user
      const sessionId = uuidv4();
      await saveToken(sessionId, t.access_token, userId);
      setSessionCookie(res, sessionId);

      logger.info("Session created successfully", { sessionId, userId });

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(
        `<script>window.opener||window.opener;window.location='/'</script><p>GitHub auth ok. You can close this tab and return to the test UI.</p>`
      );
    } catch (e: any) {
      logger.error("GitHub OAuth callback error", {
        error: e?.message || String(e),
        stack: e?.stack
      });
      res.statusCode = 500;
      res.end(String(e?.message || e));
    }
    return true;
  }

  // GET /auth/callback (alias)
  if (req.method === "GET" && parsed.pathname === "/auth/callback") {
    try {
      const code = parsed.query.code;
      if (!code) {
        res.statusCode = 400;
        res.end("missing code");
        return true;
      }
      const r = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: GH_CLIENT_ID,
          client_secret: GH_CLIENT_SECRET,
          code,
          redirect_uri: GH_CALLBACK,
        }),
      });
      const t: any = await r.json();
      if (!t.access_token) {
        res.statusCode = 400;
        res.end(JSON.stringify(t));
        return true;
      }

      let userId: string | undefined;
      try {
        const userResp = await fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${t.access_token}`, "User-Agent": "UatuAudit" },
        });
        const userData: any = await userResp.json();
        userId = userData.id ? String(userData.id) : undefined;
        logger.info("GitHub user fetched (alias callback)", { userId, login: userData.login });
      } catch (e) {
        logger.error("Failed to fetch GitHub user (alias callback)", {
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined
        });
      }

      const sessionId = uuidv4();
      await saveToken(sessionId, t.access_token, userId);
      setSessionCookie(res, sessionId);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(
        `<script>window.opener||window.opener;window.location='/'</script><p>GitHub auth ok. You can close this tab and return to the test UI.</p>`
      );
    } catch (e: any) {
      res.statusCode = 500;
      res.end(String(e?.message || e));
    }
    return true;
  }

  // GET /auth/github/me
  if (req.method === "GET" && parsed.pathname === "/auth/github/me") {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      res.statusCode = 401;
      res.end(JSON.stringify({ authed: false }));
      return true;
    }

    const tok = await loadToken(sessionId);
    if (!tok) {
      res.statusCode = 401;
      res.end(JSON.stringify({ authed: false }));
      return true;
    }

    const u = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tok}`, "User-Agent": "UatuAudit" },
    });
    const j = await u.json();
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ authed: true, user: j }));
    return true;
  }

  // POST /auth/github/logout
  if (req.method === "POST" && parsed.pathname === "/auth/github/logout") {
    const sessionId = getSessionId(req);
    if (sessionId) {
      await deleteToken(sessionId);
    }
    clearSessionCookie(res);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  return false;
}
