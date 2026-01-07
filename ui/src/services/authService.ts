// JWT Auth Service for UatuAudit Frontend

const TOKEN_KEY = 'uatu_access_token';
const REFRESH_KEY = 'uatu_refresh_token';
const EXPIRY_KEY = 'uatu_token_expiry';
const USER_KEY = 'uatu_user';

export interface AuthUser {
  id: string;
  // GitHub auth fields (optional for wallet users)
  githubId?: string;
  githubLogin?: string;
  // Wallet auth fields (optional for GitHub users)
  walletAddress?: string;
  walletType?: 'ethereum' | 'solana' | 'cosmos' | 'sui' | 'aptos';
  // Profile fields
  displayName?: string;
  username?: string; // Claimed username on Uatu
  avatarUrl?: string;
  email?: string;
  bio?: string;
  company?: string;
  website?: string;
  twitterHandle?: string;
  // XP and tier
  tier: 'free' | 'pro' | 'enterprise';
  xpBalance: number;
  xpLifetime?: number;
  monthlyAuditsUsed?: number;
  // Flags
  isNewUser?: boolean; // True if user just created, needs onboarding
  needsUsername?: boolean; // True if wallet user hasn't claimed username
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

// Get stored tokens
export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): AuthUser | null {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
}

// Store tokens and user
export function storeAuth(tokens: AuthTokens, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  localStorage.setItem(EXPIRY_KEY, tokens.expiresAt);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Clear stored auth data
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(USER_KEY);
}

// Check if token is expired or about to expire (within 1 minute)
export function isTokenExpired(): boolean {
  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (!expiry) return true;

  const expiryDate = new Date(expiry);
  const now = new Date();
  const bufferMs = 60 * 1000; // 1 minute buffer

  return now.getTime() >= expiryDate.getTime() - bufferMs;
}

// Refresh the access token
export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      // Refresh token is invalid, clear auth
      clearAuth();
      return false;
    }

    const data = await response.json();
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
    localStorage.setItem(EXPIRY_KEY, data.expiresAt);

    return true;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  }
}

// Get a valid access token, refreshing if needed
export async function getValidToken(): Promise<string | null> {
  if (isTokenExpired()) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) return null;
  }
  return getAccessToken();
}

// Fetch with authentication
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getValidToken();

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If unauthorized, try to refresh and retry once
  if (response.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const newToken = getAccessToken();
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(url, { ...options, headers });
      }
    }
  }

  return response;
}

// Exchange GitHub OAuth code for JWT tokens
export async function exchangeCodeForTokens(
  code: string
): Promise<{ user: AuthUser; tokens: AuthTokens } | null> {
  try {
    const response = await fetch('/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      console.error('Token exchange failed:', await response.text());
      return null;
    }

    const data = await response.json();
    const tokens: AuthTokens = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
    };
    const user: AuthUser = data.user;

    storeAuth(tokens, user);
    return { user, tokens };
  } catch (error) {
    console.error('Token exchange error:', error);
    return null;
  }
}

// Check if user is authenticated (has valid tokens)
export async function isAuthenticated(): Promise<boolean> {
  const token = await getValidToken();
  return token !== null;
}

// Get current user from API
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const response = await authFetch('/auth/me');
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    if (data.authed && data.user) {
      // Update stored user data
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user;
    }
    return null;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}

// Logout - revoke refresh token and clear local storage
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();

  if (refreshToken) {
    try {
      await fetch('/auth/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch (error) {
      console.error('Token revoke failed:', error);
    }
  }

  // Also call legacy logout for cookie cleanup
  try {
    await fetch('/auth/logout');
  } catch (error) {
    console.error('Legacy logout failed:', error);
  }

  clearAuth();
}

// Initialize auth - check for existing tokens or legacy session
export async function initAuth(): Promise<{ authed: boolean; user: AuthUser | null }> {
  // First check for JWT tokens
  const storedUser = getStoredUser();
  if (storedUser && !isTokenExpired()) {
    return { authed: true, user: storedUser };
  }

  // Try to refresh if we have a refresh token
  if (getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const user = await getCurrentUser();
      return { authed: !!user, user };
    }
  }

  // Fall back to legacy cookie-based auth check
  try {
    const response = await fetch('/auth/status');
    const data = await response.json();
    if (data.authed) {
      // User is authenticated via cookie, get their info
      const meResponse = await fetch('/auth/me');
      if (meResponse.ok) {
        const meData = await meResponse.json();
        return { authed: true, user: meData.user };
      }
    }
  } catch (error) {
    console.error('Auth check failed:', error);
  }

  return { authed: false, user: null };
}
