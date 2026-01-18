import { IncomingMessage, ServerResponse } from 'http';
import { verifyAccessToken, type DecodedAccessToken } from '../../services/jwtService';
import { findUserById } from '../../repositories/userRepository';
import { findSessionById, getDecryptedGithubToken } from '../../repositories/sessionRepository';
import type { User } from '../../db/schema';

// Extended request type with auth context
export interface AuthenticatedRequest extends IncomingMessage {
  user?: User;
  accessToken?: DecodedAccessToken;
  githubToken?: string;
}

export interface AuthContext {
  user: User;
  accessToken: DecodedAccessToken;
  githubToken?: string;
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(req: IncomingMessage): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Verify the access token and get user context
 * Returns null if token is invalid or user not found
 */
export async function verifyAuth(req: IncomingMessage): Promise<AuthContext | null> {
  const authHeader = req.headers.authorization;
  console.log('[verifyAuth] Authorization header:', authHeader ? `${authHeader.substring(0, 20)}...` : 'MISSING');

  const token = extractBearerToken(req);
  if (!token) {
    console.log('[verifyAuth] No Bearer token found');
    return null;
  }

  console.log('[verifyAuth] Token extracted:', token.substring(0, 20) + '...');

  // Verify the JWT
  const decoded = verifyAccessToken(token);
  if (!decoded) {
    console.log('[verifyAuth] Token verification failed');
    return null;
  }

  console.log('[verifyAuth] Token decoded, userId:', decoded.sub);

  // Get user from database
  const user = await findUserById(decoded.sub);
  if (!user) {
    console.log('[verifyAuth] User not found in DB:', decoded.sub);
    return null;
  }

  console.log('[verifyAuth] SUCCESS - User authenticated:', user.id);

  return {
    user,
    accessToken: decoded,
  };
}

/**
 * Middleware helper - require authentication
 * Sends 401 if not authenticated
 */
export async function requireAuth(
  req: IncomingMessage,
  res: ServerResponse
): Promise<AuthContext | null> {
  const auth = await verifyAuth(req);

  if (!auth) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Unauthorized',
      message: 'Valid Bearer token required',
    }));
    return null;
  }

  return auth;
}

/**
 * Middleware helper - optional authentication
 * Returns auth context if token present and valid, null otherwise
 */
export async function optionalAuth(
  req: IncomingMessage
): Promise<AuthContext | null> {
  return verifyAuth(req);
}

/**
 * Middleware helper - require specific tier
 */
export async function requireTier(
  req: IncomingMessage,
  res: ServerResponse,
  allowedTiers: Array<'free' | 'pro' | 'enterprise'>
): Promise<AuthContext | null> {
  const auth = await requireAuth(req, res);
  if (!auth) return null;

  if (!allowedTiers.includes(auth.user.tier)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Forbidden',
      message: `This endpoint requires ${allowedTiers.join(' or ')} tier`,
      currentTier: auth.user.tier,
    }));
    return null;
  }

  return auth;
}

/**
 * Get GitHub token from a session (for API calls)
 */
export async function getGithubTokenFromSession(sessionId: string): Promise<string | null> {
  const session = await findSessionById(sessionId);
  if (!session) {
    return null;
  }
  return getDecryptedGithubToken(session);
}

/**
 * Parse JSON body from request
 */
export function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body) as T);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
export function sendJson(res: ServerResponse, data: unknown, statusCode: number = 200): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/**
 * Send error response
 */
export function sendError(
  res: ServerResponse,
  message: string,
  statusCode: number = 400,
  details?: unknown
): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  const responseBody: { error: string; message: string; details?: unknown } = {
    error: statusCode >= 500 ? 'Internal Server Error' : 'Bad Request',
    message,
  };
  if (details !== undefined) {
    responseBody.details = details;
  }
  res.end(JSON.stringify(responseBody));
}
