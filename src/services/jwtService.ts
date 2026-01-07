import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// JWT configuration from environment
const JWT_SECRET = process.env.JWT_SECRET || 'uatu-jwt-secret-change-in-production';
const JWT_ACCESS_EXPIRY = (process.env.JWT_ACCESS_EXPIRY || '15m') as jwt.SignOptions['expiresIn'];
const JWT_REFRESH_EXPIRY = (process.env.JWT_REFRESH_EXPIRY || '30d') as jwt.SignOptions['expiresIn'];

export interface AccessTokenPayload {
  sub: string; // user UUID
  githubId: string;
  githubLogin: string;
  tier: 'free' | 'pro' | 'enterprise';
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string; // user UUID
  sessionId: string;
  family: string; // token family for reuse detection
  type: 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
  sessionId: string;
  tokenFamily: string;
}

export interface DecodedAccessToken extends AccessTokenPayload {
  iat: number;
  exp: number;
}

export interface DecodedRefreshToken extends RefreshTokenPayload {
  iat: number;
  exp: number;
}

/**
 * Generate a new access token
 */
export function generateAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRY }
  );
}

/**
 * Generate a new refresh token
 */
export function generateRefreshToken(
  userId: string,
  sessionId: string,
  family: string
): string {
  return jwt.sign(
    {
      sub: userId,
      sessionId,
      family,
      type: 'refresh',
    },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRY }
  );
}

/**
 * Generate a complete token pair (access + refresh)
 */
export function generateTokenPair(
  userId: string,
  githubId: string,
  githubLogin: string,
  tier: 'free' | 'pro' | 'enterprise',
  existingSessionId?: string,
  existingFamily?: string
): TokenPair {
  const sessionId = existingSessionId || uuidv4();
  const tokenFamily = existingFamily || uuidv4();

  const accessToken = generateAccessToken({
    sub: userId,
    githubId,
    githubLogin,
    tier,
  });

  const refreshToken = generateRefreshToken(userId, sessionId, tokenFamily);

  // Decode tokens to get expiry times
  const decodedAccess = jwt.decode(accessToken) as DecodedAccessToken;
  const decodedRefresh = jwt.decode(refreshToken) as DecodedRefreshToken;

  return {
    accessToken,
    refreshToken,
    accessExpiresAt: new Date(decodedAccess.exp * 1000),
    refreshExpiresAt: new Date(decodedRefresh.exp * 1000),
    sessionId,
    tokenFamily,
  };
}

/**
 * Verify and decode an access token
 */
export function verifyAccessToken(token: string): DecodedAccessToken | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedAccessToken;
    if (decoded.type !== 'access') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Verify and decode a refresh token
 */
export function verifyRefreshToken(token: string): DecodedRefreshToken | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedRefreshToken;
    if (decoded.type !== 'refresh') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Decode a token without verification (for inspection)
 */
export function decodeToken<T>(token: string): T | null {
  try {
    return jwt.decode(token) as T;
  } catch {
    return null;
  }
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(token: string): boolean {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  if (!decoded || !decoded.exp) {
    return true;
  }
  return Date.now() >= decoded.exp * 1000;
}

/**
 * Get token expiration time in seconds
 */
export function getTokenExpiresIn(token: string): number {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  if (!decoded || !decoded.exp) {
    return 0;
  }
  const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
  return Math.max(0, expiresIn);
}
