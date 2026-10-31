import { getDbPool, isDbConfigured, executeQuery } from './_shared/db';
import { jsonSuccess, jsonError, handleOptions } from './_shared/response';
import { getAuthenticatedUser } from './_shared/auth';
import { generateSubscriptionNumber } from './_shared/sequence';
import { calculateNextBillingDate } from './_shared/lifecycle';

function parseTemplatePath(path: string): { id?: number; action?: string } {
  const cleanPath = path.replace(/^(\/\.netlify\/functions|\/api)?\/quotation-templates\/?/, '');
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
    return jsonError('Authentication required to access quotation templates.', 401, 'UNAUTHORIZED', {}, origin);
  }

  const pathInfo = parseTemplatePath(event.path || '');
  const queryId = event.queryStringParameters?.id ? parseInt(event.queryStringParameters.id, 10) : undefined;
  const templateId = pathInfo.id || queryId;
  const action = pathInfo.action || event.queryStringParameters?.action;

  try {
    // -------------------------------------------------------------------------
    // 1. GET Requests
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'GET') {
      if (templateId) {
        return await handleGetTemplate(templateId, origin);
      }
      return await handleListTemplates(origin);
    }

    // -------------------------------------------------------------------------
    // 2. POST Requests — Issue Subscription from Quotation Template
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'POST') {
      if (!templateId || action !== 'issue') {
        return jsonError('Invalid issuance path. Expected POST /api/quotation-templates/:id/issue', 400, 'BAD_REQUEST', {}, origin);
      }

      return await handleIssueQuotationSubscription(templateId, event, currentUser, origin);
    }

    return jsonError('Method Not Allowed', 405, undefined, {}, origin);
  } catch (err: any) {
    console.error('Quotation templates handler error:', err);
    return jsonError(err.message || 'Internal server error processing quotation templates.', 500, 'SERVER_ERROR', {}, origin);
  }
}

/**
 * GET /api/quotation-templates — List active quotation templates with preset lines
 */
async function handleListTemplates(origin?: string) {
  const templateRows = await executeQuery<any>(
    `SELECT qt.*, p.name AS plan_name, p.billing_interval AS plan_interval, p.price AS plan_price
     FROM quotation_templates qt
     LEFT JOIN plans p ON qt.plan_id = p.id
     WHERE qt.is_active = TRUE
     ORDER BY qt.id ASC;`
  );

  const templates: any[] = [];

  for (const t of templateRows) {
    const lineRows = await executeQuery<any>(
      `SELECT qtl.*, p.name AS product_name, p.sales_price, p.type AS product_type,
              pv.attribute_name, pv.attribute_value, pv.price_adjustment,
              t.name AS tax_name, t.rate_percentage AS tax_rate
       FROM quotation_template_lines qtl
       JOIN products p ON qtl.product_id = p.id
       LEFT JOIN product_variants pv ON qtl.variant_id = pv.id
       LEFT JOIN taxes t ON qtl.tax_id = t.id
       WHERE qtl.template_id = ?
       ORDER BY qtl.id ASC;`,
      [t.id]
    );

    const lines = lineRows.map((l) => ({
      id: l.id,
      productId: l.product_id,
      productName: l.product_name,
      productType: l.product_type,
      variantId: l.variant_id,
      variantName: l.attribute_value ? `${l.attribute_name}: ${l.attribute_value}` : null,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unit_price),
      taxId: l.tax_id,
      taxName: l.tax_name || (Number(l.tax_rate) > 0 ? `${l.tax_rate}%` : 'None'),
      taxRate: Number(l.tax_rate || 0),
    }));

    templates.push({
      id: t.id,
      name: t.name,
      planId: t.plan_id,
      planName: t.plan_name || 'Standard Tier',
      planInterval: t.plan_interval || 'monthly',
      validityDays: Number(t.validity_days || 30),
      notes: t.notes,
      isActive: Boolean(t.is_active),
      linesCount: lines.length,
      lines,
    });
  }

  return jsonSuccess(templates, undefined, 200, {}, origin);
}

/**
 * GET /api/quotation-templates/:id — Single quotation template detail
 */
async function handleGetTemplate(templateId: number, origin?: string) {
  const tRows = await executeQuery<any>(
    `SELECT qt.*, p.name AS plan_name, p.billing_interval AS plan_interval, p.price AS plan_price,
            p.auto_close, p.early_close_policy, p.pause_allowed, p.renewal_policy
     FROM quotation_templates qt
     LEFT JOIN plans p ON qt.plan_id = p.id
     WHERE qt.id = ?
     LIMIT 1;`,
    [templateId]
  );

  if (!tRows || tRows.length === 0) {
    return jsonError('Quotation template not found.', 404, 'NOT_FOUND', {}, origin);
  }

  const t = tRows[0];

  const lineRows = await executeQuery<any>(
    `SELECT qtl.*, p.name AS product_name, p.sales_price, p.type AS product_type,
            pv.attribute_name, pv.attribute_value, pv.price_adjustment,
            t.name AS tax_name, t.rate_percentage AS tax_rate
     FROM quotation_template_lines qtl
     JOIN products p ON qtl.product_id = p.id
     LEFT JOIN product_variants pv ON qtl.variant_id = pv.id
     LEFT JOIN taxes t ON qtl.tax_id = t.id
     WHERE qtl.template_id = ?
     ORDER BY qtl.id ASC;`,
    [t.id]
  );

  const lines = lineRows.map((l) => ({
    id: l.id,
    productId: l.product_id,
    productName: l.product_name,
    productType: l.product_type,
    variantId: l.variant_id,
    variantName: l.attribute_value ? `${l.attribute_name}: ${l.attribute_value}` : null,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unit_price),
    taxId: l.tax_id,
    taxName: l.tax_name || (Number(l.tax_rate) > 0 ? `${l.tax_rate}%` : 'None'),
    taxRate: Number(l.tax_rate || 0),
  }));

  const templateDetail = {
    id: t.id,
    name: t.name,
    planId: t.plan_id,
    planName: t.plan_name,
    planInterval: t.plan_interval,
    validityDays: Number(t.validity_days || 30),
    notes: t.notes,
    isActive: Boolean(t.is_active),
    lines,
  };

  return jsonSuccess(templateDetail, undefined, 200, {}, origin);
}

/**
 * POST /api/quotation-templates/:id/issue — Issue a Subscription in 'Quotation' Status
 *
 * Implements Section 6 Quotation-to-Subscription issuance workflow:
 * 1. Staff/Admin selects customer & active quotation template.
 * 2. Loads template default plan and product/variant lines.
 * 3. User reviews and adjusts permitted details (quantities, terms, dates).
 * 4. Validates template, customer, plan, products, variants, and taxes.
 * 5. Applies validity period to calculate quotation expiry date.
 * 6. Creates subscription in 'quotation' status with unique number and copied line snapshots.
 * 7. Stores source template reference for traceability.
 * 8. Returns success response with subscription details.
 */
async function handleIssueQuotationSubscription(
  templateId: number,
  event: any,
  currentUser: any,
  origin?: string
) {
  if (currentUser.role !== 'admin' && currentUser.role !== 'staff') {
    return jsonError('Only Staff or Administrators can issue quotations from templates.', 403, 'FORBIDDEN', {}, origin);
  }

  let body: any;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch {
    return jsonError('Invalid JSON request body.', 400, 'BAD_REQUEST', {}, origin);
  }

  const { customerId, startDate, customValidityDays, paymentTerms, autoRenew, notes, lineOverrides } = body;

  if (!customerId || isNaN(parseInt(customerId, 10))) {
    return jsonError('A valid customerId is required to issue a quotation.', 400, 'BAD_REQUEST', {}, origin);
  }

  const pool = getDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Verify Customer
    const [custRows]: any = await connection.execute(
      'SELECT id, name, company_name, email FROM customers WHERE id = ?;',
      [customerId]
    );
    if (!custRows || custRows.length === 0) {
      await connection.rollback();
      return jsonError('Selected customer does not exist.', 400, 'BAD_REQUEST', {}, origin);
    }
    const customer = custRows[0];

    // 2. Verify Active Quotation Template
    const [tmplRows]: any = await connection.execute(
      'SELECT * FROM quotation_templates WHERE id = ?;',
      [templateId]
    );
    if (!tmplRows || tmplRows.length === 0) {
      await connection.rollback();
      return jsonError('Quotation template not found.', 404, 'NOT_FOUND', {}, origin);
    }
    const template = tmplRows[0];
    if (!template.is_active) {
      await connection.rollback();
      return jsonError('Cannot issue quotation from a disabled or archived template.', 400, 'TEMPLATE_INACTIVE', {}, origin);
    }

    // 3. Verify Plan
    let plan: any = null;
    if (template.plan_id) {
      const [planRows]: any = await connection.execute(
        'SELECT * FROM plans WHERE id = ?;',
        [template.plan_id]
      );
      if (!planRows || planRows.length === 0 || !planRows[0].is_active) {
        await connection.rollback();
        return jsonError('The subscription plan associated with this template is inactive or unavailable.', 400, 'PLAN_INACTIVE', {}, origin);
      }
      plan = planRows[0];
    }

    // 4. Load Preset Lines from Database
    const [presetLineRows]: any = await connection.execute(
      'SELECT * FROM quotation_template_lines WHERE template_id = ?;',
      [templateId]
    );

    if (!presetLineRows || presetLineRows.length === 0) {
      await connection.rollback();
      return jsonError('Quotation template has no preset line items.', 400, 'EMPTY_TEMPLATE', {}, origin);
    }

    // 5. Calculate Quotation Dates
    const effectiveStartDate = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
      ? startDate
      : new Date().toISOString().split('T')[0];

    const validityDays = customValidityDays && !isNaN(parseInt(customValidityDays, 10)) && parseInt(customValidityDays, 10) > 0
      ? parseInt(customValidityDays, 10)
      : Number(template.validity_days || 30);

    const expiryDateObj = new Date(effectiveStartDate);
    expiryDateObj.setDate(expiryDateObj.getDate() + validityDays);
    const expiryDate = expiryDateObj.toISOString().split('T')[0];

    const interval = plan ? plan.billing_interval : 'monthly';
    const intervalCount = plan ? plan.billing_interval_count : 1;
    const nextBillingDate = calculateNextBillingDate(effectiveStartDate, interval, intervalCount);

    // 6. Authoritative Line Calculation (Do NOT trust client prices)
    const calculatedLines: any[] = [];
    let subtotalSum = 0;
    let taxSum = 0;

    for (const preset of presetLineRows) {
      // Check if client supplied an override quantity for this line
      let quantity = Number(preset.quantity);
      if (lineOverrides && Array.isArray(lineOverrides)) {
        const override = lineOverrides.find(
          (o: any) =>
            o.productId === preset.product_id &&
            (o.variantId || null) === (preset.variant_id || null)
        );
        if (override && override.quantity) {
          const q = parseInt(override.quantity, 10);
          if (!isNaN(q) && q > 0) quantity = q;
        }
      }

      // Re-read product
      const [prodRows]: any = await connection.execute(
        'SELECT id, name, sales_price, is_active FROM products WHERE id = ?;',
        [preset.product_id]
      );
      if (!prodRows || prodRows.length === 0 || !prodRows[0].is_active) {
        await connection.rollback();
        return jsonError(`Product in template (ID: ${preset.product_id}) is no longer active in catalog.`, 400, 'PRODUCT_UNAVAILABLE', {}, origin);
      }
      const prod = prodRows[0];
      let unitPrice = Number(prod.sales_price);
      let variantDescription = '';

      // Re-read variant
      if (preset.variant_id) {
        const [varRows]: any = await connection.execute(
          'SELECT id, attribute_name, attribute_value, price_adjustment, is_active FROM product_variants WHERE id = ? AND product_id = ?;',
          [preset.variant_id, prod.id]
        );
        if (!varRows || varRows.length === 0 || !varRows[0].is_active) {
          await connection.rollback();
          return jsonError(`Product variant in template (ID: ${preset.variant_id}) is no longer active.`, 400, 'VARIANT_UNAVAILABLE', {}, origin);
        }
        unitPrice += Number(varRows[0].price_adjustment || 0);
        variantDescription = ` (${varRows[0].attribute_name}: ${varRows[0].attribute_value})`;
      }

      // Re-read tax
      let taxRate = 0;
      if (preset.tax_id) {
        const [taxRows]: any = await connection.execute(
          'SELECT rate_percentage FROM taxes WHERE id = ? AND is_active = TRUE;',
          [preset.tax_id]
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
        variantId: preset.variant_id || null,
        description: `${prod.name}${variantDescription}`,
        quantity,
        unitPrice,
        taxId: preset.tax_id || null,
        taxRate,
        taxAmount: lineTax,
        subtotalAmount: lineSubtotal,
        totalAmount: lineTotal,
      });
    }

    const subtotalAmount = Number(subtotalSum.toFixed(2));
    const taxAmount = Number(taxSum.toFixed(2));
    const totalRecurringAmount = Number((subtotalAmount + taxAmount).toFixed(2));

    // 7. Generate Concurrency-Safe Subscription Number
    const subscriptionNumber = await generateSubscriptionNumber(connection);

    // 8. Create Subscription in 'quotation' Status
    const [subResult]: any = await connection.execute(
      `INSERT INTO subscriptions (
        subscription_number, customer_id, plan_id, template_id, status,
        start_date, expiry_date, next_billing_date, payment_terms,
        billing_interval, billing_interval_count, subtotal_amount, tax_amount,
        discount_amount, total_recurring_amount, auto_renew, notes,
        created_by, updated_by
      ) VALUES (?, ?, ?, ?, 'quotation', ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?, ?, ?);`,
      [
        subscriptionNumber,
        customer.id,
        template.plan_id || null,
        template.id,
        effectiveStartDate,
        expiryDate,
        nextBillingDate,
        paymentTerms || 'Immediate Payment',
        interval,
        intervalCount,
        subtotalAmount,
        taxAmount,
        totalRecurringAmount,
        autoRenew !== undefined ? Boolean(autoRenew) : true,
        notes || `Issued proposal from quotation template: ${template.name}`,
        currentUser.id,
        currentUser.id,
      ]
    );

    const newSubId = subResult.insertId;

    // 9. Insert Line Items
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

    // 10. Write Audit History Event
    await connection.execute(
      `INSERT INTO subscription_history (
        subscription_id, from_status, to_status, actor_user_id, action, reason, metadata
      ) VALUES (?, NULL, 'quotation', ?, 'quotation_issued', ?, ?);`,
      [
        newSubId,
        currentUser.id,
        `Proposal issued from quotation template '${template.name}' (${validityDays}-day proposal window)`,
        JSON.stringify({ templateId: template.id, templateName: template.name, validityDays, expiryDate }),
      ]
    );

    await connection.commit();

    return jsonSuccess(
      {
        id: newSubId,
        subscriptionNumber,
        status: 'quotation',
        customerId: customer.id,
        customerName: customer.name,
        templateId: template.id,
        templateName: template.name,
        startDate: effectiveStartDate,
        expiryDate,
        totalRecurringAmount,
        message: `Quotation proposal ${subscriptionNumber} successfully issued for ${customer.name}. Valid through ${expiryDate}.`,
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
