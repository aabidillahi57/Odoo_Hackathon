import { isDbConfigured, executeQuery } from './_shared/db';
import { jsonSuccess, jsonError, handleOptions } from './_shared/response';
import {
  normalizeEmail,
  validateEmail,
  validatePassword,
  hashPassword,
  createSession,
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
    const firstName = String(body.firstName || '').trim() || null;
    const lastName = String(body.lastName || '').trim() || null;
    const companyName = String(body.companyName || '').trim() || null;

    if (!email || !validateEmail(email)) {
      return jsonError('A valid email address is required.', 400, 'INVALID_EMAIL', {}, origin);
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

    // Create user (Public signup is strictly Customer role)
    const insertUserResult: any = await executeQuery(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, is_active)
       VALUES (?, ?, 'customer', ?, ?, TRUE);`,
      [email, passwordHash, firstName, lastName]
    );
    const userId = insertUserResult.insertId;

    // Link or create corresponding customer record
    let customerId: number;
    const existingCustomer = await executeQuery<any>(
      `SELECT id FROM customers WHERE email = ? LIMIT 1;`,
      [email]
    );

    if (existingCustomer.length > 0) {
      customerId = existingCustomer[0].id;
      await executeQuery(`UPDATE customers SET user_id = ? WHERE id = ?;`, [userId, customerId]);
    } else {
      const customerName = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];
      const insertCustomerResult: any = await executeQuery(
        `INSERT INTO customers (user_id, name, company_name, email)
         VALUES (?, ?, ?, ?);`,
        [userId, customerName, companyName, email]
      );
      customerId = insertCustomerResult.insertId;
    }

    // Create session and set HttpOnly cookie
    const clientIp = event.headers['x-forwarded-for'] || event.headers['client-ip'];
    const userAgent = event.headers['user-agent'];
    const { cookie } = await createSession(userId, clientIp, userAgent);

    const userProfile = {
      id: userId,
      email,
      role: 'customer',
      firstName,
      lastName,
      customerId,
    };

    return jsonSuccess(
      userProfile,
      { message: 'Registration successful' },
      201,
      { 'Set-Cookie': cookie },
      origin
    );
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR') {
      return jsonError('Database connection unavailable.', 503, 'DB_UNAVAILABLE', {}, origin);
    }
    return jsonError('Registration failed. Please try again.', 500, undefined, {}, origin);
  }
}
