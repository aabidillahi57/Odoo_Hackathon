import { isDbConfigured, executeQuery } from './_shared/db';
import { jsonSuccess, jsonError, handleOptions } from './_shared/response';
import {
  validatePassword,
  hashPassword,
  hashToken,
  revokeAllUserSessions,
} from './_shared/auth';

export async function handler(event: any) {
  const origin = event.headers.origin || event.headers.Origin;

  if (event.httpMethod === 'OPTIONS') {
    return handleOptions(origin);
  }

  if (event.httpMethod !== 'POST') {
    return jsonError('Method Not Allowed', 405, undefined, {}, origin);
  }

  if (!isDbConfigured()) {
    return jsonError('Database is not configured.', 503, 'DB_NOT_CONFIGURED', {}, origin);
  }

  try {
    let body: any = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonError('Invalid JSON in request body', 400, undefined, {}, origin);
    }

    const token = String(body.token || '').trim();
    const newPassword = body.newPassword;

    if (!token) {
      return jsonError('Reset token is required.', 400, 'MISSING_TOKEN', {}, origin);
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return jsonError(passwordError, 400, 'WEAK_PASSWORD', {}, origin);
    }

    const tokenHashed = hashToken(token);

    // Look up token
    const tokenRows = await executeQuery<any>(
      `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = ?
       LIMIT 1;`,
      [tokenHashed]
    );

    if (tokenRows.length === 0) {
      return jsonError('Invalid or expired password reset link.', 400, 'INVALID_TOKEN', {}, origin);
    }

    const resetRecord = tokenRows[0];

    if (resetRecord.used_at !== null) {
      return jsonError('This password reset link has already been used.', 400, 'TOKEN_USED', {}, origin);
    }

    const expiresAt = new Date(resetRecord.expires_at);
    if (expiresAt < new Date()) {
      return jsonError('This password reset link has expired. Please request a new one.', 400, 'TOKEN_EXPIRED', {}, origin);
    }

    // Hash new password and update user record
    const passwordHash = await hashPassword(newPassword);
    await executeQuery(`UPDATE users SET password_hash = ? WHERE id = ?;`, [passwordHash, resetRecord.user_id]);

    // Mark token as used
    await executeQuery(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?;`, [resetRecord.id]);

    // Revoke all existing sessions for this user across all devices
    await revokeAllUserSessions(resetRecord.user_id);

    return jsonSuccess(
      { message: 'Password has been successfully updated. You can now log in with your new credentials.' },
      undefined,
      200,
      {},
      origin
    );
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR') {
      return jsonError('Database connection unavailable.', 503, 'DB_UNAVAILABLE', {}, origin);
    }
    return jsonError('Password reset failed. Please try again.', 500, undefined, {}, origin);
  }
}
