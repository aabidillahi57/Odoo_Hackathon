import { getDbPool, isDbConfigured, executeQuery } from './_shared/db';
import { jsonSuccess, jsonError, handleOptions } from './_shared/response';
import { getAuthenticatedUser } from './_shared/auth';
import { generatePaymentNumber } from './_shared/sequence';
import { PoolConnection } from 'mysql2/promise';

function parsePaymentPath(path: string): { id?: number; action?: string } {
  const cleanPath = path.replace(/^(\/\.netlify\/functions|\/api)?\/payments\/?/, '');
  const segments = cleanPath.split('/').filter(Boolean);
  if (segments.length === 0) return {};
  const id = parseInt(segments[0], 10);
  if (!isNaN(id)) {
    return { id, action: segments[1] };
  }
  return {};
}

/**
 * Single Authoritative Server-Side Calculation Method for Invoice Balances
 * Recalculates amount_paid and balance_due from completed, non-voided payments.
 * Automatically marks invoice 'paid' when balance reaches zero, or reverts to 'confirmed' if voided.
 */
export async function reconcileInvoiceBalance(
  connection: PoolConnection,
  invoiceId: number
): Promise<{ amountPaid: number; balanceDue: number; status: string }> {
  // 1. Fetch invoice total
  const [invRows]: any = await connection.query(
    'SELECT id, total_amount, status FROM invoices WHERE id = ? FOR UPDATE;',
    [invoiceId]
  );

  if (!invRows || invRows.length === 0) {
    throw new Error(`Invoice #${invoiceId} not found during balance reconciliation.`);
  }

  const invoice = invRows[0];
  const totalAmount = Number(invoice.total_amount);

  // 2. Sum valid, non-voided payments
  const [sumRows]: any = await connection.query(
    `SELECT COALESCE(SUM(amount), 0) AS total_paid
     FROM payments
     WHERE invoice_id = ? AND status = 'completed';`,
    [invoiceId]
  );

  const amountPaid = Math.round(Number(sumRows[0].total_paid) * 100) / 100;
  const balanceDue = Math.max(0, Math.round((totalAmount - amountPaid) * 100) / 100);

  // 3. Determine updated status
  let newStatus = invoice.status;
  if (newStatus !== 'cancelled') {
    if (balanceDue === 0 && amountPaid > 0) {
      newStatus = 'paid';
    } else if (balanceDue > 0 && newStatus === 'paid') {
      newStatus = 'confirmed'; // Revert to confirmed if payment was voided
    }
  }

  // 4. Update invoice record
  await connection.query(
    'UPDATE invoices SET amount_paid = ?, balance_due = ?, status = ?, updated_at = NOW() WHERE id = ?;',
    [amountPaid.toFixed(2), balanceDue.toFixed(2), newStatus, invoiceId]
  );

  return { amountPaid, balanceDue, status: newStatus };
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
    return jsonError('Authentication required to access payments.', 401, 'UNAUTHORIZED', {}, origin);
  }

  const pathInfo = parsePaymentPath(event.path || '');
  const queryId = event.queryStringParameters?.id ? parseInt(event.queryStringParameters.id, 10) : undefined;
  const paymentId = pathInfo.id || queryId;
  const action = pathInfo.action || event.queryStringParameters?.action;

  try {
    // -------------------------------------------------------------------------
    // 1. GET Requests: List or Detail
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'GET') {
      if (paymentId) {
        return await handleGetPaymentDetail(paymentId, currentUser, origin);
      }
      return await handleListPayments(event, currentUser, origin);
    }

    // -------------------------------------------------------------------------
    // 2. POST Requests: Record Payment or Void Payment
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'POST') {
      if (paymentId && action === 'void') {
        return await handleVoidPayment(paymentId, event, currentUser, origin);
      }

      if (!paymentId) {
        return await handleRecordPayment(event, currentUser, origin);
      }

      return jsonError(`Unknown action '${action}' for payments.`, 400, 'INVALID_ACTION', {}, origin);
    }

    return jsonError(`HTTP method ${event.httpMethod} not allowed.`, 405, 'METHOD_NOT_ALLOWED', {}, origin);
  } catch (error: any) {
    console.error('Error in payments function:', error);
    return jsonError('Internal server error processing payment.', 500, 'INTERNAL_SERVER_ERROR', { details: error.message }, origin);
  }
}

/**
 * Lists recorded payments with filtering, search, and customer ownership scoping
 */
async function handleListPayments(event: any, currentUser: any, origin?: string) {
  const query = event.queryStringParameters || {};
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const whereConditions: string[] = [];
  const params: any[] = [];

  // Scoping for Customers: strictly view own payment receipts
  if (currentUser.role === 'customer') {
    if (!currentUser.customerId) {
      return jsonSuccess({ payments: [], total: 0, page, limit, totalPages: 0 }, undefined, 200, {}, origin);
    }
    whereConditions.push('p.customer_id = ?');
    params.push(currentUser.customerId);
  } else if (query.customer_id) {
    whereConditions.push('p.customer_id = ?');
    params.push(parseInt(query.customer_id, 10));
  }

  // Filter by invoice
  if (query.invoice_id) {
    whereConditions.push('p.invoice_id = ?');
    params.push(parseInt(query.invoice_id, 10));
  }

  // Filter by method
  if (query.method && ['credit_card', 'bank_transfer', 'cash', 'other'].includes(query.method)) {
    whereConditions.push('p.payment_method = ?');
    params.push(query.method);
  }

  // Filter by status
  if (query.status && ['completed', 'voided'].includes(query.status)) {
    whereConditions.push('p.status = ?');
    params.push(query.status);
  } else if (!query.status || query.status !== 'all') {
    // Default to completed payments unless specified
    whereConditions.push("p.status = 'completed'");
  }

  // Filter by date range
  if (query.date_from) {
    whereConditions.push('p.payment_date >= ?');
    params.push(query.date_from);
  }
  if (query.date_to) {
    whereConditions.push('p.payment_date <= ?');
    params.push(query.date_to);
  }

  // Search by payment number, invoice number, customer name, transaction ref
  if (query.search && query.search.trim()) {
    const term = `%${query.search.trim()}%`;
    whereConditions.push('(p.payment_number LIKE ? OR i.invoice_number LIKE ? OR c.name LIKE ? OR p.transaction_reference LIKE ?)');
    params.push(term, term, term, term);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(*) AS total
    FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    JOIN customers c ON p.customer_id = c.id
    ${whereClause};
  `;
  const countRows: any = await executeQuery(countSql, params);
  const total = countRows[0]?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const selectSql = `
    SELECT 
      p.*,
      i.invoice_number, i.total_amount AS invoice_total, i.balance_due AS invoice_balance_due,
      c.name AS customer_name, c.company_name,
      u.first_name AS recorded_by_first_name, u.last_name AS recorded_by_last_name,
      v.first_name AS voided_by_first_name
    FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    JOIN customers c ON p.customer_id = c.id
    LEFT JOIN users u ON p.recorded_by = u.id
    LEFT JOIN users v ON p.voided_by = v.id
    ${whereClause}
    ORDER BY p.payment_date DESC, p.id DESC
    LIMIT ? OFFSET ?;
  `;

  const rows: any = await executeQuery(selectSql, [...params, limit, offset]);

  const payments = rows.map((r: any) => ({
    id: r.id,
    paymentNumber: r.payment_number,
    invoiceId: r.invoice_id,
    invoiceNumber: r.invoice_number,
    invoiceTotal: Number(r.invoice_total),
    invoiceBalanceDue: Number(r.invoice_balance_due),
    customerId: r.customer_id,
    customerName: r.customer_name,
    companyName: r.company_name || null,
    amount: Number(r.amount),
    paymentMethod: r.payment_method,
    paymentDate: r.payment_date ? (r.payment_date.toISOString?.().split('T')[0] || String(r.payment_date).split('T')[0]) : '',
    status: r.status,
    transactionReference: r.transaction_reference || null,
    notes: r.notes || '',
    recordedByName: r.recorded_by_first_name ? `${r.recorded_by_first_name} ${r.recorded_by_last_name || ''}`.trim() : null,
    voidedAt: r.voided_at,
    voidedByName: r.voided_by_first_name || null,
    voidReason: r.void_reason || null,
    createdAt: r.created_at,
  }));

  return jsonSuccess({ payments, total, page, limit, totalPages }, undefined, 200, {}, origin);
}

/**
 * Returns single payment detail; enforces customer ownership
 */
async function handleGetPaymentDetail(paymentId: number, currentUser: any, origin?: string) {
  const rows: any = await executeQuery(
    `SELECT 
      p.*,
      i.invoice_number, i.total_amount AS invoice_total, i.balance_due AS invoice_balance_due,
      c.name AS customer_name, c.company_name, c.email AS customer_email,
      u.first_name AS recorded_by_first_name, u.last_name AS recorded_by_last_name,
      v.first_name AS voided_by_first_name
     FROM payments p
     JOIN invoices i ON p.invoice_id = i.id
     JOIN customers c ON p.customer_id = c.id
     LEFT JOIN users u ON p.recorded_by = u.id
     LEFT JOIN users v ON p.voided_by = v.id
     WHERE p.id = ?;`,
    [paymentId]
  );

  if (!rows || rows.length === 0) {
    return jsonError(`Payment record #${paymentId} not found.`, 404, 'PAYMENT_NOT_FOUND', {}, origin);
  }

  const r = rows[0];

  // Customer IDOR check
  if (currentUser.role === 'customer') {
    if (!currentUser.customerId || r.customer_id !== currentUser.customerId) {
      return jsonError('Access denied. You can only view payment receipts for your own account.', 403, 'FORBIDDEN', {}, origin);
    }
  }

  const payment = {
    id: r.id,
    paymentNumber: r.payment_number,
    invoiceId: r.invoice_id,
    invoiceNumber: r.invoice_number,
    invoiceTotal: Number(r.invoice_total),
    invoiceBalanceDue: Number(r.invoice_balance_due),
    customerId: r.customer_id,
    customerName: r.customer_name,
    companyName: r.company_name || null,
    customerEmail: r.customer_email,
    amount: Number(r.amount),
    paymentMethod: r.payment_method,
    paymentDate: r.payment_date ? (r.payment_date.toISOString?.().split('T')[0] || String(r.payment_date).split('T')[0]) : '',
    status: r.status,
    transactionReference: r.transaction_reference || null,
    notes: r.notes || '',
    recordedByName: r.recorded_by_first_name ? `${r.recorded_by_first_name} ${r.recorded_by_last_name || ''}`.trim() : null,
    voidedAt: r.voided_at,
    voidedByName: r.voided_by_first_name || null,
    voidReason: r.void_reason || null,
    createdAt: r.created_at,
  };

  return jsonSuccess({ payment }, undefined, 200, {}, origin);
}

/**
 * Records a manual payment against an invoice (Admin/Staff only)
 */
async function handleRecordPayment(event: any, currentUser: any, origin?: string) {
  if (currentUser.role === 'customer') {
    return jsonError('Permission denied. Customers cannot record payments.', 403, 'FORBIDDEN', {}, origin);
  }

  let body: any = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonError('Invalid JSON request body.', 400, 'INVALID_JSON', {}, origin);
  }

  const invoiceId = parseInt(body.invoiceId, 10);
  if (!invoiceId || isNaN(invoiceId)) {
    return jsonError('Valid invoice ID is required.', 400, 'VALIDATION_ERROR', { field: 'invoiceId' }, origin);
  }

  const amount = Number(body.amount);
  if (isNaN(amount) || amount <= 0) {
    return jsonError('Payment amount must be a positive number greater than zero.', 400, 'VALIDATION_ERROR', { field: 'amount' }, origin);
  }

  const paymentMethod = body.paymentMethod || 'bank_transfer';
  if (!['credit_card', 'bank_transfer', 'cash', 'other'].includes(paymentMethod)) {
    return jsonError("Payment method must be 'credit_card', 'bank_transfer', 'cash', or 'other'.", 400, 'VALIDATION_ERROR', { field: 'paymentMethod' }, origin);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const paymentDate = body.paymentDate ? String(body.paymentDate).trim() : todayStr;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
    return jsonError('Payment date must be in YYYY-MM-DD format.', 400, 'VALIDATION_ERROR', { field: 'paymentDate' }, origin);
  }

  const transactionReference = body.transactionReference ? String(body.transactionReference).trim().slice(0, 100) : null;
  const notes = body.notes ? String(body.notes).trim() : null;

  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Lock invoice row and check status & balance
    const [invRows]: any = await connection.query(
      'SELECT id, invoice_number, customer_id, status, total_amount, amount_paid, balance_due FROM invoices WHERE id = ? FOR UPDATE;',
      [invoiceId]
    );

    if (!invRows || invRows.length === 0) {
      await connection.rollback();
      return jsonError(`Invoice #${invoiceId} not found.`, 404, 'INVOICE_NOT_FOUND', {}, origin);
    }

    const inv = invRows[0];

    // Payments cannot be accepted on draft or cancelled invoices
    if (inv.status === 'draft') {
      await connection.rollback();
      return jsonError(`Cannot record payment on Draft invoice ${inv.invoice_number}. Please confirm the invoice first.`, 400, 'INVOICE_IS_DRAFT', {}, origin);
    }
    if (inv.status === 'cancelled') {
      await connection.rollback();
      return jsonError(`Cannot record payment on cancelled invoice ${inv.invoice_number}.`, 400, 'INVOICE_CANCELLED', {}, origin);
    }

    const currentBalance = Number(inv.balance_due);
    if (currentBalance <= 0) {
      await connection.rollback();
      return jsonError(`Invoice ${inv.invoice_number} is already paid in full ($0.00 balance due).`, 400, 'ALREADY_PAID', {}, origin);
    }

    // Reject payment amounts greater than outstanding balance
    const roundedAmount = Math.round(amount * 100) / 100;
    if (roundedAmount > currentBalance) {
      await connection.rollback();
      return jsonError(
        `Payment amount ($${roundedAmount.toFixed(2)}) exceeds the invoice outstanding balance of $${currentBalance.toFixed(2)}. Overpayment is not permitted.`,
        400,
        'OVERPAYMENT_EXCEEDS_BALANCE',
        {},
        origin
      );
    }

    // 2. Generate atomic payment sequence PAY-YYYY-XXXX
    const paymentNumber = await generatePaymentNumber(connection);

    // 3. Insert payment record
    const [payResult]: any = await connection.query(
      `INSERT INTO payments (
        payment_number, invoice_id, customer_id, amount,
        payment_method, payment_date, status, transaction_reference,
        notes, recorded_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, NOW(), NOW());`,
      [
        paymentNumber,
        inv.id,
        inv.customer_id,
        roundedAmount.toFixed(2),
        paymentMethod,
        paymentDate,
        transactionReference,
        notes,
        currentUser.id,
      ]
    );

    const paymentId = payResult.insertId;

    // 4. Reconcile invoice balance authoritatively
    const reconciliation = await reconcileInvoiceBalance(connection, inv.id);

    await connection.commit();

    return jsonSuccess(
      {
        message: `Payment ${paymentNumber} of $${roundedAmount.toFixed(2)} recorded successfully against invoice ${inv.invoice_number}.`,
        paymentId,
        paymentNumber,
        amount: roundedAmount,
        invoiceNumber: inv.invoice_number,
        newBalanceDue: reconciliation.balanceDue,
        invoiceStatus: reconciliation.status,
      },
      undefined,
      201,
      {},
      origin
    );
  } catch (err: any) {
    await connection.rollback();
    console.error('Error recording payment:', err);
    return jsonError(`Failed to record payment: ${err.message}`, 500, 'PAYMENT_RECORDING_FAILED', {}, origin);
  } finally {
    connection.release();
  }
}

/**
 * Voids an existing payment with an audited reason and restores invoice balance
 */
async function handleVoidPayment(paymentId: number, event: any, currentUser: any, origin?: string) {
  if (currentUser.role === 'customer') {
    return jsonError('Permission denied. Customers cannot void payments.', 403, 'FORBIDDEN', {}, origin);
  }

  let body: any = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    // Body optional
  }

  const voidReason = String(body.reason || body.voidReason || '').trim();
  if (!voidReason) {
    return jsonError('A reason is required to void a recorded payment for audit compliance.', 400, 'VALIDATION_ERROR', { field: 'reason' }, origin);
  }

  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows]: any = await connection.query(
      'SELECT id, payment_number, invoice_id, amount, status FROM payments WHERE id = ? FOR UPDATE;',
      [paymentId]
    );

    if (!rows || rows.length === 0) {
      await connection.rollback();
      return jsonError(`Payment record #${paymentId} not found.`, 404, 'PAYMENT_NOT_FOUND', {}, origin);
    }

    const pay = rows[0];
    if (pay.status === 'voided') {
      await connection.rollback();
      return jsonError(`Payment ${pay.payment_number} has already been voided.`, 400, 'ALREADY_VOIDED', {}, origin);
    }

    // Mark payment as voided with audit details
    await connection.query(
      `UPDATE payments SET
        status = 'voided',
        voided_at = NOW(),
        voided_by = ?,
        void_reason = ?,
        updated_at = NOW()
       WHERE id = ?;`,
      [currentUser.id, voidReason, paymentId]
    );

    // Reconcile invoice balance authoritatively
    const reconciliation = await reconcileInvoiceBalance(connection, pay.invoice_id);

    await connection.commit();

    return jsonSuccess(
      {
        message: `Payment ${pay.payment_number} has been voided. Invoice balance adjusted to $${reconciliation.balanceDue.toFixed(2)}.`,
        paymentNumber: pay.payment_number,
        status: 'voided',
        restoredBalanceDue: reconciliation.balanceDue,
        invoiceStatus: reconciliation.status,
      },
      undefined,
      200,
      {},
      origin
    );
  } catch (err: any) {
    await connection.rollback();
    console.error('Error voiding payment:', err);
    return jsonError(`Failed to void payment: ${err.message}`, 500, 'PAYMENT_VOID_FAILED', {}, origin);
  } finally {
    connection.release();
  }
}
