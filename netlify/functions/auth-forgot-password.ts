import { isDbConfigured, executeQuery } from './_shared/db';
import { jsonSuccess, jsonError, handleOptions } from './_shared/response';
import {
  normalizeEmail,
  validateEmail,
  generateRandomToken,
  hashToken,
  checkRateLimit,
} from './_shared/auth';
import { sendPasswordResetEmail } from './_shared/brevo';

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

    const email = normalizeEmail(body.email);

    if (!email || !validateEmail(email)) {
      return jsonError('A valid email address is required.', 400, 'INVALID_EMAIL', {}, origin);
    }

    // Rate Limiting Check
    const clientIp = (event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown').split(',')[0].trim();
    const rateCheck = await checkRateLimit('password_reset', clientIp, 4, 15, 15);

    if (!rateCheck.allowed) {
      return jsonError(
        `Too many password reset requests. Please try again in ${Math.ceil((rateCheck.retryAfterSeconds || 900) / 60)} minutes.`,
        429,
        'RATE_LIMITED',
        {},
        origin
      );
    }

    // Always prepare a generic success message so we do not reveal whether the email is registered
    const genericSuccessMessage =
      'If an account matches that email address, password reset instructions have been sent.';

    // Look up user
    const users = await executeQuery<any>(
      `SELECT id, email, first_name, is_active FROM users WHERE email = ? LIMIT 1;`,
      [email]
    );

    if (users.length > 0 && users[0].is_active) {
      const user = users[0];

      // Invalidate existing active tokens for this user
      await executeQuery(
        `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL;`,
        [user.id]
      );

      // Create new token
      const rawToken = generateRandomToken(32);
      const tokenHashed = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await executeQuery(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES (?, ?, ?);`,
        [user.id, tokenHashed, expiresAt]
      );

      const recipientName = user.first_name || email.split('@')[0];
      const brevoResult = await sendPasswordResetEmail({
        recipientEmail: email,
        recipientName,
        resetToken: rawToken,
      });

      // If in local development and Brevo is unconfigured, return safe developer preview notice
      if (brevoResult.devMode) {
        return jsonSuccess(
          {
            message: genericSuccessMessage,
            devNotice: 'Brevo is running in local dev mode. Check server logs or use the simulated reset link below for testing.',
            devResetUrl: brevoResult.devResetUrl,
          },
          undefined,
          200,
          {},
          origin
        );
      }
    }

    return jsonSuccess({ message: genericSuccessMessage }, undefined, 200, {}, origin);
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR') {
      return jsonError('Database connection unavailable.', 503, 'DB_UNAVAILABLE', {}, origin);
    }
    return jsonError('Password reset request failed. Please try again.', 500, undefined, {}, origin);
  }
}
