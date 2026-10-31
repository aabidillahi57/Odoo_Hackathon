import { isDbConfigured, executeQuery } from './_shared/db';
import { jsonSuccess, jsonError, handleOptions } from './_shared/response';

export async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  if (event.httpMethod !== 'GET') {
    return jsonError('Method Not Allowed', 405);
  }

  if (!isDbConfigured()) {
    return jsonError(
      'Database not configured. Please configure local MySQL in .env and run migrations.',
      503,
      'DB_NOT_CONFIGURED'
    );
  }

  try {
    const params = event.queryStringParameters || {};

    // Validate and clamp pagination inputs
    let page = parseInt(params.page || '1', 10);
    let limit = parseInt(params.limit || '10', 10);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;
    if (limit > 50) limit = 50; // Strict safe upper bound

    const offset = (page - 1) * limit;
    const search = params.search ? String(params.search).trim() : '';

    let whereClause = '';
    const queryParams: any[] = [];

    if (search) {
      whereClause = 'WHERE (c.name LIKE ? OR c.company_name LIKE ? OR c.email LIKE ?)';
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    // 1. Get total record count
    const countSql = `SELECT COUNT(*) AS total FROM customers c ${whereClause};`;
    const countResult = await executeQuery<any>(countSql, queryParams);
    const total = Number(countResult[0]?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;

    // 2. Query paginated records
    const selectSql = `
      SELECT c.id, c.user_id, c.name, c.company_name, c.email, c.phone,
             c.address_line1, c.city, c.state, c.country, c.created_at,
             (SELECT COUNT(*) FROM subscriptions s WHERE s.customer_id = c.id AND s.status = 'active') AS active_subs_count,
             COALESCE((SELECT SUM(i.total_amount) FROM invoices i WHERE i.customer_id = c.id AND i.status != 'cancelled'), 0) AS total_billed
      FROM customers c
      ${whereClause}
      ORDER BY c.id DESC
      LIMIT ? OFFSET ?;
    `;

    const customersResult = await executeQuery<any>(selectSql, [...queryParams, limit, offset]);

    const customers = customersResult.map((c) => ({
      id: c.id,
      userId: c.user_id,
      name: c.name,
      companyName: c.company_name,
      email: c.email,
      phone: c.phone,
      addressLine1: c.address_line1,
      city: c.city,
      state: c.state,
      country: c.country,
      activeSubscriptionsCount: Number(c.active_subs_count || 0),
      totalBilled: Number(c.total_billed || 0),
      createdAt: c.created_at ? new Date(c.created_at).toISOString().split('T')[0] : '',
    }));

    return jsonSuccess(customers, {
      page,
      limit,
      total,
      totalPages,
    });
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR') {
      return jsonError('Database connection error. Please verify local MySQL is running.', 503, 'DB_UNAVAILABLE');
    }
    return jsonError('Failed to fetch customers from database', 500);
  }
}
