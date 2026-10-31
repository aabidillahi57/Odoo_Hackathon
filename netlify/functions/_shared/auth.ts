import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { executeQuery, isDbConfigured } from './db';

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: 'admin' | 'staff' | 'customer';
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  customerId?: number | null;
  sessionId: number;
}

/**
 * Normalizes email by trimming and converting to lowercase
 */
export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

/**
 * Validates standard email address syntax
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(normalizeEmail(email));
}

/**
 * Enforces Brightloop password complexity rules:
 * - Minimum length > 8 characters (at least 9 chars)
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one special character (!@#$%^&* etc.)
 */
export function validatePassword(password: string): string | null {
  if (!password || typeof password !== 'string') {
    return 'Password is required.';
  }
  if (password.length <= 8) {
    return 'Password must be longer than 8 characters (at least 9 characters).';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter (A-Z).';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter (a-z).';
  }
  if (!/[!@#$%^&*(),.?":{}|<>\-_+=\/\\~`[\]]/.test(password)) {
    return 'Password must contain at least one special character (!@#$%^&* etc.).';
  }
  return null;
}

/**
 * Hashes password using bcrypt with salt factor 12
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Compares plaintext password against stored bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Computes a SHA-256 hex digest of a token string
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a cryptographically secure random token (hex string)
 */
export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Parses HTTP Cookie header
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  }
  return cookies;
}

/**
 * Builds HttpOnly, SameSite, Secure cookie string for session token
 */
export function buildSessionCookie(token: string, maxAgeSeconds = 7 * 86400): string {
  const isProd = process.env.NODE_ENV === 'production';
  const secureFlag = isProd ? '; Secure' : '';
  return `session_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureFlag}`;
}

/**
 * Builds expired cookie string to revoke session in browser
 */
export function buildClearSessionCookie(): string {
  const isProd = process.env.NODE_ENV === 'production';
  const secureFlag = isProd ? '; Secure' : '';
  return `session_token=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0${secureFlag}`;
}

/**
 * Creates a server-managed session in MySQL database
 */
export async function createSession(userId: number, ipAddress?: string, userAgent?: string): Promise<{ token: string; cookie: string }> {
  const token = generateRandomToken(32);
  const tokenHashed = hashToken(token);
  const maxAgeSeconds = 7 * 86400; // 7 days
  const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);

  await executeQuery(
    `INSERT INTO user_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?);`,
    [userId, tokenHashed, ipAddress?.slice(0, 45) || null, userAgent?.slice(0, 255) || null, expiresAt]
  );

  const cookie = buildSessionCookie(token, maxAgeSeconds);
  return { token, cookie };
}

/**
 * Verifies session token from request Cookie header against database
 */
export async function getAuthenticatedUser(event: any): Promise<AuthenticatedUser | null> {
  if (!isDbConfigured()) {
    return null;
  }

  const cookieHeader = event.headers.cookie || event.headers.Cookie;
  const cookies = parseCookies(cookieHeader);
  const rawToken = cookies.session_token;

  if (!rawToken) {
    return null;
  }

  const tokenHashed = hashToken(rawToken);

  const rows = await executeQuery<any>(
    `SELECT s.id AS session_id, s.expires_at, s.revoked_at,
            u.id AS user_id, u.email, u.role, u.first_name, u.last_name, u.is_active,
            c.id AS customer_id
     FROM user_sessions s
     JOIN users u ON s.user_id = u.id
     LEFT JOIN customers c ON c.user_id = u.id
     WHERE s.token_hash = ?
       AND s.revoked_at IS NULL
       AND s.expires_at > NOW()
       AND u.is_active = TRUE
     LIMIT 1;`,
    [tokenHashed]
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.user_id,
    email: row.email,
    role: row.role,
    firstName: row.first_name,
    lastName: row.last_name,
    isActive: Boolean(row.is_active),
    customerId: row.customer_id ? Number(row.customer_id) : null,
    sessionId: row.session_id,
  };
}

/**
 * Revokes current session in database
 */
export async function revokeSession(event: any): Promise<void> {
  if (!isDbConfigured()) return;

  const cookieHeader = event.headers.cookie || event.headers.Cookie;
  const cookies = parseCookies(cookieHeader);
  const rawToken = cookies.session_token;

  if (rawToken) {
    const tokenHashed = hashToken(rawToken);
    await executeQuery(
      `UPDATE user_sessions SET revoked_at = NOW() WHERE token_hash = ?;`,
      [tokenHashed]
    );
  }
}

/**
 * Revokes all active sessions for a specific user (e.g. after password reset)
 */
export async function revokeAllUserSessions(userId: number): Promise<void> {
  await executeQuery(
    `UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL;`,
    [userId]
  );
}

/**
 * Checks and updates rate limits using auth_rate_limits table
 */
export async function checkRateLimit(
  action: 'login' | 'password_reset',
  identifier: string,
  maxAttempts = 5,
  windowMinutes = 15,
  lockoutMinutes = 15
): Promise<{ allowed: boolean; remainingAttempts: number; retryAfterSeconds?: number }> {
  if (!isDbConfigured()) {
    return { allowed: true, remainingAttempts: maxAttempts };
  }

  const normalizedId = String(identifier || '').trim().toLowerCase().slice(0, 255);
  const now = new Date();

  const rows = await executeQuery<any>(
    `SELECT id, attempts, first_attempt_at, last_attempt_at, locked_until
     FROM auth_rate_limits
     WHERE action = ? AND identifier = ?;`,
    [action, normalizedId]
  );

  if (rows.length === 0) {
    // First attempt record
    await executeQuery(
      `INSERT INTO auth_rate_limits (action, identifier, attempts, first_attempt_at, last_attempt_at)
       VALUES (?, ?, 1, NOW(), NOW());`,
      [action, normalizedId]
    );
    return { allowed: true, remainingAttempts: maxAttempts - 1 };
  }

  const record = rows[0];

  // If locked, check if lockout has passed
  if (record.locked_until) {
    const lockedUntilDate = new Date(record.locked_until);
    if (lockedUntilDate > now) {
      const retryAfterSeconds = Math.ceil((lockedUntilDate.getTime() - now.getTime()) / 1000);
      return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
    }
  }

  // Check if window has elapsed
  const firstAttemptDate = new Date(record.first_attempt_at);
  const windowElapsed = (now.getTime() - firstAttemptDate.getTime()) > windowMinutes * 60 * 1000;

  if (windowElapsed) {
    // Reset window
    await executeQuery(
      `UPDATE auth_rate_limits
       SET attempts = 1, first_attempt_at = NOW(), last_attempt_at = NOW(), locked_until = NULL
       WHERE id = ?;`,
      [record.id]
    );
    return { allowed: true, remainingAttempts: maxAttempts - 1 };
  }

  // Increment attempts
  const newAttempts = record.attempts + 1;
  if (newAttempts > maxAttempts) {
    const lockoutUntil = new Date(now.getTime() + lockoutMinutes * 60 * 1000);
    await executeQuery(
      `UPDATE auth_rate_limits
       SET attempts = ?, last_attempt_at = NOW(), locked_until = ?
       WHERE id = ?;`,
      [newAttempts, lockoutUntil, record.id]
    );
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds: lockoutMinutes * 60 };
  }

  await executeQuery(
    `UPDATE auth_rate_limits
     SET attempts = ?, last_attempt_at = NOW()
     WHERE id = ?;`,
    [newAttempts, record.id]
  );

  return { allowed: true, remainingAttempts: maxAttempts - newAttempts };
}

/**
 * Clears rate limit record upon successful authentication
 */
export async function clearRateLimit(action: 'login' | 'password_reset', identifier: string): Promise<void> {
  if (!isDbConfigured()) return;
  const normalizedId = String(identifier || '').trim().toLowerCase().slice(0, 255);
  await executeQuery(
    `DELETE FROM auth_rate_limits WHERE action = ? AND identifier = ?;`,
    [action, normalizedId]
  );
}
