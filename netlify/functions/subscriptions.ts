import { getDbPool, isDbConfigured, executeQuery } from './_shared/db';
import { jsonSuccess, jsonError, handleOptions } from './_shared/response';
import { getAuthenticatedUser } from './_shared/auth';
import { generateSubscriptionNumber } from './_shared/sequence';
import {
  validateTransition,
  calculateRenewalExpiryDate,
  calculateNextBillingDate,
  SubscriptionStatus,
} from './_shared/lifecycle';

function parseSubscriptionPath(path: string): { id?: number; action?: string } {
  const cleanPath = path.replace(/^(\/\.netlify\/functions|\/api)?\/subscriptions\/?/, '');
  const segments = cleanPath.split('/').filter(Boolean);
  if (segments.length === 0) return {};
  const id = parseInt(segments[0], 10);
  if (!isNaN(id)) {
    return { id, action: segments[1] };
  }
  return {};
}

export async function handler(event: any) {
  const origin = event.headers.origin || event.headers.Origin;

  if (event.httpMethod === 'OPTIONS') {
    return handleOptions(origin);
  }

  if (!isDbConfigured()) {
    return jsonError(
      'Database not configured. Please configure MySQL environment variables.',
      503,
      'DB_NOT_CONFIGURED',
      {},
      origin
    );
  }

  const currentUser = await getAuthenticatedUser(event);
  if (!currentUser) {
    return jsonError('Authentication required to access subscriptions.', 401, 'UNAUTHORIZED', {}, origin);
  }

  const pathInfo = parseSubscriptionPath(event.path || '');
  const queryId = event.queryStringParameters?.id ? parseInt(event.queryStringParameters.id, 10) : undefined;
  const subscriptionId = pathInfo.id || queryId;
  const action = pathInfo.action || event.queryStringParameters?.action;

  try {
    // -------------------------------------------------------------------------
    // 1. GET Requests (List or Detail)
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'GET') {
      if (subscriptionId) {
        return await handleGetSubscriptionDetail(subscriptionId, currentUser, origin);
      }
      return await handleListSubscriptions(event, currentUser, origin);
    }

    // -------------------------------------------------------------------------
    // 2. POST Requests (Creation, Transitions, Renewals)
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'POST') {
      if (subscriptionId && action === 'transitions') {
        return await handleTransition(subscriptionId, event, currentUser, origin);
      }
      if (subscriptionId && action === 'renew') {
        return await handleRenew(subscriptionId, event, currentUser, origin);
      }
      if (subscriptionId && (action === 'pause' || action === 'resume')) {
        const targetStatus: SubscriptionStatus = action === 'pause' ? 'paused' : 'active';
        return await handleTransition(subscriptionId, event, currentUser, origin, targetStatus);
      }

      // Base creation (Draft or Quotation)
      return await handleCreateSubscription(event, currentUser, origin);
    }

    // -------------------------------------------------------------------------
    // 3. PUT Requests (Update draft details/lines)
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'PUT') {
      if (!subscriptionId) {
        return jsonError('Subscription ID is required for updates.', 400, 'BAD_REQUEST', {}, origin);
      }
      return await handleUpdateSubscription(subscriptionId, event, currentUser, origin);
    }

    return jsonError('Method Not Allowed', 405, undefined, {}, origin);
  } catch (err: any) {
    console.error('Subscription handler error:', err);
    return jsonError(err.message || 'Internal server error processing subscription request.', 500, 'SERVER_ERROR', {}, origin);
  }
}

/**
 * GET /api/subscriptions — List subscriptions with pagination, filtering, search
 */
async function handleListSubscriptions(event: any, currentUser: any, origin?: string) {
  const params = event.queryStringParameters || {};
  let page = parseInt(params.page || '1', 10);
  let limit = parseInt(params.limit || '10', 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 50) limit = 50;

  const offset = (page - 1) * limit;
  const search = params.search ? String(params.search).trim() : '';
  const statusFilter = params.status && params.status !== 'all' ? String(params.status).trim() : null;
  const customerFilter = params.customerId ? parseInt(params.customerId, 10) : null;
  const planFilter = params.planId ? parseInt(params.planId, 10) : null;

  const conditions: string[] = [];
  const queryParams: any[] = [];

  // Customer role isolation
  if (currentUser.role === 'customer') {
    if (!currentUser.customerId) {
      // User is customer but has no linked customer profile
      return jsonSuccess([], { page, limit, total: 0, totalPages: 1, counts: {} }, 200, {}, origin);
    }
    conditions.push('s.customer_id = ?');
    queryParams.push(currentUser.customerId);
  } else if (customerFilter) {
    conditions.push('s.customer_id = ?');
    queryParams.push(customerFilter);
  }

  if (statusFilter) {
    conditions.push('s.status = ?');
    queryParams.push(statusFilter);
  }

  if (planFilter) {
    conditions.push('s.plan_id = ?');
    queryParams.push(planFilter);
  }

  if (search) {
    conditions.push('(s.subscription_number LIKE ? OR c.name LIKE ? OR c.company_name LIKE ? OR c.email LIKE ?)');
    const searchPattern = `%${search}%`;
    queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 1. Total records
  const countSql = `
    SELECT COUNT(*) AS total
    FROM subscriptions s
    JOIN customers c ON s.customer_id = c.id
    ${whereClause};
  `;
  const countResult = await executeQuery<any>(countSql, queryParams);
  const total = Number(countResult[0]?.total || 0);
  const totalPages = Math.ceil(total / limit) || 1;

  // 2. Status counts for UI filter badges
  const statusCountClause = currentUser.role === 'customer'
    ? 'WHERE s.customer_id = ?'
    : '';
  const statusCountParams = currentUser.role === 'customer' ? [currentUser.customerId] : [];
  const statusCountsResult = await executeQuery<any>(
    `SELECT s.status, COUNT(*) AS count FROM subscriptions s ${statusCountClause} GROUP BY s.status;`,
    statusCountParams
  );
  const statusCounts: Record<string, number> = {
    all: total,
    draft: 0,
    quotation: 0,
    confirmed: 0,
    active: 0,
    paused: 0,
    closed: 0,
  };
  for (const row of statusCountsResult) {
    statusCounts[row.status] = Number(row.count || 0);
  }

  // 3. Paginated list
  const listSql = `
    SELECT s.id, s.subscription_number, s.customer_id, s.plan_id, s.template_id,
           s.status, s.start_date, s.expiry_date, s.next_billing_date,
           s.payment_terms, s.billing_interval, s.billing_interval_count,
           s.subtotal_amount, s.tax_amount, s.discount_amount, s.total_recurring_amount,
           s.auto_renew, s.created_at, s.updated_at,
           c.name AS customer_name, c.company_name, c.email AS customer_email,
           p.name AS plan_name, p.billing_interval AS plan_interval
    FROM subscriptions s
    JOIN customers c ON s.customer_id = c.id
    LEFT JOIN plans p ON s.plan_id = p.id
    ${whereClause}
    ORDER BY s.id DESC
    LIMIT ? OFFSET ?;
  `;

  const rows = await executeQuery<any>(listSql, [...queryParams, limit, offset]);

  const items = rows.map((r) => ({
    id: r.id,
    subscriptionNumber: r.subscription_number,
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    companyName: r.company_name,
    planId: r.plan_id,
    planName: r.plan_name || 'Custom Plan',
    billingInterval: r.billing_interval || r.plan_interval || 'monthly',
    billingIntervalCount: r.billing_interval_count || 1,
    status: r.status,
    startDate: r.start_date ? new Date(r.start_date).toISOString().split('T')[0] : '',
    expiryDate: r.expiry_date ? new Date(r.expiry_date).toISOString().split('T')[0] : null,
    nextBillingDate: r.next_billing_date ? new Date(r.next_billing_date).toISOString().split('T')[0] : null,
    paymentTerms: r.payment_terms,
    subtotalAmount: Number(r.subtotal_amount || 0),
    taxAmount: Number(r.tax_amount || 0),
    totalRecurringAmount: Number(r.total_recurring_amount || 0),
    recurringAmount: Number(r.total_recurring_amount || 0),
    autoRenew: Boolean(r.auto_renew),
    createdAt: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '',
  }));

  return jsonSuccess(
    items,
    {
      page,
      limit,
      total,
      totalPages,
      statusCounts,
    },
    200,
    {},
    origin
  );
}

/**
 * GET /api/subscriptions/:id — Single subscription detail with lines & authorized history
 */
async function handleGetSubscriptionDetail(id: number, currentUser: any, origin?: string) {
  const subRows = await executeQuery<any>(
    `SELECT s.*, 
            c.name AS customer_name, c.company_name, c.email AS customer_email, c.phone AS customer_phone,
            p.name AS plan_name, p.billing_interval AS plan_interval, p.pause_allowed, p.early_close_policy, p.renewal_policy,
            u_cr.first_name AS created_by_first, u_cr.last_name AS created_by_last,
            u_up.first_name AS updated_by_first, u_up.last_name AS updated_by_last,
            qt.name AS template_name
     FROM subscriptions s
     JOIN customers c ON s.customer_id = c.id
     LEFT JOIN plans p ON s.plan_id = p.id
     LEFT JOIN users u_cr ON s.created_by = u_cr.id
     LEFT JOIN users u_up ON s.updated_by = u_up.id
     LEFT JOIN quotation_templates qt ON s.template_id = qt.id
     WHERE s.id = ?
     LIMIT 1;`,
    [id]
  );

  if (!subRows || subRows.length === 0) {
    return jsonError('Subscription not found.', 404, 'NOT_FOUND', {}, origin);
  }

  const sub = subRows[0];

  // Ownership verification (IDOR protection)
  if (currentUser.role === 'customer' && sub.customer_id !== currentUser.customerId) {
    return jsonError('Subscription not found.', 404, 'NOT_FOUND', {}, origin);
  }

  // Fetch line items
  const lineRows = await executeQuery<any>(
    `SELECT sl.*, p.name AS product_name, p.type AS product_type,
            pv.attribute_name, pv.attribute_value,
            t.name AS tax_name
     FROM subscription_lines sl
     JOIN products p ON sl.product_id = p.id
     LEFT JOIN product_variants pv ON sl.variant_id = pv.id
     LEFT JOIN taxes t ON sl.tax_id = t.id
     WHERE sl.subscription_id = ?
     ORDER BY sl.id ASC;`,
    [id]
  );

  const lines = lineRows.map((l) => ({
    id: l.id,
    subscriptionId: l.subscription_id,
    productId: l.product_id,
    productName: l.product_name,
    productType: l.product_type,
    variantId: l.variant_id,
    variantName: l.attribute_value ? `${l.attribute_name}: ${l.attribute_value}` : null,
    description: l.description || l.product_name,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unit_price),
    taxId: l.tax_id,
    taxName: l.tax_name || (Number(l.tax_rate) > 0 ? `${l.tax_rate}%` : 'None'),
    taxRate: Number(l.tax_rate || 0),
    taxAmount: Number(l.tax_amount || 0),
    subtotalAmount: Number(l.subtotal_amount || 0),
    totalAmount: Number(l.total_amount || 0),
  }));

  // Fetch audit history ONLY for Staff / Admin
  let history: any[] = [];
  if (currentUser.role === 'admin' || currentUser.role === 'staff') {
    const historyRows = await executeQuery<any>(
      `SELECT sh.*, u.first_name, u.last_name, u.email AS actor_email, u.role AS actor_role
       FROM subscription_history sh
       LEFT JOIN users u ON sh.actor_user_id = u.id
       WHERE sh.subscription_id = ?
       ORDER BY sh.id DESC;`,
      [id]
    );

    history = historyRows.map((h) => ({
      id: h.id,
      subscriptionId: h.subscription_id,
      fromStatus: h.from_status,
      toStatus: h.to_status,
      action: h.action,
      actorUserId: h.actor_user_id,
      actorName: h.first_name ? `${h.first_name} ${h.last_name || ''}`.trim() : h.actor_email || 'System',
      actorRole: h.actor_role,
      reason: h.reason,
      metadata: typeof h.metadata === 'string' ? JSON.parse(h.metadata) : h.metadata,
      createdAt: h.created_at,
    }));
  }

  const detail = {
    id: sub.id,
    subscriptionNumber: sub.subscription_number,
    customerId: sub.customer_id,
    customerName: sub.customer_name,
    customerEmail: sub.customer_email,
    customerPhone: sub.customer_phone,
    companyName: sub.company_name,
    planId: sub.plan_id,
    planName: sub.plan_name || 'Custom Plan',
    templateId: sub.template_id,
    templateName: sub.template_name,
    status: sub.status,
    startDate: sub.start_date ? new Date(sub.start_date).toISOString().split('T')[0] : '',
    expiryDate: sub.expiry_date ? new Date(sub.expiry_date).toISOString().split('T')[0] : null,
    nextBillingDate: sub.next_billing_date ? new Date(sub.next_billing_date).toISOString().split('T')[0] : null,
    paymentTerms: sub.payment_terms,
    billingInterval: sub.billing_interval || sub.plan_interval || 'monthly',
    billingIntervalCount: sub.billing_interval_count || 1,
    subtotalAmount: Number(sub.subtotal_amount || 0),
    taxAmount: Number(sub.tax_amount || 0),
    discountAmount: Number(sub.discount_amount || 0),
    totalRecurringAmount: Number(sub.total_recurring_amount || 0),
    recurringAmount: Number(sub.total_recurring_amount || 0),
    autoRenew: Boolean(sub.auto_renew),
    pausedAt: sub.paused_at,
    resumedAt: sub.resumed_at,
    closedAt: sub.closed_at,
    cancellationReason: sub.cancellation_reason,
    // Customer view hides internal staff notes
    notes: currentUser.role !== 'customer' ? sub.notes : null,
    createdByName: sub.created_by_first ? `${sub.created_by_first} ${sub.created_by_last || ''}`.trim() : null,
    updatedByName: sub.updated_by_first ? `${sub.updated_by_first} ${sub.updated_by_last || ''}`.trim() : null,
    createdAt: sub.created_at,
    updatedAt: sub.updated_at,
    planPolicy: sub.plan_id
      ? {
          pauseAllowed: Boolean(sub.pause_allowed),
          earlyClosePolicy: sub.early_close_policy || 'allowed',
          renewalPolicy: sub.renewal_policy || 'auto_renew',
        }
      : null,
    lines,
    history,
  };

  return jsonSuccess(detail, undefined, 200, {}, origin);
}

/**
 * POST /api/subscriptions — Create new subscription (Draft or Quotation)
 */
async function handleCreateSubscription(event: any, currentUser: any, origin?: string) {
  if (currentUser.role !== 'admin' && currentUser.role !== 'staff') {
    return jsonError('Only Staff or Administrators can create subscriptions.', 403, 'FORBIDDEN', {}, origin);
  }

  let body: any;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch {
    return jsonError('Invalid JSON request body.', 400, 'BAD_REQUEST', {}, origin);
  }

  const { customerId, planId, templateId, startDate, expiryDate, paymentTerms, autoRenew, notes, lines } = body;

  if (!customerId || isNaN(parseInt(customerId, 10))) {
    return jsonError('A valid customerId is required.', 400, 'BAD_REQUEST', {}, origin);
  }

  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return jsonError('A valid startDate (YYYY-MM-DD) is required.', 400, 'BAD_REQUEST', {}, origin);
  }

  if (!lines || !Array.isArray(lines) || lines.length === 0) {
    return jsonError('Subscription must contain at least one line item.', 400, 'BAD_REQUEST', {}, origin);
  }

  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Verify customer exists
    const [custRows]: any = await connection.execute(
      'SELECT id, name FROM customers WHERE id = ?;',
      [customerId]
    );
    if (!custRows || custRows.length === 0) {
      await connection.rollback();
      return jsonError('Selected customer does not exist.', 400, 'BAD_REQUEST', {}, origin);
    }

    // 2. Verify plan if provided
    let plan: any = null;
    if (planId) {
      const [planRows]: any = await connection.execute(
        'SELECT * FROM plans WHERE id = ? AND is_active = TRUE;',
        [planId]
      );
      if (!planRows || planRows.length === 0) {
        await connection.rollback();
        return jsonError('Selected plan is invalid or inactive.', 400, 'BAD_REQUEST', {}, origin);
      }
      plan = planRows[0];
    }

    // 3. Authoritative server price and tax calculation
    const calculatedLines: any[] = [];
    let subtotalSum = 0;
    let taxSum = 0;

    for (const line of lines) {
      const quantity = parseInt(line.quantity || '1', 10);
      if (isNaN(quantity) || quantity < 1) {
        await connection.rollback();
        return jsonError('Line item quantity must be at least 1.', 400, 'BAD_REQUEST', {}, origin);
      }

      // Re-read product from DB
      const [prodRows]: any = await connection.execute(
        'SELECT id, name, sales_price, is_active FROM products WHERE id = ?;',
        [line.productId]
      );
      if (!prodRows || prodRows.length === 0 || !prodRows[0].is_active) {
        await connection.rollback();
        return jsonError(`Product ID ${line.productId} is invalid or inactive.`, 400, 'BAD_REQUEST', {}, origin);
      }
      const prod = prodRows[0];

      let unitPrice = Number(prod.sales_price);
      let variantDescription = '';

      // Re-read variant if specified
      if (line.variantId) {
        const [varRows]: any = await connection.execute(
          'SELECT id, attribute_name, attribute_value, price_adjustment, is_active FROM product_variants WHERE id = ? AND product_id = ?;',
          [line.variantId, prod.id]
        );
        if (!varRows || varRows.length === 0 || !varRows[0].is_active) {
          await connection.rollback();
          return jsonError(`Product variant ID ${line.variantId} is invalid or does not belong to product ${prod.name}.`, 400, 'BAD_REQUEST', {}, origin);
        }
        unitPrice += Number(varRows[0].price_adjustment || 0);
        variantDescription = ` (${varRows[0].attribute_name}: ${varRows[0].attribute_value})`;
      }

      // Re-read tax if specified
      let taxRate = 0;
      if (line.taxId) {
        const [taxRows]: any = await connection.execute(
          'SELECT id, name, rate_percentage FROM taxes WHERE id = ? AND is_active = TRUE;',
          [line.taxId]
        );
        if (taxRows && taxRows.length > 0) {
          taxRate = Number(taxRows[0].rate_percentage || 0);
        }
      }

      const lineSubtotal = Number((quantity * unitPrice).toFixed(2));
      const lineTax = Number((lineSubtotal * (taxRate / 100)).toFixed(2));
      const lineTotal = Number((lineSubtotal + lineTax).toFixed(2));

      subtotalSum += lineSubtotal;
      taxSum += lineTax;

      calculatedLines.push({
        productId: prod.id,
        variantId: line.variantId || null,
        description: line.description || `${prod.name}${variantDescription}`,
        quantity,
        unitPrice,
        taxId: line.taxId || null,
        taxRate,
        taxAmount: lineTax,
        subtotalAmount: lineSubtotal,
        totalAmount: lineTotal,
      });
    }

    const subtotalAmount = Number(subtotalSum.toFixed(2));
    const taxAmount = Number(taxSum.toFixed(2));
    const totalRecurringAmount = Number((subtotalAmount + taxAmount).toFixed(2));

    const status: SubscriptionStatus = body.status === 'quotation' ? 'quotation' : 'draft';
    const interval = plan ? plan.billing_interval : 'monthly';
    const intervalCount = plan ? plan.billing_interval_count : 1;
    const nextBillingDate = calculateNextBillingDate(startDate, interval, intervalCount);

    // 4. Generate concurrency-safe subscription number
    const subscriptionNumber = await generateSubscriptionNumber(connection);

    // 5. Insert subscription record
    const [subResult]: any = await connection.execute(
      `INSERT INTO subscriptions (
        subscription_number, customer_id, plan_id, template_id, status,
        start_date, expiry_date, next_billing_date, payment_terms,
        billing_interval, billing_interval_count, subtotal_amount, tax_amount,
        discount_amount, total_recurring_amount, auto_renew, notes,
        created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?, ?, ?);`,
      [
        subscriptionNumber,
        customerId,
        planId || null,
        templateId || null,
        status,
        startDate,
        expiryDate || null,
        nextBillingDate,
        paymentTerms || 'Immediate Payment',
        interval,
        intervalCount,
        subtotalAmount,
        taxAmount,
        totalRecurringAmount,
        autoRenew !== undefined ? Boolean(autoRenew) : true,
        notes || null,
        currentUser.id,
        currentUser.id,
      ]
    );

    const newSubId = subResult.insertId;

    // 6. Insert lines
    for (const l of calculatedLines) {
      await connection.execute(
        `INSERT INTO subscription_lines (
          subscription_id, product_id, variant_id, description, quantity,
          unit_price, tax_id, tax_rate, tax_amount, subtotal_amount, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          newSubId,
          l.productId,
          l.variantId,
          l.description,
          l.quantity,
          l.unitPrice,
          l.taxId,
          l.taxRate,
          l.taxAmount,
          l.subtotalAmount,
          l.totalAmount,
        ]
      );
    }

    // 7. Write audit history record
    await connection.execute(
      `INSERT INTO subscription_history (
        subscription_id, from_status, to_status, actor_user_id, action, reason
      ) VALUES (?, NULL, ?, ?, 'created', ?);`,
      [newSubId, status, currentUser.id, `Created subscription in ${status} status`]
    );

    await connection.commit();

    return jsonSuccess(
      {
        id: newSubId,
        subscriptionNumber,
        status,
        totalRecurringAmount,
        message: `Subscription ${subscriptionNumber} successfully created in ${status} status.`,
      },
      undefined,
      201,
      {},
      origin
    );
  } catch (err: any) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * PUT /api/subscriptions/:id — Update draft subscription lines & terms
 */
async function handleUpdateSubscription(id: number, event: any, currentUser: any, origin?: string) {
  if (currentUser.role !== 'admin' && currentUser.role !== 'staff') {
    return jsonError('Only Staff or Administrators can modify subscriptions.', 403, 'FORBIDDEN', {}, origin);
  }

  let body: any;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch {
    return jsonError('Invalid JSON request body.', 400, 'BAD_REQUEST', {}, origin);
  }

  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Fetch current subscription
    const [subRows]: any = await connection.execute(
      'SELECT id, subscription_number, status, customer_id, plan_id FROM subscriptions WHERE id = ? FOR UPDATE;',
      [id]
    );

    if (!subRows || subRows.length === 0) {
      await connection.rollback();
      return jsonError('Subscription not found.', 404, 'NOT_FOUND', {}, origin);
    }

    const currentSub = subRows[0];

    // Restrict editing based on current status
    if (currentSub.status !== 'draft' && currentSub.status !== 'quotation') {
      await connection.rollback();
      return jsonError(
        `Cannot modify lines or terms of a subscription in '${currentSub.status}' status. Confirmed and active subscription terms are immutable.`,
        400,
        'IMMUTABLE_STATUS',
        {},
        origin
      );
    }

    const { startDate, expiryDate, paymentTerms, autoRenew, notes, lines } = body;

    // Authoritative line calculations
    if (lines && Array.isArray(lines) && lines.length > 0) {
      let subtotalSum = 0;
      let taxSum = 0;
      const calculatedLines: any[] = [];

      for (const line of lines) {
        const quantity = parseInt(line.quantity || '1', 10);
        if (isNaN(quantity) || quantity < 1) {
          await connection.rollback();
          return jsonError('Line item quantity must be at least 1.', 400, 'BAD_REQUEST', {}, origin);
        }

        const [prodRows]: any = await connection.execute(
          'SELECT id, name, sales_price, is_active FROM products WHERE id = ?;',
          [line.productId]
        );
        if (!prodRows || prodRows.length === 0) {
          await connection.rollback();
          return jsonError(`Product ID ${line.productId} not found.`, 400, 'BAD_REQUEST', {}, origin);
        }
        const prod = prodRows[0];
        let unitPrice = Number(prod.sales_price);
        let variantDescription = '';

        if (line.variantId) {
          const [varRows]: any = await connection.execute(
            'SELECT id, attribute_name, attribute_value, price_adjustment FROM product_variants WHERE id = ? AND product_id = ?;',
            [line.variantId, prod.id]
          );
          if (varRows && varRows.length > 0) {
            unitPrice += Number(varRows[0].price_adjustment || 0);
            variantDescription = ` (${varRows[0].attribute_name}: ${varRows[0].attribute_value})`;
          }
        }

        let taxRate = 0;
        if (line.taxId) {
          const [taxRows]: any = await connection.execute(
            'SELECT rate_percentage FROM taxes WHERE id = ?;',
            [line.taxId]
          );
          if (taxRows && taxRows.length > 0) {
            taxRate = Number(taxRows[0].rate_percentage || 0);
          }
        }

        const lineSubtotal = Number((quantity * unitPrice).toFixed(2));
        const lineTax = Number((lineSubtotal * (taxRate / 100)).toFixed(2));
        const lineTotal = Number((lineSubtotal + lineTax).toFixed(2));

        subtotalSum += lineSubtotal;
        taxSum += lineTax;

        calculatedLines.push({
          productId: prod.id,
          variantId: line.variantId || null,
          description: line.description || `${prod.name}${variantDescription}`,
          quantity,
          unitPrice,
          taxId: line.taxId || null,
          taxRate,
          taxAmount: lineTax,
          subtotalAmount: lineSubtotal,
          totalAmount: lineTotal,
        });
      }

      const subtotalAmount = Number(subtotalSum.toFixed(2));
      const taxAmount = Number(taxSum.toFixed(2));
      const totalRecurringAmount = Number((subtotalAmount + taxAmount).toFixed(2));

      // Update lines
      await connection.execute('DELETE FROM subscription_lines WHERE subscription_id = ?;', [id]);
      for (const l of calculatedLines) {
        await connection.execute(
          `INSERT INTO subscription_lines (
            subscription_id, product_id, variant_id, description, quantity,
            unit_price, tax_id, tax_rate, tax_amount, subtotal_amount, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            id,
            l.productId,
            l.variantId,
            l.description,
            l.quantity,
            l.unitPrice,
            l.taxId,
            l.taxRate,
            l.taxAmount,
            l.subtotalAmount,
            l.totalAmount,
          ]
        );
      }

      // Update subscription header
      await connection.execute(
        `UPDATE subscriptions
         SET start_date = COALESCE(?, start_date),
             expiry_date = ?,
             payment_terms = COALESCE(?, payment_terms),
             auto_renew = COALESCE(?, auto_renew),
             notes = COALESCE(?, notes),
             subtotal_amount = ?,
             tax_amount = ?,
             total_recurring_amount = ?,
             updated_by = ?,
             updated_at = NOW()
         WHERE id = ?;`,
        [
          startDate || null,
          expiryDate || null,
          paymentTerms || null,
          autoRenew !== undefined ? Boolean(autoRenew) : null,
          notes || null,
          subtotalAmount,
          taxAmount,
          totalRecurringAmount,
          currentUser.id,
          id,
        ]
      );
    } else {
      // Header-only update
      await connection.execute(
        `UPDATE subscriptions
         SET start_date = COALESCE(?, start_date),
             expiry_date = ?,
             payment_terms = COALESCE(?, payment_terms),
             auto_renew = COALESCE(?, auto_renew),
             notes = COALESCE(?, notes),
             updated_by = ?,
             updated_at = NOW()
         WHERE id = ?;`,
        [
          startDate || null,
          expiryDate || null,
          paymentTerms || null,
          autoRenew !== undefined ? Boolean(autoRenew) : null,
          notes || null,
          currentUser.id,
          id,
        ]
      );
    }

    // Record audit event
    await connection.execute(
      `INSERT INTO subscription_history (
        subscription_id, from_status, to_status, actor_user_id, action, reason
      ) VALUES (?, ?, ?, ?, 'updated', 'Subscription line items or terms updated');`,
      [id, currentSub.status, currentSub.status, currentUser.id]
    );

    await connection.commit();

    return jsonSuccess({ id, message: 'Subscription updated successfully.' }, undefined, 200, {}, origin);
  } catch (err: any) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * POST /api/subscriptions/:id/transitions — Execute state machine transition
 */
async function handleTransition(
  id: number,
  event: any,
  currentUser: any,
  origin?: string,
  overrideTargetStatus?: SubscriptionStatus
) {
  let body: any = {};
  if (event.body) {
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch {
      // allow empty if overrideTargetStatus is provided
    }
  }

  const targetStatus: SubscriptionStatus = overrideTargetStatus || body.targetStatus;
  const reason: string = body.reason ? String(body.reason).trim() : '';

  if (!targetStatus) {
    return jsonError('targetStatus is required for state machine transition.', 400, 'BAD_REQUEST', {}, origin);
  }

  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Fetch current subscription and its plan
    const [subRows]: any = await connection.execute(
      `SELECT s.*, p.name AS plan_name, p.billing_interval, p.billing_interval_count,
              p.pause_allowed, p.early_close_policy, p.renewal_policy, p.auto_close
       FROM subscriptions s
       LEFT JOIN plans p ON s.plan_id = p.id
       WHERE s.id = ? FOR UPDATE;`,
      [id]
    );

    if (!subRows || subRows.length === 0) {
      await connection.rollback();
      return jsonError('Subscription not found.', 404, 'NOT_FOUND', {}, origin);
    }

    const sub = subRows[0];

    // Ownership check for customer
    if (currentUser.role === 'customer' && sub.customer_id !== currentUser.customerId) {
      await connection.rollback();
      return jsonError('Subscription not found.', 404, 'NOT_FOUND', {}, origin);
    }

    // Plan policy object
    const planPolicy = sub.plan_id
      ? {
          id: sub.plan_id,
          name: sub.plan_name,
          billingInterval: sub.billing_interval,
          billingIntervalCount: sub.billing_interval_count,
          pauseAllowed: Boolean(sub.pause_allowed),
          earlyClosePolicy: sub.early_close_policy,
          renewalPolicy: sub.renewal_policy,
          autoClose: Boolean(sub.auto_close),
        }
      : null;

    // Validate transition against state machine & plan rules
    const validation = validateTransition(
      sub.status,
      targetStatus,
      currentUser.role,
      planPolicy,
      sub.expiry_date
    );

    if (!validation.valid) {
      await connection.rollback();
      return jsonError(validation.error || 'Transition not allowed.', 400, 'INVALID_TRANSITION', {}, origin);
    }

    // Prepare timestamp updates
    let extraSql = '';
    const extraParams: any[] = [];

    if (targetStatus === 'paused') {
      extraSql += ', paused_at = NOW()';
    } else if (targetStatus === 'active' && sub.status === 'paused') {
      extraSql += ', resumed_at = NOW()';
    } else if (targetStatus === 'closed') {
      extraSql += ', closed_at = NOW(), cancellation_reason = ?';
      extraParams.push(reason || 'Closed via transition');
    }

    // 2. Update subscription status
    await connection.execute(
      `UPDATE subscriptions
       SET status = ?, updated_by = ?, updated_at = NOW() ${extraSql}
       WHERE id = ?;`,
      [targetStatus, currentUser.id, ...extraParams, id]
    );

    // 3. Record audit history
    const auditReason = [reason, validation.warningNote].filter(Boolean).join(' | ') || null;
    await connection.execute(
      `INSERT INTO subscription_history (
        subscription_id, from_status, to_status, actor_user_id, action, reason
      ) VALUES (?, ?, ?, ?, 'status_transition', ?);`,
      [id, sub.status, targetStatus, currentUser.id, auditReason]
    );

    await connection.commit();

    return jsonSuccess(
      {
        id,
        subscriptionNumber: sub.subscription_number,
        previousStatus: sub.status,
        newStatus: targetStatus,
        message: `Subscription successfully transitioned from '${sub.status}' to '${targetStatus}'.`,
        warningNote: validation.warningNote,
      },
      undefined,
      200,
      {},
      origin
    );
  } catch (err: any) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * POST /api/subscriptions/:id/renew — Renew an active subscription contract
 */
async function handleRenew(id: number, event: any, currentUser: any, origin?: string) {
  if (currentUser.role !== 'admin' && currentUser.role !== 'staff') {
    return jsonError('Only Staff or Administrators can execute subscription renewals.', 403, 'FORBIDDEN', {}, origin);
  }

  let body: any = {};
  if (event.body) {
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch {
      // allow default
    }
  }

  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [subRows]: any = await connection.execute(
      `SELECT s.*, p.billing_interval AS plan_interval, p.billing_interval_count AS plan_interval_count
       FROM subscriptions s
       LEFT JOIN plans p ON s.plan_id = p.id
       WHERE s.id = ? FOR UPDATE;`,
      [id]
    );

    if (!subRows || subRows.length === 0) {
      await connection.rollback();
      return jsonError('Subscription not found.', 404, 'NOT_FOUND', {}, origin);
    }

    const sub = subRows[0];

    if (sub.status !== 'active') {
      await connection.rollback();
      return jsonError(
        `Only active subscriptions can be renewed. Current status is '${sub.status}'.`,
        400,
        'INVALID_STATE',
        {},
        origin
      );
    }

    const interval = sub.billing_interval || sub.plan_interval || 'monthly';
    const intervalCount = sub.billing_interval_count || sub.plan_interval_count || 1;

    // Calculate new expiry date based on existing expiry or today
    const oldExpiry = sub.expiry_date ? new Date(sub.expiry_date).toISOString().split('T')[0] : null;
    const newExpiry = calculateRenewalExpiryDate(sub.expiry_date || new Date(), interval, intervalCount);
    const newNextBilling = calculateNextBillingDate(sub.next_billing_date || new Date(), interval, intervalCount);

    await connection.execute(
      `UPDATE subscriptions
       SET expiry_date = ?, next_billing_date = ?, updated_by = ?, updated_at = NOW()
       WHERE id = ?;`,
      [newExpiry, newNextBilling, currentUser.id, id]
    );

    const renewalReason = body.reason || `Contract renewed for another ${intervalCount} ${interval} cycle. Extended from ${oldExpiry || 'open'} to ${newExpiry}.`;

    await connection.execute(
      `INSERT INTO subscription_history (
        subscription_id, from_status, to_status, actor_user_id, action, reason, metadata
      ) VALUES (?, 'active', 'active', ?, 'renewed', ?, ?);`,
      [
        id,
        currentUser.id,
        renewalReason,
        JSON.stringify({ previousExpiryDate: oldExpiry, newExpiryDate: newExpiry, interval, intervalCount }),
      ]
    );

    await connection.commit();

    return jsonSuccess(
      {
        id,
        subscriptionNumber: sub.subscription_number,
        previousExpiryDate: oldExpiry,
        newExpiryDate: newExpiry,
        message: `Subscription ${sub.subscription_number} renewed successfully through ${newExpiry}.`,
      },
      undefined,
      200,
      {},
      origin
    );
  } catch (err: any) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
