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
    const rawPlans = await executeQuery<any>(
      `SELECT id, name, billing_interval, billing_interval_count, price, min_quantity,
              available_from, available_to, auto_close, early_close_policy, pause_allowed,
              renewal_policy, is_active
       FROM plans
       WHERE is_active = TRUE
       ORDER BY price ASC;`
    );

    const plans = rawPlans.map((p) => ({
      id: p.id,
      name: p.name,
      billingInterval: p.billing_interval,
      billingIntervalCount: Number(p.billing_interval_count),
      price: Number(p.price),
      minQuantity: Number(p.min_quantity),
      availableFrom: p.available_from,
      availableTo: p.available_to,
      autoClose: Boolean(p.auto_close),
      earlyClosePolicy: p.early_close_policy,
      pauseAllowed: Boolean(p.pause_allowed),
      renewalPolicy: p.renewal_policy,
      isActive: Boolean(p.is_active),
    }));

    return jsonSuccess(plans, { count: plans.length });
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR') {
      return jsonError('Database connection error. Please verify local MySQL is running.', 503, 'DB_UNAVAILABLE');
    }
    return jsonError('Failed to fetch subscription plans from database', 500);
  }
}
