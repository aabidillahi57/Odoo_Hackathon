import { executeQuery, isDbConfigured } from './_shared/db';
import { jsonSuccess, jsonError, handleOptions } from './_shared/response';
import { getAuthenticatedUser } from './_shared/auth';

function parseDiscountPath(path: string): { id?: number; action?: string } {
  const cleanPath = path.replace(/^(\/\.netlify\/functions|\/api)?\/discounts\/?/, '');
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
      'Database not configured. Please configure MySQL in .env.',
      503,
      'DB_NOT_CONFIGURED',
      {},
      origin
    );
  }

  const currentUser = await getAuthenticatedUser(event);
  if (!currentUser) {
    return jsonError('Authentication required to access discount rules.', 401, 'UNAUTHORIZED', {}, origin);
  }

  // Customers cannot browse or manage internal discount rules
  if (currentUser.role === 'customer') {
    return jsonError('Access denied. Customer accounts cannot manage or browse internal discount rules.', 403, 'FORBIDDEN', {}, origin);
  }

  const pathInfo = parseDiscountPath(event.path || '');
  const queryId = event.queryStringParameters?.id ? parseInt(event.queryStringParameters.id, 10) : undefined;
  const discountId = pathInfo.id || queryId;
  const action = pathInfo.action || event.queryStringParameters?.action;

  try {
    // -------------------------------------------------------------------------
    // 1. GET Requests: List or Detail
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'GET') {
      if (discountId) {
        return await handleGetDiscountDetail(discountId, origin);
      }
      return await handleListDiscounts(event, origin);
    }

    // -------------------------------------------------------------------------
    // 2. POST Requests: Create or Archive
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'POST') {
      if (currentUser.role !== 'admin') {
        return jsonError('Permission denied. Only Administrator accounts can manage discount rules.', 403, 'FORBIDDEN', {}, origin);
      }

      if (discountId && action === 'archive') {
        return await handleArchiveDiscount(discountId, origin);
      }

      if (!discountId) {
        return await handleCreateDiscount(event, origin);
      }

      return jsonError(`Unknown action '${action}' for discount rule.`, 400, 'INVALID_ACTION', {}, origin);
    }

    // -------------------------------------------------------------------------
    // 3. PUT / PATCH: Update Discount Rule
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'PUT' || event.httpMethod === 'PATCH') {
      if (currentUser.role !== 'admin') {
        return jsonError('Permission denied. Only Administrator accounts can modify discount rules.', 403, 'FORBIDDEN', {}, origin);
      }

      if (!discountId) {
        return jsonError('Discount ID is required in URL.', 400, 'MISSING_ID', {}, origin);
      }

      return await handleUpdateDiscount(discountId, event, origin);
    }

    // -------------------------------------------------------------------------
    // 4. DELETE: Soft-Archive
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'DELETE') {
      if (currentUser.role !== 'admin') {
        return jsonError('Permission denied. Only Administrator accounts can archive discount rules.', 403, 'FORBIDDEN', {}, origin);
      }

      if (!discountId) {
        return jsonError('Discount ID is required in URL.', 400, 'MISSING_ID', {}, origin);
      }

      return await handleArchiveDiscount(discountId, origin);
    }

    return jsonError(`HTTP method ${event.httpMethod} not allowed.`, 405, 'METHOD_NOT_ALLOWED', {}, origin);
  } catch (error: any) {
    console.error('Error in discounts function:', error);
    return jsonError('Internal server error managing discount rules.', 500, 'INTERNAL_SERVER_ERROR', { details: error.message }, origin);
  }
}

/**
 * Lists discounts with filters, search, and pagination
 */
async function handleListDiscounts(event: any, origin?: string) {
  const query = event.queryStringParameters || {};
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const whereConditions: string[] = [];
  const params: any[] = [];

  // Filter by status
  const status = query.status || 'all';
  if (status === 'active') {
    whereConditions.push('d.is_active = TRUE AND d.archived_at IS NULL');
  } else if (status === 'inactive') {
    whereConditions.push('d.is_active = FALSE AND d.archived_at IS NULL');
  } else if (status === 'archived') {
    whereConditions.push('d.archived_at IS NOT NULL');
  } else if (status !== 'all') {
    whereConditions.push('d.archived_at IS NULL');
  }

  // Filter by type
  if (query.type && (query.type === 'fixed' || query.type === 'percentage')) {
    whereConditions.push('d.discount_type = ?');
    params.push(query.type);
  }

  // Filter by scope
  if (query.applies_to && (query.applies_to === 'order' || query.applies_to === 'product')) {
    whereConditions.push('d.applies_to = ?');
    params.push(query.applies_to);
  }

  // Search by code, name, description
  if (query.search && query.search.trim()) {
    const term = `%${query.search.trim()}%`;
    whereConditions.push('(d.code LIKE ? OR d.name LIKE ? OR d.description LIKE ?)');
    params.push(term, term, term);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) AS total FROM discounts d ${whereClause};`;
  const countRows: any = await executeQuery(countSql, params);
  const total = countRows[0]?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const selectSql = `
    SELECT d.*, p.name AS applicable_product_name
    FROM discounts d
    LEFT JOIN products p ON d.applicable_product_id = p.id
    ${whereClause}
    ORDER BY d.id DESC
    LIMIT ? OFFSET ?;
  `;

  const rows: any = await executeQuery(selectSql, [...params, limit, offset]);

  const discounts = rows.map((r: any) => ({
    id: r.id,
    code: r.code,
    name: r.name || r.code,
    description: r.description || '',
    discountType: r.discount_type,
    value: Number(r.value),
    minPurchaseAmount: Number(r.min_purchase_amount),
    minQuantity: Number(r.min_quantity),
    startDate: r.start_date ? (r.start_date.toISOString?.().split('T')[0] || String(r.start_date).split('T')[0]) : null,
    endDate: r.end_date ? (r.end_date.toISOString?.().split('T')[0] || String(r.end_date).split('T')[0]) : null,
    maxUses: r.max_uses !== null ? Number(r.max_uses) : null,
    usedCount: Number(r.used_count),
    remainingUses: r.max_uses !== null ? Math.max(0, Number(r.max_uses) - Number(r.used_count)) : null,
    appliesTo: r.applies_to,
    applicableProductId: r.applicable_product_id,
    applicableProductName: r.applicable_product_name || null,
    isActive: Boolean(r.is_active),
    isArchived: r.archived_at !== null,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return jsonSuccess({ discounts, total, page, limit, totalPages }, undefined, 200, {}, origin);
}

/**
 * Returns single discount rule with usage history stats
 */
async function handleGetDiscountDetail(discountId: number, origin?: string) {
  const rows: any = await executeQuery(
    `SELECT d.*, p.name AS applicable_product_name
     FROM discounts d
     LEFT JOIN products p ON d.applicable_product_id = p.id
     WHERE d.id = ?;`,
    [discountId]
  );

  if (!rows || rows.length === 0) {
    return jsonError(`Discount rule #${discountId} not found.`, 404, 'DISCOUNT_NOT_FOUND', {}, origin);
  }

  const r = rows[0];

  // Fetch recent usages
  const usageRows: any = await executeQuery(
    `SELECT du.id, du.amount_applied, du.status, du.used_at,
            c.name AS customer_name, i.invoice_number, s.subscription_number
     FROM discount_usages du
     JOIN customers c ON du.customer_id = c.id
     LEFT JOIN invoices i ON du.invoice_id = i.id
     LEFT JOIN subscriptions s ON du.subscription_id = s.id
     WHERE du.discount_id = ?
     ORDER BY du.used_at DESC
     LIMIT 20;`,
    [discountId]
  );

  const usages = usageRows.map((u: any) => ({
    id: u.id,
    amountApplied: Number(u.amount_applied),
    status: u.status,
    customerName: u.customer_name,
    invoiceNumber: u.invoice_number || null,
    subscriptionNumber: u.subscription_number || null,
    usedAt: u.used_at,
  }));

  const discount = {
    id: r.id,
    code: r.code,
    name: r.name || r.code,
    description: r.description || '',
    discountType: r.discount_type,
    value: Number(r.value),
    minPurchaseAmount: Number(r.min_purchase_amount),
    minQuantity: Number(r.min_quantity),
    startDate: r.start_date ? (r.start_date.toISOString?.().split('T')[0] || String(r.start_date).split('T')[0]) : null,
    endDate: r.end_date ? (r.end_date.toISOString?.().split('T')[0] || String(r.end_date).split('T')[0]) : null,
    maxUses: r.max_uses !== null ? Number(r.max_uses) : null,
    usedCount: Number(r.used_count),
    remainingUses: r.max_uses !== null ? Math.max(0, Number(r.max_uses) - Number(r.used_count)) : null,
    appliesTo: r.applies_to,
    applicableProductId: r.applicable_product_id,
    applicableProductName: r.applicable_product_name || null,
    isActive: Boolean(r.is_active),
    isArchived: r.archived_at !== null,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    usages,
  };

  return jsonSuccess({ discount }, undefined, 200, {}, origin);
}

/**
 * Creates a new discount rule
 */
async function handleCreateDiscount(event: any, origin?: string) {
  let body: any = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonError('Invalid JSON request body.', 400, 'INVALID_JSON', {}, origin);
  }

  const code = String(body.code || '').trim().toUpperCase();
  if (!code) {
    return jsonError('Discount promo code is required.', 400, 'VALIDATION_ERROR', { field: 'code' }, origin);
  }

  // Check code uniqueness
  const existing: any = await executeQuery('SELECT id FROM discounts WHERE code = ?;', [code]);
  if (existing && existing.length > 0) {
    return jsonError(`Discount code '${code}' already exists. Please choose a unique code.`, 409, 'DUPLICATE_CODE', { field: 'code' }, origin);
  }

  const name = body.name ? String(body.name).trim() : code;
  const description = body.description ? String(body.description).trim().slice(0, 255) : null;

  const discountType = body.discountType;
  if (discountType !== 'fixed' && discountType !== 'percentage') {
    return jsonError("Discount type must be either 'fixed' or 'percentage'.", 400, 'VALIDATION_ERROR', { field: 'discountType' }, origin);
  }

  const value = Number(body.value);
  if (isNaN(value) || value <= 0) {
    return jsonError('Discount value must be a positive number greater than zero.', 400, 'VALIDATION_ERROR', { field: 'value' }, origin);
  }
  if (discountType === 'percentage' && value > 100) {
    return jsonError('Percentage discount value cannot exceed 100.00%.', 400, 'VALIDATION_ERROR', { field: 'value' }, origin);
  }

  const minPurchaseAmount = Math.max(Number(body.minPurchaseAmount) || 0, 0);
  const minQuantity = Math.max(parseInt(body.minQuantity, 10) || 1, 1);
  const startDate = body.startDate ? String(body.startDate).trim() : null;
  const endDate = body.endDate ? String(body.endDate).trim() : null;
  const maxUses = body.maxUses ? Math.max(parseInt(body.maxUses, 10) || 1, 1) : null;
  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;

  const appliesTo = body.appliesTo === 'product' ? 'product' : 'order';
  let applicableProductId: number | null = null;

  if (appliesTo === 'product') {
    applicableProductId = parseInt(body.applicableProductId, 10);
    if (!applicableProductId || isNaN(applicableProductId)) {
      return jsonError('A valid product must be selected for product-scoped discounts.', 400, 'VALIDATION_ERROR', { field: 'applicableProductId' }, origin);
    }
    const prodRows: any = await executeQuery('SELECT id FROM products WHERE id = ?;', [applicableProductId]);
    if (!prodRows || prodRows.length === 0) {
      return jsonError(`Referenced product #${applicableProductId} does not exist.`, 404, 'PRODUCT_NOT_FOUND', { field: 'applicableProductId' }, origin);
    }
  }

  const result: any = await executeQuery(
    `INSERT INTO discounts (
      code, name, description, discount_type, value, min_purchase_amount,
      min_quantity, start_date, end_date, max_uses, used_count, applies_to,
      applicable_product_id, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, NOW(), NOW());`,
    [
      code,
      name,
      description,
      discountType,
      value.toFixed(2),
      minPurchaseAmount.toFixed(2),
      minQuantity,
      startDate,
      endDate,
      maxUses,
      appliesTo,
      applicableProductId,
      isActive,
    ]
  );

  return jsonSuccess(
    {
      message: `Discount rule '${code}' created successfully.`,
      discountId: result.insertId,
      code,
      name,
      discountType,
      value,
    },
    undefined,
    201,
    {},
    origin
  );
}

/**
 * Updates an existing discount rule
 */
async function handleUpdateDiscount(discountId: number, event: any, origin?: string) {
  const existingRows: any = await executeQuery('SELECT * FROM discounts WHERE id = ?;', [discountId]);
  if (!existingRows || existingRows.length === 0) {
    return jsonError(`Discount rule #${discountId} not found.`, 404, 'DISCOUNT_NOT_FOUND', {}, origin);
  }
  const existing = existingRows[0];

  let body: any = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonError('Invalid JSON request body.', 400, 'INVALID_JSON', {}, origin);
  }

  const name = body.name !== undefined ? String(body.name).trim() : existing.name;
  const description = body.description !== undefined ? String(body.description).trim().slice(0, 255) : existing.description;

  let discountType = existing.discount_type;
  if (body.discountType !== undefined) {
    if (body.discountType !== 'fixed' && body.discountType !== 'percentage') {
      return jsonError("Discount type must be 'fixed' or 'percentage'.", 400, 'VALIDATION_ERROR', { field: 'discountType' }, origin);
    }
    discountType = body.discountType;
  }

  let value = Number(existing.value);
  if (body.value !== undefined) {
    value = Number(body.value);
    if (isNaN(value) || value <= 0) {
      return jsonError('Discount value must be a positive number greater than zero.', 400, 'VALIDATION_ERROR', { field: 'value' }, origin);
    }
    if (discountType === 'percentage' && value > 100) {
      return jsonError('Percentage discount value cannot exceed 100.00%.', 400, 'VALIDATION_ERROR', { field: 'value' }, origin);
    }
  }

  const minPurchaseAmount = body.minPurchaseAmount !== undefined ? Math.max(Number(body.minPurchaseAmount) || 0, 0) : Number(existing.min_purchase_amount);
  const minQuantity = body.minQuantity !== undefined ? Math.max(parseInt(body.minQuantity, 10) || 1, 1) : Number(existing.min_quantity);
  const startDate = body.startDate !== undefined ? (body.startDate ? String(body.startDate).trim() : null) : existing.start_date;
  const endDate = body.endDate !== undefined ? (body.endDate ? String(body.endDate).trim() : null) : existing.end_date;
  const maxUses = body.maxUses !== undefined ? (body.maxUses ? Math.max(parseInt(body.maxUses, 10) || 1, 1) : null) : existing.max_uses;
  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : Boolean(existing.is_active);

  const appliesTo = body.appliesTo !== undefined ? (body.appliesTo === 'product' ? 'product' : 'order') : existing.applies_to;
  let applicableProductId = existing.applicable_product_id;

  if (appliesTo === 'product' && body.applicableProductId !== undefined) {
    applicableProductId = parseInt(body.applicableProductId, 10);
    if (!applicableProductId || isNaN(applicableProductId)) {
      return jsonError('Valid product must be selected for product scope.', 400, 'VALIDATION_ERROR', { field: 'applicableProductId' }, origin);
    }
    const prodRows: any = await executeQuery('SELECT id FROM products WHERE id = ?;', [applicableProductId]);
    if (!prodRows || prodRows.length === 0) {
      return jsonError(`Referenced product #${applicableProductId} does not exist.`, 404, 'PRODUCT_NOT_FOUND', { field: 'applicableProductId' }, origin);
    }
  } else if (appliesTo === 'order') {
    applicableProductId = null;
  }

  await executeQuery(
    `UPDATE discounts SET
      name = ?, description = ?, discount_type = ?, value = ?,
      min_purchase_amount = ?, min_quantity = ?, start_date = ?, end_date = ?,
      max_uses = ?, applies_to = ?, applicable_product_id = ?, is_active = ?,
      updated_at = NOW()
     WHERE id = ?;`,
    [
      name,
      description,
      discountType,
      value.toFixed(2),
      minPurchaseAmount.toFixed(2),
      minQuantity,
      startDate,
      endDate,
      maxUses,
      appliesTo,
      applicableProductId,
      isActive,
      discountId,
    ]
  );

  return jsonSuccess({ message: `Discount rule '${existing.code}' updated successfully.`, discountId }, undefined, 200, {}, origin);
}

/**
 * Soft-archives a discount rule without deleting historical usage
 */
async function handleArchiveDiscount(discountId: number, origin?: string) {
  const rows: any = await executeQuery('SELECT id, code, archived_at FROM discounts WHERE id = ?;', [discountId]);
  if (!rows || rows.length === 0) {
    return jsonError(`Discount rule #${discountId} not found.`, 404, 'DISCOUNT_NOT_FOUND', {}, origin);
  }

  const existing = rows[0];
  if (existing.archived_at !== null) {
    return jsonSuccess({ message: `Discount rule '${existing.code}' is already archived.`, discountId }, undefined, 200, {}, origin);
  }

  await executeQuery(
    'UPDATE discounts SET is_active = FALSE, archived_at = NOW(), updated_at = NOW() WHERE id = ?;',
    [discountId]
  );

  return jsonSuccess({ message: `Discount rule '${existing.code}' archived successfully.`, discountId }, undefined, 200, {}, origin);
}
