import { PoolConnection } from 'mysql2/promise';

export interface EvaluatedLineDiscount {
  productId: number;
  variantId?: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotalAmount: number;
  discountAmount: number;
  taxableAmount: number;
  taxId?: number | null;
  taxName?: string | null;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
}

export interface BestDiscountEvaluation {
  discountId: number | null;
  discountCode: string | null;
  discountName: string | null;
  discountType: 'fixed' | 'percentage' | null;
  discountValue: number;
  totalDiscountAmount: number;
  lines: EvaluatedLineDiscount[];
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
}

/**
 * Evaluates active discount rules and deterministically selects the single best eligible rule.
 * No stacking: applies the eligible rule providing the greatest dollar savings.
 * Tie-breaker: Highest discount ID (newest rule).
 *
 * Tax Order: Discounts apply to pre-tax unit amounts BEFORE calculating sales tax.
 * Tax is calculated on the net taxable amount (subtotal - discount).
 */
export async function evaluateBestDiscount(
  connection: PoolConnection,
  params: {
    subscriptionId?: number | null;
    customerId: number;
    lines: Array<{
      productId: number;
      variantId?: number | null;
      description?: string;
      quantity: number;
      unitPrice: number;
      taxId?: number | null;
      taxName?: string | null;
      taxRate: number;
    }>;
    asOfDate?: string;
    preferredDiscountId?: number | null;
  }
): Promise<BestDiscountEvaluation> {
  const asOfDate = params.asOfDate || new Date().toISOString().split('T')[0];

  // 1. Calculate raw base line subtotals
  const baseLines = params.lines.map((l) => {
    const qty = Math.max(Number(l.quantity) || 1, 1);
    const unitPrice = Math.max(Number(l.unitPrice) || 0, 0);
    const taxRate = Math.max(Number(l.taxRate) || 0, 0);
    const subtotal = Math.round(qty * unitPrice * 100) / 100;
    return {
      ...l,
      quantity: qty,
      unitPrice,
      taxRate,
      subtotalAmount: subtotal,
    };
  });

  const totalRawSubtotal = baseLines.reduce((acc, l) => acc + l.subtotalAmount, 0);
  const totalRawQuantity = baseLines.reduce((acc, l) => acc + l.quantity, 0);

  // 2. Query candidate active, unexpired, non-archived discounts with available quota
  const [candidates]: any = await connection.execute(
    `SELECT * FROM discounts
     WHERE is_active = TRUE
       AND archived_at IS NULL
       AND (start_date IS NULL OR start_date <= ?)
       AND (end_date IS NULL OR end_date >= ?)
       AND (max_uses IS NULL OR used_count < max_uses)
     ORDER BY id DESC;`,
    [asOfDate, asOfDate]
  );

  let bestRule: any = null;
  let maxSavings = 0;

  for (const rule of candidates) {
    // If a preferred discount was locked in (e.g. from subscription template), prioritize evaluating it
    const isPreferred = params.preferredDiscountId && Number(rule.id) === Number(params.preferredDiscountId);

    const minPurchase = Number(rule.min_purchase_amount) || 0;
    const minQty = Number(rule.min_quantity) || 1;
    let savings = 0;

    if (rule.applies_to === 'product') {
      const targetProdId = Number(rule.applicable_product_id);
      const matchingLines = baseLines.filter((l) => Number(l.productId) === targetProdId);
      const matchingSubtotal = matchingLines.reduce((sum, l) => sum + l.subtotalAmount, 0);
      const matchingQty = matchingLines.reduce((sum, l) => sum + l.quantity, 0);

      if (matchingQty >= minQty && matchingSubtotal >= minPurchase && matchingSubtotal > 0) {
        if (rule.discount_type === 'percentage') {
          savings = Math.round(matchingSubtotal * (Number(rule.value) / 100) * 100) / 100;
        } else {
          savings = Math.min(matchingSubtotal, Number(rule.value));
        }
      }
    } else {
      // Order level scope
      if (totalRawQuantity >= minQty && totalRawSubtotal >= minPurchase && totalRawSubtotal > 0) {
        if (rule.discount_type === 'percentage') {
          savings = Math.round(totalRawSubtotal * (Number(rule.value) / 100) * 100) / 100;
        } else {
          savings = Math.min(totalRawSubtotal, Number(rule.value));
        }
      }
    }

    if (savings > 0) {
      // Deterministic tie-breaker:
      // 1. Preferred discount wins if eligible
      // 2. Otherwise highest savings
      // 3. If savings equal, highest ID
      if (
        isPreferred ||
        savings > maxSavings ||
        (savings === maxSavings && (!bestRule || Number(rule.id) > Number(bestRule.id)))
      ) {
        maxSavings = savings;
        bestRule = rule;
        if (isPreferred) break; // Preferred rule takes precedence
      }
    }
  }

  // 3. Compute itemized line discounts and tax on net taxable base
  let totalDistributedDiscount = 0;
  const evaluatedLines: EvaluatedLineDiscount[] = [];

  if (bestRule && maxSavings > 0) {
    if (bestRule.applies_to === 'product') {
      const targetProdId = Number(bestRule.applicable_product_id);
      let remainingSavings = maxSavings;

      for (let i = 0; i < baseLines.length; i++) {
        const l = baseLines[i];
        let lineDiscount = 0;

        if (Number(l.productId) === targetProdId && remainingSavings > 0) {
          if (bestRule.discount_type === 'percentage') {
            lineDiscount = Math.round(l.subtotalAmount * (Number(bestRule.value) / 100) * 100) / 100;
          } else {
            lineDiscount = Math.min(l.subtotalAmount, remainingSavings);
          }
          lineDiscount = Math.min(lineDiscount, remainingSavings);
          lineDiscount = Math.min(lineDiscount, l.subtotalAmount);
          remainingSavings = Math.round((remainingSavings - lineDiscount) * 100) / 100;
        }

        const taxable = Math.max(0, Math.round((l.subtotalAmount - lineDiscount) * 100) / 100);
        const tax = Math.round(taxable * (l.taxRate / 100) * 100) / 100;
        const total = Math.round((taxable + tax) * 100) / 100;

        totalDistributedDiscount += lineDiscount;
        evaluatedLines.push({
          productId: l.productId,
          variantId: l.variantId,
          description: l.description || 'Subscription Item',
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          subtotalAmount: l.subtotalAmount,
          discountAmount: lineDiscount,
          taxableAmount: taxable,
          taxId: l.taxId,
          taxName: l.taxName,
          taxRate: l.taxRate,
          taxAmount: tax,
          totalAmount: total,
        });
      }
    } else {
      // Order scope: allocate proportionally across all lines
      let allocatedDiscount = 0;

      for (let i = 0; i < baseLines.length; i++) {
        const l = baseLines[i];
        let lineDiscount = 0;

        if (totalRawSubtotal > 0) {
          if (i === baseLines.length - 1) {
            // Last line gets remainder to avoid rounding drift
            lineDiscount = Math.round((maxSavings - allocatedDiscount) * 100) / 100;
          } else {
            const ratio = l.subtotalAmount / totalRawSubtotal;
            lineDiscount = Math.round(maxSavings * ratio * 100) / 100;
            allocatedDiscount += lineDiscount;
          }
          lineDiscount = Math.min(lineDiscount, l.subtotalAmount);
        }

        const taxable = Math.max(0, Math.round((l.subtotalAmount - lineDiscount) * 100) / 100);
        const tax = Math.round(taxable * (l.taxRate / 100) * 100) / 100;
        const total = Math.round((taxable + tax) * 100) / 100;

        totalDistributedDiscount += lineDiscount;
        evaluatedLines.push({
          productId: l.productId,
          variantId: l.variantId,
          description: l.description || 'Subscription Item',
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          subtotalAmount: l.subtotalAmount,
          discountAmount: lineDiscount,
          taxableAmount: taxable,
          taxId: l.taxId,
          taxName: l.taxName,
          taxRate: l.taxRate,
          taxAmount: tax,
          totalAmount: total,
        });
      }
    }
  } else {
    // No discount eligible
    for (const l of baseLines) {
      const taxable = l.subtotalAmount;
      const tax = Math.round(taxable * (l.taxRate / 100) * 100) / 100;
      const total = Math.round((taxable + tax) * 100) / 100;

      evaluatedLines.push({
        productId: l.productId,
        variantId: l.variantId,
        description: l.description || 'Subscription Item',
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        subtotalAmount: l.subtotalAmount,
        discountAmount: 0.0,
        taxableAmount: taxable,
        taxId: l.taxId,
        taxName: l.taxName,
        taxRate: l.taxRate,
        taxAmount: tax,
        totalAmount: total,
      });
    }
  }

  const subtotalSum = Math.round(evaluatedLines.reduce((acc, l) => acc + l.subtotalAmount, 0) * 100) / 100;
  const discountSum = Math.round(evaluatedLines.reduce((acc, l) => acc + l.discountAmount, 0) * 100) / 100;
  const taxSum = Math.round(evaluatedLines.reduce((acc, l) => acc + l.taxAmount, 0) * 100) / 100;
  const totalSum = Math.round(evaluatedLines.reduce((acc, l) => acc + l.totalAmount, 0) * 100) / 100;

  return {
    discountId: bestRule ? Number(bestRule.id) : null,
    discountCode: bestRule ? bestRule.code : null,
    discountName: bestRule ? bestRule.name || bestRule.code : null,
    discountType: bestRule ? bestRule.discount_type : null,
    discountValue: bestRule ? Number(bestRule.value) : 0,
    totalDiscountAmount: discountSum,
    lines: evaluatedLines,
    subtotalAmount: subtotalSum,
    taxAmount: taxSum,
    totalAmount: totalSum,
  };
}

/**
 * Reserves a discount usage slot for a draft or newly generated invoice.
 * Concurrency-safe: uses row-level locking on discounts table.
 * Idempotent: checks existing usage so retries do not consume duplicate slots.
 */
export async function reserveDiscountUsage(
  connection: PoolConnection,
  params: {
    discountId: number;
    invoiceId: number;
    customerId: number;
    subscriptionId?: number | null;
    amountApplied: number;
    immediateRedeem?: boolean;
  }
): Promise<boolean> {
  const { discountId, invoiceId, customerId, subscriptionId, amountApplied, immediateRedeem = false } = params;

  // 1. Check idempotency: does usage already exist for this invoice?
  const [existing]: any = await connection.execute(
    'SELECT id, status FROM discount_usages WHERE discount_id = ? AND invoice_id = ? LIMIT 1;',
    [discountId, invoiceId]
  );

  if (existing && existing.length > 0) {
    if (immediateRedeem && existing[0].status === 'reserved') {
      await connection.execute(
        "UPDATE discount_usages SET status = 'redeemed' WHERE id = ?;",
        [existing[0].id]
      );
    }
    return true; // Already reserved/redeemed idempotently
  }

  // 2. Lock discount row to ensure usage quota is not exceeded concurrently
  const [discountRows]: any = await connection.execute(
    'SELECT id, max_uses, used_count FROM discounts WHERE id = ? FOR UPDATE;',
    [discountId]
  );

  if (!discountRows || discountRows.length === 0) {
    return false;
  }

  const discount = discountRows[0];
  if (discount.max_uses !== null && discount.used_count >= discount.max_uses) {
    return false; // Quota reached
  }

  // 3. Record usage entry
  const usageStatus = immediateRedeem ? 'redeemed' : 'reserved';
  await connection.execute(
    `INSERT INTO discount_usages (
      discount_id, subscription_id, invoice_id, customer_id,
      amount_applied, status, used_at
    ) VALUES (?, ?, ?, ?, ?, ?, NOW());`,
    [discountId, subscriptionId || null, invoiceId, customerId, amountApplied.toFixed(2), usageStatus]
  );

  // 4. Increment used_count
  await connection.execute(
    'UPDATE discounts SET used_count = used_count + 1, updated_at = NOW() WHERE id = ?;',
    [discountId]
  );

  return true;
}

/**
 * Transitions reserved discount usage to redeemed upon invoice confirmation.
 */
export async function redeemDiscountUsage(
  connection: PoolConnection,
  invoiceId: number
): Promise<void> {
  await connection.execute(
    "UPDATE discount_usages SET status = 'redeemed' WHERE invoice_id = ? AND status = 'reserved';",
    [invoiceId]
  );
}

/**
 * Releases reserved or redeemed discount usage upon invoice cancellation.
 * Decrements used_count on the discount rule so quota is recovered.
 */
export async function releaseDiscountUsage(
  connection: PoolConnection,
  invoiceId: number
): Promise<void> {
  const [usages]: any = await connection.execute(
    "SELECT id, discount_id, status FROM discount_usages WHERE invoice_id = ? AND status IN ('reserved', 'redeemed');",
    [invoiceId]
  );

  if (!usages || usages.length === 0) {
    return;
  }

  for (const u of usages) {
    // Lock discount and decrement quota
    await connection.execute(
      'UPDATE discounts SET used_count = GREATEST(0, used_count - 1), updated_at = NOW() WHERE id = ?;',
      [u.discount_id]
    );

    await connection.execute(
      "UPDATE discount_usages SET status = 'released', released_at = NOW() WHERE id = ?;",
      [u.id]
    );
  }
}

