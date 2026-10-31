import { getDbPool, isDbConfigured } from './_shared/db';
import { jsonSuccess, jsonError, handleOptions } from './_shared/response';
import { getAuthenticatedUser } from './_shared/auth';
import { generateInvoiceNumber } from './_shared/sequence';
import { calculateBillingPeriodAndNextDate } from './_shared/lifecycle';
import { evaluateBestDiscount, reserveDiscountUsage } from './_shared/discount-engine';

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
    return jsonError('Authentication required to execute billing runs.', 401, 'UNAUTHORIZED', {}, origin);
  }

  // Permissions: Only Admin and Staff may run billing runs
  if (currentUser.role !== 'admin' && currentUser.role !== 'staff') {
    return jsonError(
      'Permission denied. Customers are not authorized to trigger billing runs or issue invoices.',
      403,
      'FORBIDDEN',
      {},
      origin
    );
  }

  if (event.httpMethod !== 'POST') {
    return jsonError(`HTTP method ${event.httpMethod} not allowed. Use POST /api/billing/run.`, 405, 'METHOD_NOT_ALLOWED', {}, origin);
  }

  let body: any = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    // Body is optional; fallback to defaults
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const asOfDate = body.asOfDate ? String(body.asOfDate).trim() : todayStr;

  // Validate asOfDate format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
    return jsonError('Invalid asOfDate format. Expected YYYY-MM-DD.', 400, 'VALIDATION_ERROR', { field: 'asOfDate' }, origin);
  }

  const batchLimit = Math.min(Math.max(parseInt(body.batchLimit, 10) || 100, 1), 500);
  const pool = getDbPool();

  try {
    // 1. Query candidate active subscriptions due on or before asOfDate
    const selectQuery = `
      SELECT 
        s.id, s.subscription_number, s.customer_id, s.plan_id, s.status,
        s.start_date, s.expiry_date, s.next_billing_date, s.payment_terms,
        s.billing_interval, s.billing_interval_count, s.discount_id, s.notes,
        c.name AS customer_name, c.email AS customer_email,
        p.billing_interval AS plan_interval, p.billing_interval_count AS plan_interval_count
      FROM subscriptions s
      JOIN customers c ON s.customer_id = c.id
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE s.status = 'active'
        AND (s.expiry_date IS NULL OR s.expiry_date >= ?)
        AND (s.next_billing_date IS NOT NULL AND s.next_billing_date <= ?)
      ORDER BY s.next_billing_date ASC, s.id ASC
      LIMIT ?;
    `;

    const [candidateSubs]: any = await pool.query(selectQuery, [asOfDate, asOfDate, batchLimit]);

    let createdCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let totalInvoicedAmount = 0;
    const runDetails: any[] = [];

    // 2. Process subscriptions in bounded batches with per-subscription transaction isolation
    for (const sub of candidateSubs) {
      const interval: 'daily' | 'weekly' | 'monthly' | 'yearly' =
        sub.billing_interval || sub.plan_interval || 'monthly';
      const intervalCount = sub.billing_interval_count || sub.plan_interval_count || 1;

      const baseStart = sub.next_billing_date ? sub.next_billing_date.toISOString?.().split('T')[0] || String(sub.next_billing_date).split('T')[0] : asOfDate;
      const { periodStart, periodEnd, nextBillingDate } = calculateBillingPeriodAndNextDate(baseStart, interval, intervalCount);

      // Check database idempotency to prevent duplicate invoices for the same period
      const [existingInvoices]: any = await pool.query(
        'SELECT id, invoice_number FROM invoices WHERE subscription_id = ? AND billing_period_start = ? AND billing_period_end = ? LIMIT 1;',
        [sub.id, periodStart, periodEnd]
      );

      if (existingInvoices && existingInvoices.length > 0) {
        skippedCount++;
        runDetails.push({
          subscriptionId: sub.id,
          subscriptionNumber: sub.subscription_number,
          status: 'skipped',
          reason: `Invoice ${existingInvoices[0].invoice_number} already exists for period ${periodStart} to ${periodEnd}.`,
        });

        // Ensure next_billing_date advances if it was lagging behind the already invoiced period
        if (baseStart <= periodStart) {
          await pool.query('UPDATE subscriptions SET next_billing_date = ?, updated_at = NOW() WHERE id = ?;', [nextBillingDate, sub.id]);
        }
        continue;
      }

      // Process billing in a dedicated transaction
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // Lock subscription row to prevent concurrent billing worker collisions
        const [lockedSubRows]: any = await connection.query(
          'SELECT id, status, next_billing_date FROM subscriptions WHERE id = ? FOR UPDATE;',
          [sub.id]
        );

        if (!lockedSubRows || lockedSubRows.length === 0 || lockedSubRows[0].status !== 'active') {
          await connection.rollback();
          skippedCount++;
          runDetails.push({
            subscriptionId: sub.id,
            subscriptionNumber: sub.subscription_number,
            status: 'skipped',
            reason: 'Subscription status modified concurrently or no longer active.',
          });
          continue;
        }

        // Fetch subscription line items
        const [lines]: any = await connection.query(
          `SELECT sl.*, t.name AS current_tax_name 
           FROM subscription_lines sl
           LEFT JOIN taxes t ON sl.tax_id = t.id
           WHERE sl.subscription_id = ?;`,
          [sub.id]
        );

        if (!lines || lines.length === 0) {
          await connection.rollback();
          failedCount++;
          runDetails.push({
            subscriptionId: sub.id,
            subscriptionNumber: sub.subscription_number,
            status: 'failed',
            error: 'Subscription has no line items configured for billing.',
          });
          continue;
        }

        // Generate atomic, concurrency-safe invoice number INV-YYYY-XXXX
        const invoiceNumber = await generateInvoiceNumber(connection);

        // Evaluate discounts deterministically with pre-tax application
        const discountEval = await evaluateBestDiscount(connection, {
          subscriptionId: sub.id,
          customerId: sub.customer_id,
          lines: lines.map((l: any) => ({
            productId: l.product_id,
            variantId: l.variant_id,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unit_price,
            taxId: l.tax_id,
            taxName: l.tax_name || l.current_tax_name,
            taxRate: Number(l.tax_rate) || 0,
          })),
          asOfDate,
          preferredDiscountId: sub.discount_id,
        });

        const subtotalAmount = discountEval.subtotalAmount;
        const discountAmount = discountEval.totalDiscountAmount;
        const taxAmount = discountEval.taxAmount;
        const totalAmount = discountEval.totalAmount;

        const paymentTerms = sub.payment_terms || 'Immediate Payment';
        const dueDate = calculateDueDate(asOfDate, paymentTerms);

        // Insert confirmed invoice record
        const [invResult]: any = await connection.query(
          `INSERT INTO invoices (
            invoice_number, subscription_id, customer_id, status,
            billing_period_start, billing_period_end, issue_date, due_date,
            payment_terms, subtotal_amount, tax_amount, discount_amount, total_amount,
            amount_paid, balance_due, notes, confirmed_at, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, NOW(), ?, NOW(), NOW());`,
          [
            invoiceNumber,
            sub.id,
            sub.customer_id,
            periodStart,
            periodEnd,
            asOfDate,
            dueDate,
            paymentTerms,
            subtotalAmount.toFixed(2),
            taxAmount.toFixed(2),
            discountAmount.toFixed(2),
            totalAmount.toFixed(2),
            totalAmount.toFixed(2),
            `Automated recurring billing run for period ${periodStart} to ${periodEnd}${
              discountEval.discountCode ? ` (Discount: ${discountEval.discountCode})` : ''
            }`,
            currentUser.id,
          ]
        );

        const newInvoiceId = invResult.insertId;

        // Insert invoice line items
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

        // Record discount usage if a discount was applied
        if (discountEval.discountId && discountEval.totalDiscountAmount > 0) {
          await reserveDiscountUsage(connection, {
            discountId: discountEval.discountId,
            invoiceId: newInvoiceId,
            customerId: sub.customer_id,
            subscriptionId: sub.id,
            amountApplied: discountEval.totalDiscountAmount,
            immediateRedeem: true,
          });
        }

        // Advance next_billing_date only after invoice creation succeeds
        await connection.query(
          'UPDATE subscriptions SET next_billing_date = ?, updated_at = NOW() WHERE id = ?;',
          [nextBillingDate, sub.id]
        );

        await connection.commit();

        createdCount++;
        totalInvoicedAmount = Math.round((totalInvoicedAmount + totalAmount) * 100) / 100;

        runDetails.push({
          subscriptionId: sub.id,
          subscriptionNumber: sub.subscription_number,
          invoiceId: newInvoiceId,
          invoiceNumber,
          period: `${periodStart} to ${periodEnd}`,
          amount: totalAmount,
          discountAmount,
          discountCode: discountEval.discountCode,
          nextBillingDate,
          status: 'created',
        });
      } catch (subErr: any) {
        await connection.rollback();
        failedCount++;
        console.error(`Billing error for subscription ${sub.subscription_number}:`, subErr);

        runDetails.push({
          subscriptionId: sub.id,
          subscriptionNumber: sub.subscription_number,
          status: 'failed',
          error: subErr.code === 'ER_DUP_ENTRY' ? 'Duplicate invoice collision prevented by database constraint.' : subErr.message,
        });
      } finally {
        connection.release();
      }
    }

    // 3. Record the billing run in the billing_runs ledger
    const runNumber = `BR-${asOfDate.replace(/-/g, '')}-${Date.now().toString().slice(-5)}`;
    let runStatus: 'completed' | 'partial' | 'failed' = 'completed';
    if (failedCount > 0 && createdCount > 0) {
      runStatus = 'partial';
    } else if (failedCount > 0 && createdCount === 0) {
      runStatus = 'failed';
    }

    await pool.query(
      `INSERT INTO billing_runs (
        run_number, as_of_date, status, processed_count, created_count,
        skipped_count, failed_count, total_invoiced_amount, triggered_by, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW());`,
      [
        runNumber,
        asOfDate,
        runStatus,
        candidateSubs.length,
        createdCount,
        skippedCount,
        failedCount,
        totalInvoicedAmount.toFixed(2),
        currentUser.id,
        JSON.stringify(runDetails),
      ]
    );

    return jsonSuccess(
      {
        message: `Billing run executed successfully for as-of date ${asOfDate}.`,
        runNumber,
        asOfDate,
        status: runStatus,
        processedCount: candidateSubs.length,
        createdCount,
        skippedCount,
        failedCount,
        totalInvoicedAmount,
        details: runDetails,
      },
      undefined,
      200,
      {},
      origin
    );
  } catch (error: any) {
    console.error('Fatal error executing billing run:', error);
    return jsonError('Failed to execute billing run.', 500, 'BILLING_RUN_FAILED', { details: error.message }, origin);
  }
}
