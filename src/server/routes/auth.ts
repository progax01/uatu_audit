import path from "node:path";
import fs from "fs-extra";
import { getUatuHome } from "../../constants/paths.js";
import { logger } from "../../utils/logger.js";
import {
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
} from "../../services/jwtService.js";
import { hashToken } from "../../services/encryptionService.js";
import {
  findOrCreateUser,
  findUserById,
  getOrCreateWalletNonce,
  findOrCreateWalletUser,
  findUserByWalletAddress,
} from "../../repositories/userRepository.js";
import { verifyMessage } from 'viem';
import {
  createSession,
  findSessionByRefreshTokenHash,
  revokeSession,
  revokeSessionFamily,
  updateSessionRefreshToken,
  getDecryptedGithubToken,
} from "../../repositories/sessionRepository.js";
import { extractBearerToken, sendJson, sendError, parseJsonBody } from "../middleware/auth.js";

// In-memory session store (maps session ID to user tokens and userId) - LEGACY
const sessions = new Map<string, { token: string; userId?: string; createdAt: number }>();

// Extract session ID from cookie
export function getSessionId(req: any): string | null {
  const cookies = req.headers.cookie || "";
  const match = cookies.match(/session_id=([^;]+)/);
  return match ? match[1] : null;
}

// Set session cookie
export function setSessionCookie(res: any, sessionId: string, req?: any) {
  // Check if request came over HTTPS (direct or via proxy)
  const isSecure = req?.headers['x-forwarded-proto'] === 'https' ||
                   req?.connection?.encrypted ||
                   process.env.NODE_ENV === 'production';
  const secureFlag = isSecure ? '; Secure' : '';

  res.setHeader(
    "Set-Cookie",
    `session_id=${sessionId}; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=2592000`
  ); // 30 days
  logger.info("Session cookie set", { sessionId: sessionId.substring(0, 8) + '...', isSecure });
}

// Clear session cookie
export function clearSessionCookie(res: any, req?: any) {
  const isSecure = req?.headers['x-forwarded-proto'] === 'https' ||
                   req?.connection?.encrypted ||
                   process.env.NODE_ENV === 'production';
  const secureFlag = isSecure ? '; Secure' : '';

  res.setHeader("Set-Cookie", `session_id=; HttpOnly${secureFlag}; SameSite=Lax; Path=/; Max-Age=0`);
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

  // Auto-detect public URL from request host header in production
  const hostHeader = req.headers.host || req.headers[':authority'] || '';
  const isProduction = hostHeader.includes('audit.uatu.xyz') || hostHeader.includes('uatu.xyz');
  const PUBLIC_URL = process.env.UATU_PUBLIC_URL ||
    (isProduction ? `https://${hostHeader}` : `http://localhost:${PORT}`);
  const GH_CALLBACK = process.env.GITHUB_OAUTH_CALLBACK || `${PUBLIC_URL}/auth/github/callback`;

  logger.info("OAuth URL configuration", { hostHeader, isProduction, PUBLIC_URL, GH_CALLBACK });

  const { v4: uuidv4 } = await import("uuid");

  // GET /auth/status - Quick auth check (used by UI)
  if (req.method === "GET" && parsed.pathname === "/auth/status") {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ authed: false }));
      return true;
    }

    const tok = await loadToken(sessionId);
    if (!tok) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ authed: false }));
      return true;
    }

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ authed: true }));
    return true;
  }

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
      setSessionCookie(res, sessionId, req);

      logger.info("Session created successfully", { sessionId, userId });

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(
        `<script>
          var returnUrl = localStorage.getItem('oauth_return_url') || '/';
          localStorage.removeItem('oauth_return_url');
          window.location = returnUrl;
        </script><p>GitHub auth ok. Redirecting...</p>`
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
      setSessionCookie(res, sessionId, req);

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(
        `<script>
          var returnUrl = localStorage.getItem('oauth_return_url') || '/';
          localStorage.removeItem('oauth_return_url');
          window.location = returnUrl;
        </script><p>GitHub auth ok. Redirecting...</p>`
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
    clearSessionCookie(res, req);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  // GET /auth/logout - Alias for logout (supports GET for easy navigation)
  if ((req.method === "GET" || req.method === "POST") && parsed.pathname === "/auth/logout") {
    const sessionId = getSessionId(req);
    if (sessionId) {
      await deleteToken(sessionId);
    }
    clearSessionCookie(res, req);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  // ============================================================================
  // JWT-BASED AUTH ROUTES (New API)
  // ============================================================================

  // POST /auth/token - Exchange GitHub code for JWT tokens
  if (req.method === "POST" && parsed.pathname === "/auth/token") {
    try {
      const body = await parseJsonBody<{ code: string }>(req);
      const { code } = body;

      if (!code) {
        sendError(res, "Missing authorization code", 400);
        return true;
      }

      // Exchange code for GitHub access token
      const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: GH_CLIENT_ID,
          client_secret: GH_CLIENT_SECRET,
          code,
          redirect_uri: GH_CALLBACK,
        }),
      });

      const tokenData: any = await tokenResp.json();
      if (!tokenData.access_token) {
        logger.error("GitHub token exchange failed", { response: tokenData });
        sendError(res, tokenData.error_description || "Failed to exchange code", 400);
        return true;
      }

      // Fetch GitHub user info
      const userResp = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "User-Agent": "UatuAudit",
        },
      });
      const githubUser: any = await userResp.json();

      if (!githubUser.id) {
        sendError(res, "Failed to fetch GitHub user", 400);
        return true;
      }

      // Find or create user in database
      const { user, isNew } = await findOrCreateUser({
        githubId: String(githubUser.id),
        githubLogin: githubUser.login,
        githubEmail: githubUser.email,
        githubAvatarUrl: githubUser.avatar_url,
        displayName: githubUser.name || githubUser.login,
      });

      // Generate JWT token pair
      const tokens = generateTokenPair(
        user.id,
        user.githubId || '',
        user.githubLogin || '',
        user.tier
      );

      // Store session in database with encrypted GitHub token
      await createSession({
        userId: user.id,
        refreshTokenHash: hashToken(tokens.refreshToken),
        refreshTokenFamily: tokens.tokenFamily,
        githubToken: tokenData.access_token,
        expiresAt: tokens.refreshExpiresAt,
        userAgent: req.headers["user-agent"],
        ipAddress: req.socket?.remoteAddress,
      });

      logger.info("JWT session created", {
        userId: user.id,
        isNew,
        sessionId: tokens.sessionId,
      });

      sendJson(res, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.accessExpiresAt.toISOString(),
        user: {
          id: user.id,
          githubId: user.githubId,
          githubLogin: user.githubLogin,
          displayName: user.displayName,
          avatarUrl: user.githubAvatarUrl,
          tier: user.tier,
          xpBalance: user.xpBalance,
        },
      });
    } catch (e: any) {
      logger.error("Token exchange error", { error: e.message, stack: e.stack });
      sendError(res, "Token exchange failed", 500);
    }
    return true;
  }

  // POST /auth/refresh - Refresh access token using refresh token
  if (req.method === "POST" && parsed.pathname === "/auth/refresh") {
    try {
      const body = await parseJsonBody<{ refreshToken: string }>(req);
      const { refreshToken } = body;

      if (!refreshToken) {
        sendError(res, "Missing refresh token", 400);
        return true;
      }

      // Verify the refresh token
      const decoded = verifyRefreshToken(refreshToken);
      if (!decoded) {
        sendError(res, "Invalid or expired refresh token", 401);
        return true;
      }

      // Find the session by token hash
      const tokenHash = hashToken(refreshToken);
      const session = await findSessionByRefreshTokenHash(tokenHash);

      if (!session) {
        // Token reuse detected - revoke entire family
        logger.warn("Refresh token reuse detected", {
          family: decoded.family,
          userId: decoded.sub,
        });
        await revokeSessionFamily(decoded.family);
        sendError(res, "Refresh token has been revoked", 401);
        return true;
      }

      // Get user
      const user = await findUserById(decoded.sub);
      if (!user) {
        sendError(res, "User not found", 401);
        return true;
      }

      // Generate new token pair (token rotation)
      const tokens = generateTokenPair(
        user.id,
        user.githubId || '',
        user.githubLogin || '',
        user.tier,
        session.id,
        decoded.family
      );

      // Update session with new refresh token hash
      await updateSessionRefreshToken(
        session.id,
        hashToken(tokens.refreshToken),
        tokens.refreshExpiresAt
      );

      logger.info("Token refreshed", { userId: user.id, sessionId: session.id });

      sendJson(res, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.accessExpiresAt.toISOString(),
      });
    } catch (e: any) {
      logger.error("Token refresh error", { error: e.message, stack: e.stack });
      sendError(res, "Token refresh failed", 500);
    }
    return true;
  }

  // POST /auth/revoke - Revoke refresh token (logout)
  if (req.method === "POST" && parsed.pathname === "/auth/revoke") {
    try {
      const body = await parseJsonBody<{ refreshToken: string }>(req);
      const { refreshToken } = body;

      if (!refreshToken) {
        sendError(res, "Missing refresh token", 400);
        return true;
      }

      // Find and revoke the session
      const tokenHash = hashToken(refreshToken);
      const session = await findSessionByRefreshTokenHash(tokenHash);

      if (session) {
        await revokeSession(session.id);
        logger.info("Session revoked", { sessionId: session.id });
      }

      sendJson(res, { ok: true });
    } catch (e: any) {
      logger.error("Token revoke error", { error: e.message, stack: e.stack });
      sendError(res, "Token revoke failed", 500);
    }
    return true;
  }

  // GET /auth/me - Get current user (JWT auth)
  if (req.method === "GET" && parsed.pathname === "/auth/me") {
    const token = extractBearerToken(req);

    if (!token) {
      // Fall back to cookie-based auth for backward compatibility
      const sessionId = getSessionId(req);
      if (!sessionId) {
        sendError(res, "Unauthorized", 401);
        return true;
      }

      const tok = await loadToken(sessionId);
      if (!tok) {
        sendError(res, "Unauthorized", 401);
        return true;
      }

      // Get user from GitHub (legacy path)
      const userResp = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${tok}`, "User-Agent": "UatuAudit" },
      });
      const githubUser = await userResp.json();

      sendJson(res, {
        authed: true,
        user: githubUser,
        authMethod: "cookie",
      });
      return true;
    }

    // JWT auth path
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      sendError(res, "Invalid or expired token", 401);
      return true;
    }

    const user = await findUserById(decoded.sub);
    if (!user) {
      sendError(res, "User not found", 401);
      return true;
    }

    sendJson(res, {
      authed: true,
      user: {
        id: user.id,
        githubId: user.githubId,
        githubLogin: user.githubLogin,
        displayName: user.displayName,
        avatarUrl: user.githubAvatarUrl || user.avatarUrl,
        email: user.githubEmail || user.email,
        tier: user.tier,
        xpBalance: user.xpBalance,
        xpLifetime: user.xpLifetime,
        monthlyAuditsUsed: user.monthlyAuditsUsed,
        monthlyAuditsResetAt: user.monthlyAuditsResetAt,
        createdAt: user.createdAt,
        walletAddress: user.walletAddress,
        walletType: user.walletType,
      },
      authMethod: "jwt",
    });
    return true;
  }

  // ============================================================================
  // WALLET AUTH ROUTES
  // ============================================================================

  // GET /auth/wallet/nonce - Get nonce for wallet signing
  if (req.method === "GET" && parsed.pathname === "/auth/wallet/nonce") {
    try {
      const address = parsed.query.address;
      if (!address) {
        sendError(res, "Missing wallet address", 400);
        return true;
      }

      // Validate address format (basic check for EVM addresses)
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        sendError(res, "Invalid wallet address format", 400);
        return true;
      }

      const nonce = await getOrCreateWalletNonce(address);
      const message = buildSignMessage(address, nonce);

      sendJson(res, { nonce, message });
    } catch (e: any) {
      logger.error("Wallet nonce error", { error: e.message, stack: e.stack });
      sendError(res, "Failed to generate nonce", 500);
    }
    return true;
  }

  // POST /auth/wallet/verify - Verify wallet signature and create session
  if (req.method === "POST" && parsed.pathname === "/auth/wallet/verify") {
    try {
      const body = await parseJsonBody<{
        address: string;
        signature: string;
        nonce: string;
        walletType?: string;
      }>(req);

      const { address, signature, nonce, walletType = 'ethereum' } = body;

      if (!address || !signature || !nonce) {
        sendError(res, "Missing required fields: address, signature, nonce", 400);
        return true;
      }

      // Validate address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        sendError(res, "Invalid wallet address format", 400);
        return true;
      }

      // Build the message that was signed
      const message = buildSignMessage(address, nonce);

      // Verify the signature using viem
      let isValid = false;
      try {
        isValid = await verifyMessage({
          address: address as `0x${string}`,
          message,
          signature: signature as `0x${string}`,
        });
      } catch (verifyError: any) {
        logger.error("Signature verification error", { error: verifyError.message });
        sendError(res, "Signature verification failed", 400);
        return true;
      }

      if (!isValid) {
        sendError(res, "Invalid signature", 401);
        return true;
      }

      // Check nonce matches what we have stored
      const existingUser = await findUserByWalletAddress(address);
      if (existingUser && existingUser.walletNonce !== nonce) {
        sendError(res, "Nonce mismatch - please request a new nonce", 401);
        return true;
      }

      // Find or create user
      const validWalletTypes = ['ethereum', 'solana', 'cosmos', 'sui', 'aptos'] as const;
      const normalizedWalletType = validWalletTypes.includes(walletType as any)
        ? (walletType as typeof validWalletTypes[number])
        : 'ethereum';

      const { user, isNew } = await findOrCreateWalletUser({
        walletAddress: address,
        walletType: normalizedWalletType,
      });

      // Generate JWT token pair
      const tokens = generateTokenPair(
        user.id,
        '', // No GitHub ID for wallet auth
        '', // No GitHub login for wallet auth
        user.tier
      );

      // Store session in database (no GitHub token for wallet auth)
      await createSession({
        userId: user.id,
        refreshTokenHash: hashToken(tokens.refreshToken),
        refreshTokenFamily: tokens.tokenFamily,
        authMethod: 'wallet',
        expiresAt: tokens.refreshExpiresAt,
        userAgent: req.headers["user-agent"],
        ipAddress: req.socket?.remoteAddress,
      });

      logger.info("Wallet auth session created", {
        userId: user.id,
        walletAddress: address.slice(0, 10) + '...',
        isNew,
      });

      sendJson(res, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.accessExpiresAt.toISOString(),
        isNew, // Flag for frontend to redirect to onboarding
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          email: user.email,
          bio: user.bio,
          company: user.company,
          website: user.website,
          twitterHandle: user.twitterHandle,
          tier: user.tier,
          xpBalance: user.xpBalance,
          walletAddress: user.walletAddress,
          walletType: user.walletType,
        },
      });
    } catch (e: any) {
      logger.error("Wallet verify error", { error: e.message, stack: e.stack });
      sendError(res, "Wallet verification failed", 500);
    }
    return true;
  }

  // ============================================================================
  // PROFILE UPDATE ROUTES
  // ============================================================================

  // PUT /auth/profile - Update user profile (requires auth)
  if (req.method === "PUT" && parsed.pathname === "/auth/profile") {
    const token = extractBearerToken(req);
    if (!token) {
      sendError(res, "Unauthorized", 401);
      return true;
    }

    const decoded = verifyAccessToken(token);
    if (!decoded) {
      sendError(res, "Invalid or expired token", 401);
      return true;
    }

    try {
      const body = await parseJsonBody<{
        username?: string;
        displayName?: string;
        email?: string;
        bio?: string;
        company?: string;
        website?: string;
        twitterHandle?: string;
        avatarUrl?: string;
      }>(req);

      const user = await findUserById(decoded.sub);
      if (!user) {
        sendError(res, "User not found", 404);
        return true;
      }

      // Validate username if provided
      if (body.username) {
        // Username rules: 3-30 chars, alphanumeric + underscore, must start with letter
        const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{2,29}$/;
        if (!usernameRegex.test(body.username)) {
          sendError(res, "Invalid username. Must be 3-30 characters, start with a letter, and contain only letters, numbers, and underscores.", 400);
          return true;
        }

        // Check if username is taken (by another user)
        const { findUserByUsername } = await import("../../repositories/userRepository.js");
        const existingUser = await findUserByUsername(body.username);
        if (existingUser && existingUser.id !== user.id) {
          sendError(res, "Username is already taken", 409);
          return true;
        }
      }

      // Build updates object
      const updates: Record<string, any> = {};
      if (body.username !== undefined) updates.username = body.username.toLowerCase();
      if (body.displayName !== undefined) updates.displayName = body.displayName;
      if (body.email !== undefined) updates.email = body.email;
      if (body.bio !== undefined) updates.bio = body.bio;
      if (body.company !== undefined) updates.company = body.company;
      if (body.website !== undefined) updates.website = body.website;
      if (body.twitterHandle !== undefined) updates.twitterHandle = body.twitterHandle.replace('@', '');
      if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl;

      // Update user
      const { updateUser } = await import("../../repositories/userRepository.js");
      const updatedUser = await updateUser(user.id, updates);

      if (!updatedUser) {
        sendError(res, "Failed to update profile", 500);
        return true;
      }

      logger.info("Profile updated", { userId: user.id, updates: Object.keys(updates) });

      sendJson(res, {
        success: true,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          displayName: updatedUser.displayName,
          avatarUrl: updatedUser.avatarUrl || updatedUser.githubAvatarUrl,
          email: updatedUser.email || updatedUser.githubEmail,
          bio: updatedUser.bio,
          company: updatedUser.company,
          website: updatedUser.website,
          twitterHandle: updatedUser.twitterHandle,
          tier: updatedUser.tier,
          xpBalance: updatedUser.xpBalance,
          walletAddress: updatedUser.walletAddress,
          walletType: updatedUser.walletType,
          githubLogin: updatedUser.githubLogin,
        },
      });
    } catch (e: any) {
      logger.error("Profile update error", { error: e.message, stack: e.stack });
      sendError(res, "Profile update failed", 500);
    }
    return true;
  }

  // GET /auth/username/check - Check if username is available
  if (req.method === "GET" && parsed.pathname === "/auth/username/check") {
    const username = parsed.query.username;
    if (!username) {
      sendError(res, "Username required", 400);
      return true;
    }

    // Validate format
    const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{2,29}$/;
    if (!usernameRegex.test(username)) {
      sendJson(res, { available: false, reason: "Invalid format" });
      return true;
    }

    try {
      const { findUserByUsername } = await import("../../repositories/userRepository.js");
      const existingUser = await findUserByUsername(username.toLowerCase());
      sendJson(res, { available: !existingUser });
    } catch (e: any) {
      logger.error("Username check error", { error: e.message });
      sendError(res, "Check failed", 500);
    }
    return true;
  }

  return false;
}

// Helper to build the sign-in message
function buildSignMessage(address: string, nonce: string): string {
  return `Sign this message to authenticate with Uatu Audit.

Wallet: ${address}
Nonce: ${nonce}

This request will not trigger a blockchain transaction or cost any gas fees.`;
}
