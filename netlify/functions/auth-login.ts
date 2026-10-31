import { isDbConfigured, executeQuery } from './_shared/db';
import { jsonSuccess, jsonError, handleOptions } from './_shared/response';
import {
  normalizeEmail,
  verifyPassword,
  createSession,
  checkRateLimit,
  clearRateLimit,
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
    return jsonError('Database is not configured. Please check server settings.', 503, 'DB_NOT_CONFIGURED', {}, origin);
  }

  try {
    let body: any = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonError('Invalid JSON in request body', 400, undefined, {}, origin);
    }

    const email = normalizeEmail(body.email);
    const password = body.password;

    if (!email || !password) {
      return jsonError('Email and password are required.', 400, 'MISSING_CREDENTIALS', {}, origin);
    }

    // Rate Limiting Check (by IP + email)
    const clientIp = (event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown').split(',')[0].trim();
    const rateLimitIdentifier = `${clientIp}:${email}`;
    const rateCheck = await checkRateLimit('login', rateLimitIdentifier, 5, 15, 15);

    if (!rateCheck.allowed) {
      return jsonError(
        `Too many failed login attempts. Please try again in ${Math.ceil((rateCheck.retryAfterSeconds || 900) / 60)} minutes.`,
        429,
        'RATE_LIMITED',
        {},
        origin
      );
    }

    // Fetch user with hashed password
    const users = await executeQuery<any>(
      `SELECT u.id, u.email, u.password_hash, u.role, u.first_name, u.last_name, u.is_active,
              c.id AS customer_id
       FROM users u
       LEFT JOIN customers c ON c.user_id = u.id
       WHERE u.email = ?
       LIMIT 1;`,
      [email]
    );

    if (users.length === 0) {
      return jsonError('Invalid email or password.', 401, 'INVALID_CREDENTIALS', {}, origin);
    }

    const user = users[0];

    if (!user.is_active) {
      return jsonError('This account has been deactivated. Please contact an administrator.', 403, 'ACCOUNT_DEACTIVATED', {}, origin);
    }

    const isMatch = await verifyPassword(password, user.password_hash);
    if (!isMatch) {
      return jsonError('Invalid email or password.', 401, 'INVALID_CREDENTIALS', {}, origin);
    }

    // Clear rate limit record on successful login
    await clearRateLimit('login', rateLimitIdentifier);

    // Create session and set HttpOnly cookie
    const userAgent = event.headers['user-agent'];
    const { cookie } = await createSession(user.id, clientIp, userAgent);

    const userProfile = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      customerId: user.customer_id ? Number(user.customer_id) : null,
    };

    return jsonSuccess(
      userProfile,
      { message: 'Login successful' },
      200,
      { 'Set-Cookie': cookie },
      origin
    );
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR') {
      return jsonError('Database connection unavailable.', 503, 'DB_UNAVAILABLE', {}, origin);
    }
    return jsonError('Authentication failed. Please try again.', 500, undefined, {}, origin);
  }
}
