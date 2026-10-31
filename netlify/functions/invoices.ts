import { getDbPool, isDbConfigured, executeQuery } from './_shared/db';
import { jsonSuccess, jsonError, handleOptions } from './_shared/response';
import { getAuthenticatedUser } from './_shared/auth';
import { generateInvoiceNumber } from './_shared/sequence';
import { sendInvoiceEmail } from './_shared/brevo';
import {
  evaluateBestDiscount,
  reserveDiscountUsage,
  redeemDiscountUsage,
  releaseDiscountUsage,
} from './_shared/discount-engine';

function parseInvoicePath(path: string): { id?: number; action?: string } {
  const cleanPath = path.replace(/^(\/\.netlify\/functions|\/api)?\/invoices\/?/, '');
  const segments = cleanPath.split('/').filter(Boolean);
  if (segments.length === 0) return {};
  const id = parseInt(segments[0], 10);
  if (!isNaN(id)) {
    return { id, action: segments[1] };
  }
  return {};
}

function calculateDueDate(issueDateStr: string, paymentTerms: string): string {
  const parts = issueDateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const issueDate = new Date(Date.UTC(year, month, day));

  let daysToAdd = 0;
  if (/Net\s*30/i.test(paymentTerms)) {
    daysToAdd = 30;
  } else if (/Net\s*15/i.test(paymentTerms)) {
    daysToAdd = 15;
  } else if (/Net\s*60/i.test(paymentTerms)) {
    daysToAdd = 60;
  } else if (/Net\s*45/i.test(paymentTerms)) {
    daysToAdd = 45;
  }

  const dueDate = new Date(issueDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  return dueDate.toISOString().split('T')[0];
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
    return jsonError('Authentication required to access invoices.', 401, 'UNAUTHORIZED', {}, origin);
  }

  const pathInfo = parseInvoicePath(event.path || '');
  const queryId = event.queryStringParameters?.id ? parseInt(event.queryStringParameters.id, 10) : undefined;
  const invoiceId = pathInfo.id || queryId;
  const action = pathInfo.action || event.queryStringParameters?.action;

  try {
    // -------------------------------------------------------------------------
    // 1. GET Requests: List or Detail
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'GET') {
      if (invoiceId) {
        return await handleGetInvoiceDetail(invoiceId, currentUser, origin);
      }
      return await handleListInvoices(event, currentUser, origin);
    }

    // -------------------------------------------------------------------------
    // 2. POST Actions: confirm, cancel, send, or manual create
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'POST') {
      if (invoiceId && action === 'confirm') {
        return await handleConfirmInvoice(invoiceId, currentUser, origin);
      }
      if (invoiceId && action === 'cancel') {
        return await handleCancelInvoice(invoiceId, event, currentUser, origin);
      }
      if (invoiceId && action === 'send') {
        return await handleSendInvoice(invoiceId, currentUser, origin);
      }
      if (!invoiceId) {
        return await handleCreateManualInvoice(event, currentUser, origin);
      }

      return jsonError(`Unknown action '${action}' for invoice ${invoiceId}.`, 400, 'INVALID_ACTION', {}, origin);
    }

    return jsonError(`HTTP method ${event.httpMethod} not allowed.`, 405, 'METHOD_NOT_ALLOWED', {}, origin);
  } catch (error: any) {
    console.error('Unhandled error in invoices function:', error);
    return jsonError('Internal server error processing invoice request.', 500, 'INTERNAL_SERVER_ERROR', { details: error.message }, origin);
  }
}

/**
 * Lists invoices with search, status filters, overdue filters, and role scoping
 */
async function handleListInvoices(event: any, currentUser: any, origin?: string) {
  const query = event.queryStringParameters || {};
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const whereConditions: string[] = [];
  const params: any[] = [];

  // Scoping for Customers: STRICT IDOR PROTECTION
  if (currentUser.role === 'customer') {
    if (!currentUser.customerId) {
      return jsonSuccess({ invoices: [], total: 0, page, limit, totalPages: 0 }, undefined, 200, {}, origin);
    }
    whereConditions.push('i.customer_id = ?');
    params.push(currentUser.customerId);
  } else if (query.customer_id) {
    whereConditions.push('i.customer_id = ?');
    params.push(parseInt(query.customer_id, 10));
  }

  // Filter by Subscription
  if (query.subscription_id) {
    whereConditions.push('i.subscription_id = ?');
    params.push(parseInt(query.subscription_id, 10));
  }

  // Filter by Status
  if (query.status && query.status !== 'all') {
    whereConditions.push('i.status = ?');
    params.push(query.status);
  }

  // Filter by Overdue flag
  const todayStr = new Date().toISOString().split('T')[0];
  if (query.overdue === 'true') {
    whereConditions.push("i.status != 'paid' AND i.status != 'cancelled' AND i.balance_due > 0 AND i.due_date < ?");
    params.push(todayStr);
  }

  // Search by invoice number, customer name, company name
  if (query.search && query.search.trim()) {
    const term = `%${query.search.trim()}%`;
    whereConditions.push('(i.invoice_number LIKE ? OR c.name LIKE ? OR c.company_name LIKE ?)');
    params.push(term, term, term);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Count total matching
  const countSql = `
    SELECT COUNT(*) AS total
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    ${whereClause};
  `;
  const countRows: any = await executeQuery(countSql, params);
  const total = countRows[0]?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Fetch paginated records
  const selectSql = `
    SELECT 
      i.id, i.invoice_number, i.subscription_id, i.customer_id, i.status,
      i.billing_period_start, i.billing_period_end, i.issue_date, i.due_date,
      i.payment_terms, i.subtotal_amount, i.tax_amount, i.discount_amount,
      i.total_amount, i.amount_paid, i.balance_due, i.notes,
      i.sent_at, i.delivery_status, i.delivery_error, i.cancellation_reason,
      i.confirmed_at, i.cancelled_at, i.created_at, i.updated_at,
      c.name AS customer_name, c.company_name, c.email AS customer_email,
      s.subscription_number
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN subscriptions s ON i.subscription_id = s.id
    ${whereClause}
    ORDER BY i.issue_date DESC, i.id DESC
    LIMIT ? OFFSET ?;
  `;

  const rows: any = await executeQuery(selectSql, [...params, limit, offset]);

  const invoices = rows.map((r: any) => {
    const dueDateStr = r.due_date ? (r.due_date.toISOString?.().split('T')[0] || String(r.due_date).split('T')[0]) : '';
    const isOverdue = r.status !== 'paid' && r.status !== 'cancelled' && Number(r.balance_due) > 0 && dueDateStr < todayStr;

    return {
      id: r.id,
      invoiceNumber: r.invoice_number,
      subscriptionId: r.subscription_id,
      subscriptionNumber: r.subscription_number || null,
      customerId: r.customer_id,
      customerName: r.customer_name,
      companyName: r.company_name || null,
      customerEmail: r.customer_email,
      status: r.status,
      isOverdue,
      billingPeriodStart: r.billing_period_start ? (r.billing_period_start.toISOString?.().split('T')[0] || String(r.billing_period_start).split('T')[0]) : null,
      billingPeriodEnd: r.billing_period_end ? (r.billing_period_end.toISOString?.().split('T')[0] || String(r.billing_period_end).split('T')[0]) : null,
      issueDate: r.issue_date ? (r.issue_date.toISOString?.().split('T')[0] || String(r.issue_date).split('T')[0]) : '',
      dueDate: dueDateStr,
      paymentTerms: r.payment_terms,
      subtotalAmount: Number(r.subtotal_amount),
      taxAmount: Number(r.tax_amount),
      discountAmount: Number(r.discount_amount),
      totalAmount: Number(r.total_amount),
      amountPaid: Number(r.amount_paid),
      balanceDue: Number(r.balance_due),
      notes: r.notes || '',
      sentAt: r.sent_at,
      deliveryStatus: r.delivery_status || null,
      deliveryError: r.delivery_error || null,
      cancellationReason: r.cancellation_reason || null,
      confirmedAt: r.confirmed_at,
      cancelledAt: r.cancelled_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });

  return jsonSuccess({ invoices, total, page, limit, totalPages }, undefined, 200, {}, origin);
}

/**
 * Returns single invoice with lines and customer info; enforces IDOR ownership
 */
async function handleGetInvoiceDetail(invoiceId: number, currentUser: any, origin?: string) {
  const invRows: any = await executeQuery(
    `SELECT 
      i.*,
      c.name AS customer_name, c.company_name, c.email AS customer_email,
      c.phone AS customer_phone, c.address_line1, c.address_line2, c.city, c.state, c.postal_code, c.country,
      s.subscription_number
     FROM invoices i
     JOIN customers c ON i.customer_id = c.id
     LEFT JOIN subscriptions s ON i.subscription_id = s.id
     WHERE i.id = ?;`,
    [invoiceId]
  );

  if (!invRows || invRows.length === 0) {
    return jsonError(`Invoice #${invoiceId} not found.`, 404, 'INVOICE_NOT_FOUND', {}, origin);
  }

  const inv = invRows[0];

  // Customer IDOR permission check
  if (currentUser.role === 'customer') {
    if (!currentUser.customerId || inv.customer_id !== currentUser.customerId) {
      return jsonError('Access denied. You can only view invoices issued to your account.', 403, 'FORBIDDEN', {}, origin);
    }
  }

  // Fetch line items
  const lineRows: any = await executeQuery(
    `SELECT 
      il.id, il.product_id, il.variant_id, il.description, il.quantity,
      il.unit_price, il.tax_id, il.tax_name, il.tax_rate, il.tax_amount,
      il.discount_amount, il.subtotal_amount, il.total_amount,
      p.name AS product_name, pv.attribute_value AS variant_name
     FROM invoice_lines il
     JOIN products p ON il.product_id = p.id
     LEFT JOIN product_variants pv ON il.variant_id = pv.id
     WHERE il.invoice_id = ?
     ORDER BY il.id ASC;`,
    [invoiceId]
  );

  const lines = lineRows.map((l: any) => ({
    id: l.id,
    productId: l.product_id,
    productName: l.product_name,
    variantId: l.variant_id,
    variantName: l.variant_name || null,
    description: l.description,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unit_price),
    taxId: l.tax_id,
    taxName: l.tax_name || 'Standard Tax',
    taxRate: Number(l.tax_rate),
    taxAmount: Number(l.tax_amount),
    discountAmount: Number(l.discount_amount),
    subtotalAmount: Number(l.subtotal_amount),
    totalAmount: Number(l.total_amount),
  }));

  // Fetch recorded payments for this invoice
  const paymentRows: any = await executeQuery(
    `SELECT p.id, p.payment_number, p.amount, p.payment_method, p.payment_date, p.status,
            p.transaction_reference, p.notes, p.created_at, p.voided_at, p.void_reason,
            u.first_name AS recorded_by_name
     FROM payments p
     LEFT JOIN users u ON p.recorded_by = u.id
     WHERE p.invoice_id = ?
     ORDER BY p.payment_date DESC, p.id DESC;`,
    [invoiceId]
  );

  const payments = paymentRows.map((p: any) => ({
    id: p.id,
    paymentNumber: p.payment_number,
    amount: Number(p.amount),
    paymentMethod: p.payment_method,
    paymentDate: p.payment_date ? (p.payment_date.toISOString?.().split('T')[0] || String(p.payment_date).split('T')[0]) : '',
    status: p.status,
    transactionReference: p.transaction_reference || null,
    notes: p.notes || '',
    recordedByName: p.recorded_by_name || null,
    voidedAt: p.voided_at || null,
    voidReason: p.void_reason || null,
    createdAt: p.created_at,
  }));

  // Fetch applied discount usage if any
  const discountRows: any = await executeQuery(
    `SELECT du.id, du.amount_applied, du.status, d.code, d.name, d.discount_type, d.value
     FROM discount_usages du
     JOIN discounts d ON du.discount_id = d.id
     WHERE du.invoice_id = ? AND du.status IN ('reserved', 'redeemed');`,
    [invoiceId]
  );
  const discountUsage = discountRows.length > 0 ? {
    id: discountRows[0].id,
    amountApplied: Number(discountRows[0].amount_applied),
    status: discountRows[0].status,
    code: discountRows[0].code,
    name: discountRows[0].name || discountRows[0].code,
    discountType: discountRows[0].discount_type,
    value: Number(discountRows[0].value),
  } : null;

  const todayStr = new Date().toISOString().split('T')[0];
  const dueDateStr = inv.due_date ? (inv.due_date.toISOString?.().split('T')[0] || String(inv.due_date).split('T')[0]) : '';
  const isOverdue = inv.status !== 'paid' && inv.status !== 'cancelled' && Number(inv.balance_due) > 0 && dueDateStr < todayStr;

  const invoice = {
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    subscriptionId: inv.subscription_id,
    subscriptionNumber: inv.subscription_number || null,
    customerId: inv.customer_id,
    customer: {
      id: inv.customer_id,
      name: inv.customer_name,
      companyName: inv.company_name || null,
      email: inv.customer_email,
      phone: inv.customer_phone || null,
      addressLine1: inv.address_line1 || null,
      addressLine2: inv.address_line2 || null,
      city: inv.city || null,
      state: inv.state || null,
      postalCode: inv.postal_code || null,
      country: inv.country || null,
    },
    status: inv.status,
    isOverdue,
    billingPeriodStart: inv.billing_period_start ? (inv.billing_period_start.toISOString?.().split('T')[0] || String(inv.billing_period_start).split('T')[0]) : null,
    billingPeriodEnd: inv.billing_period_end ? (inv.billing_period_end.toISOString?.().split('T')[0] || String(inv.billing_period_end).split('T')[0]) : null,
    issueDate: inv.issue_date ? (inv.issue_date.toISOString?.().split('T')[0] || String(inv.issue_date).split('T')[0]) : '',
    dueDate: dueDateStr,
    paymentTerms: inv.payment_terms,
    subtotalAmount: Number(inv.subtotal_amount),
    taxAmount: Number(inv.tax_amount),
    discountAmount: Number(inv.discount_amount),
    totalAmount: Number(inv.total_amount),
    amountPaid: Number(inv.amount_paid),
    balanceDue: Number(inv.balance_due),
    notes: inv.notes || '',
    sentAt: inv.sent_at,
    deliveryStatus: inv.delivery_status || null,
    deliveryError: inv.delivery_error || null,
    cancellationReason: inv.cancellation_reason || null,
    confirmedAt: inv.confirmed_at,
    cancelledAt: inv.cancelled_at,
    createdAt: inv.created_at,
    updatedAt: inv.updated_at,
    lines,
    payments,
    discountUsage,
  };

  return jsonSuccess({ invoice }, undefined, 200, {}, origin);
}

/**
 * Transitions a draft invoice to confirmed
 */
async function handleConfirmInvoice(invoiceId: number, currentUser: any, origin?: string) {
  if (currentUser.role === 'customer') {
    return jsonError('Permission denied. Customers cannot confirm invoices.', 403, 'FORBIDDEN', {}, origin);
  }

  const pool = getDbPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows]: any = await conn.query('SELECT id, status, invoice_number FROM invoices WHERE id = ? FOR UPDATE;', [invoiceId]);
    if (!rows || rows.length === 0) {
      await conn.rollback();
      return jsonError(`Invoice #${invoiceId} not found.`, 404, 'INVOICE_NOT_FOUND', {}, origin);
    }

    const inv = rows[0];
    if (inv.status !== 'draft') {
      await conn.rollback();
      return jsonError(`Cannot confirm invoice ${inv.invoice_number}; it is currently in '${inv.status}' status.`, 400, 'INVALID_TRANSITION', {}, origin);
    }

    await conn.query(
      "UPDATE invoices SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW() WHERE id = ?;",
      [invoiceId]
    );

    // Redeem reserved discount usage
    await redeemDiscountUsage(conn, invoiceId);

    await conn.commit();
    return jsonSuccess({ message: `Invoice ${inv.invoice_number} has been confirmed.`, status: 'confirmed' }, undefined, 200, {}, origin);
  } catch (err: any) {
    await conn.rollback();
    console.error('Error confirming invoice:', err);
    return jsonError('Failed to confirm invoice.', 500, 'CONFIRMATION_FAILED', { details: err.message }, origin);
  } finally {
    conn.release();
  }
}

/**
 * Cancels an invoice with a required cancellation reason
 */
async function handleCancelInvoice(invoiceId: number, event: any, currentUser: any, origin?: string) {
  if (currentUser.role === 'customer') {
    return jsonError('Permission denied. Customers cannot cancel invoices.', 403, 'FORBIDDEN', {}, origin);
  }

  let body: any = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    // Body optional
  }

  const reason = String(body.reason || '').trim();
  if (!reason) {
    return jsonError('A cancellation reason is required to cancel an issued invoice.', 400, 'VALIDATION_ERROR', { field: 'reason' }, origin);
  }

  const pool = getDbPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows]: any = await conn.query('SELECT id, status, invoice_number, amount_paid FROM invoices WHERE id = ? FOR UPDATE;', [invoiceId]);
    if (!rows || rows.length === 0) {
      await conn.rollback();
      return jsonError(`Invoice #${invoiceId} not found.`, 404, 'INVOICE_NOT_FOUND', {}, origin);
    }

    const inv = rows[0];
    if (inv.status === 'cancelled') {
      await conn.rollback();
      return jsonError(`Invoice ${inv.invoice_number} is already cancelled.`, 400, 'ALREADY_CANCELLED', {}, origin);
    }

    if (Number(inv.amount_paid) > 0) {
      await conn.rollback();
      return jsonError(
        `Invoice ${inv.invoice_number} cannot be cancelled because payments totaling $${Number(inv.amount_paid).toFixed(2)} have already been collected against it.`,
        400,
        'HAS_PAYMENTS',
        {},
        origin
      );
    }

    await conn.query(
      "UPDATE invoices SET status = 'cancelled', cancellation_reason = ?, cancelled_at = NOW(), updated_at = NOW() WHERE id = ?;",
      [reason, invoiceId]
    );

    // Release any reserved or redeemed discount usage and restore rule quota
    await releaseDiscountUsage(conn, invoiceId);

    await conn.commit();
    return jsonSuccess({ message: `Invoice ${inv.invoice_number} cancelled successfully.`, status: 'cancelled' }, undefined, 200, {}, origin);
  } catch (err: any) {
    await conn.rollback();
    console.error('Error cancelling invoice:', err);
    return jsonError('Failed to cancel invoice.', 500, 'CANCELLATION_FAILED', { details: err.message }, origin);
  } finally {
    conn.release();
  }
}

/**
 * Sends the invoice email to customer via Brevo
 */
async function handleSendInvoice(invoiceId: number, currentUser: any, origin?: string) {
  if (currentUser.role === 'customer') {
    return jsonError('Permission denied. Customers cannot trigger invoice email dispatches.', 403, 'FORBIDDEN', {}, origin);
  }

  const invRows: any = await executeQuery(
    `SELECT i.*, c.name AS customer_name, c.email AS customer_email
     FROM invoices i
     JOIN customers c ON i.customer_id = c.id
     WHERE i.id = ?;`,
    [invoiceId]
  );

  if (!invRows || invRows.length === 0) {
    return jsonError(`Invoice #${invoiceId} not found.`, 404, 'INVOICE_NOT_FOUND', {}, origin);
  }

  const inv = invRows[0];
  if (inv.status === 'cancelled') {
    return jsonError(`Cannot send email for cancelled invoice ${inv.invoice_number}.`, 400, 'INVOICE_CANCELLED', {}, origin);
  }

  // Fetch lines for email table
  const lineRows: any = await executeQuery(
    'SELECT description, quantity, unit_price, total_amount FROM invoice_lines WHERE invoice_id = ?;',
    [invoiceId]
  );

  const emailLines = lineRows.map((l: any) => ({
    description: l.description,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unit_price),
    totalAmount: Number(l.total_amount),
  }));

  const issueDateStr = inv.issue_date ? (inv.issue_date.toISOString?.().split('T')[0] || String(inv.issue_date).split('T')[0]) : '';
  const dueDateStr = inv.due_date ? (inv.due_date.toISOString?.().split('T')[0] || String(inv.due_date).split('T')[0]) : '';

  const emailResult = await sendInvoiceEmail({
    recipientEmail: inv.customer_email,
    recipientName: inv.customer_name,
    invoiceNumber: inv.invoice_number,
    issueDate: issueDateStr,
    dueDate: dueDateStr,
    paymentTerms: inv.payment_terms,
    subtotalAmount: inv.subtotal_amount,
    taxAmount: inv.tax_amount,
    totalAmount: inv.total_amount,
    balanceDue: inv.balance_due,
    lines: emailLines,
  });

  const deliveryStatus = emailResult.success ? 'sent' : 'failed';
  const deliveryError = emailResult.error || null;

  await executeQuery(
    `UPDATE invoices 
     SET sent_at = NOW(), delivery_status = ?, delivery_error = ?, updated_at = NOW() 
     WHERE id = ?;`,
    [deliveryStatus, deliveryError, invoiceId]
  );

  return jsonSuccess(
    {
      message: emailResult.success
        ? `Invoice ${inv.invoice_number} sent to ${inv.customer_email}.`
        : `Failed to deliver email: ${emailResult.error}`,
      deliveryStatus,
      devMode: emailResult.devMode || false,
      error: emailResult.error || null,
    },
    undefined,
    200,
    {},
    origin
  );
}

/**
 * Creates a manual invoice with line items
 */
async function handleCreateManualInvoice(event: any, currentUser: any, origin?: string) {
  if (currentUser.role === 'customer') {
    return jsonError('Permission denied. Customers cannot create invoices.', 403, 'FORBIDDEN', {}, origin);
  }

  let body: any = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonError('Invalid JSON request body.', 400, 'INVALID_JSON', {}, origin);
  }

  const customerId = parseInt(body.customerId, 10);
  if (!customerId || isNaN(customerId)) {
    return jsonError('Valid customer ID is required.', 400, 'VALIDATION_ERROR', { field: 'customerId' }, origin);
  }

  const pool = getDbPool();
  const [custRows]: any = await pool.query('SELECT id, name FROM customers WHERE id = ?;', [customerId]);
  if (!custRows || custRows.length === 0) {
    return jsonError(`Customer #${customerId} does not exist.`, 404, 'CUSTOMER_NOT_FOUND', {}, origin);
  }

  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0) {
    return jsonError('Invoice must contain at least one line item.', 400, 'VALIDATION_ERROR', { field: 'lines' }, origin);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const issueDate = body.issueDate ? String(body.issueDate).trim() : todayStr;
  const paymentTerms = body.paymentTerms ? String(body.paymentTerms).trim() : 'Immediate Payment';
  const dueDate = body.dueDate ? String(body.dueDate).trim() : calculateDueDate(issueDate, paymentTerms);
  const subscriptionId = body.subscriptionId ? parseInt(body.subscriptionId, 10) : null;
  const notes = body.notes ? String(body.notes).trim() : null;
  const status = body.status === 'confirmed' ? 'confirmed' : 'draft';

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const invoiceNumber = await generateInvoiceNumber(connection);

    // Evaluate discounts deterministically with pre-tax application
    const discountEval = await evaluateBestDiscount(connection, {
      customerId,
      subscriptionId,
      lines: lines.map((item: any) => {
        const productId = parseInt(item.productId, 10);
        if (!productId || isNaN(productId)) {
          throw new Error('Each line must specify a valid productId.');
        }
        return {
          productId,
          variantId: item.variantId ? parseInt(item.variantId, 10) : null,
          description: item.description ? String(item.description).trim() : 'Invoice Line Item',
          quantity: Math.max(parseInt(item.quantity, 10) || 1, 1),
          unitPrice: Math.max(Number(item.unitPrice) || 0, 0),
          taxId: item.taxId ? parseInt(item.taxId, 10) : null,
          taxName: item.taxName,
          taxRate: Number(item.taxRate) || 0,
        };
      }),
      asOfDate: issueDate,
      preferredDiscountId: body.discountId ? parseInt(body.discountId, 10) : null,
    });

    const subtotalAmount = discountEval.subtotalAmount;
    const discountAmount = discountEval.totalDiscountAmount;
    const taxAmount = discountEval.taxAmount;
    const totalAmount = discountEval.totalAmount;

    const [invResult]: any = await connection.query(
      `INSERT INTO invoices (
        invoice_number, subscription_id, customer_id, status,
        billing_period_start, billing_period_end, issue_date, due_date,
        payment_terms, subtotal_amount, tax_amount, discount_amount, total_amount,
        amount_paid, balance_due, notes, confirmed_at, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?, ?, NOW(), NOW());`,
      [
        invoiceNumber,
        subscriptionId,
        customerId,
        status,
        issueDate,
        dueDate,
        paymentTerms,
        subtotalAmount.toFixed(2),
        taxAmount.toFixed(2),
        discountAmount.toFixed(2),
        totalAmount.toFixed(2),
        totalAmount.toFixed(2),
        notes,
        status === 'confirmed' ? new Date() : null,
        currentUser.id,
      ]
    );

    const newInvoiceId = invResult.insertId;

    for (const cl of discountEval.lines) {
      await connection.query(
        `INSERT INTO invoice_lines (
          invoice_id, product_id, variant_id, description, quantity,
          unit_price, tax_id, tax_name, tax_rate, tax_amount, discount_amount,
          subtotal_amount, total_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW());`,
        [
          newInvoiceId,
          cl.productId,
          cl.variantId,
          cl.description,
          cl.quantity,
          cl.unitPrice.toFixed(2),
          cl.taxId,
          cl.taxName,
          cl.taxRate.toFixed(2),
          cl.taxAmount.toFixed(2),
          cl.discountAmount.toFixed(2),
          cl.subtotalAmount.toFixed(2),
          cl.totalAmount.toFixed(2),
        ]
      );
    }

    // Reserve or redeem discount usage slot
    if (discountEval.discountId && discountEval.totalDiscountAmount > 0) {
      await reserveDiscountUsage(connection, {
        discountId: discountEval.discountId,
        invoiceId: newInvoiceId,
        customerId,
        subscriptionId,
        amountApplied: discountEval.totalDiscountAmount,
        immediateRedeem: status === 'confirmed',
      });
    }

    await connection.commit();

    return jsonSuccess(
      {
        message: `Invoice ${invoiceNumber} created successfully.`,
        invoiceId: newInvoiceId,
        invoiceNumber,
        status,
        totalAmount,
      },
      undefined,
      201,
      {},
      origin
    );
  } catch (err: any) {
    await connection.rollback();
    console.error('Failed to create manual invoice:', err);
    return jsonError(`Failed to create invoice: ${err.message}`, 400, 'INVOICE_CREATION_FAILED', {}, origin);
  } finally {
    connection.release();
  }
}
