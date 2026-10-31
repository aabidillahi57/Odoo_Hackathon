import { isDbConfigured, executeQuery } from './_shared/db';
import { jsonSuccess, jsonError, handleOptions } from './_shared/response';
import {
  normalizeEmail,
  validateEmail,
  validatePassword,
  hashPassword,
  getAuthenticatedUser,
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
    // 1. Authenticate and enforce Admin role
    const currentUser = await getAuthenticatedUser(event);

    if (!currentUser) {
      return jsonError('Authentication required. Please sign in as an Admin.', 401, 'UNAUTHENTICATED', {}, origin);
    }

    if (currentUser.role !== 'admin') {
      return jsonError(
        'Access denied. Only system Administrators are permitted to create internal staff accounts.',
        403,
        'FORBIDDEN',
        {},
        origin
      );
    }

    let body: any = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonError('Invalid JSON in request body', 400, undefined, {}, origin);
    }

    const email = normalizeEmail(body.email);
    const password = body.password;
    const firstName = String(body.firstName || '').trim() || null;
    const lastName = String(body.lastName || '').trim() || null;

    if (!email || !validateEmail(email)) {
      return jsonError('A valid staff email address is required.', 400, 'INVALID_EMAIL', {}, origin);
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return jsonError(passwordError, 400, 'WEAK_PASSWORD', {}, origin);
    }

    // Check if email already registered
    const existing = await executeQuery<any>('SELECT id FROM users WHERE email = ? LIMIT 1;', [email]);
    if (existing.length > 0) {
      return jsonError('An account with this email address already exists.', 409, 'EMAIL_EXISTS', {}, origin);
    }

    const passwordHash = await hashPassword(password);

    const insertResult: any = await executeQuery(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, is_active)
       VALUES (?, ?, 'staff', ?, ?, TRUE);`,
      [email, passwordHash, firstName, lastName]
    );

    const createdStaff = {
      id: insertResult.insertId,
      email,
      role: 'staff',
      firstName,
      lastName,
      isActive: true,
    };

    return jsonSuccess(
      createdStaff,
      { message: `Staff account created successfully for ${email}` },
      201,
      {},
      origin
    );
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR') {
      return jsonError('Database connection unavailable.', 503, 'DB_UNAVAILABLE', {}, origin);
    }
    return jsonError('Failed to create staff account. Please try again.', 500, undefined, {}, origin);
  }
}
