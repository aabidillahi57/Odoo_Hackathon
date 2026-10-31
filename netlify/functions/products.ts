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
    // 1. Fetch active products
    const rawProducts = await executeQuery<any>(
      `SELECT id, name, type, sales_price, cost_price, notes, is_active
       FROM products
       WHERE is_active = TRUE
       ORDER BY id ASC;`
    );

    // 2. Fetch active variants
    const rawVariants = await executeQuery<any>(
      `SELECT id, product_id, attribute_name, attribute_value, price_adjustment, sku, is_active
       FROM product_variants
       WHERE is_active = TRUE
       ORDER BY product_id, id ASC;`
    );

    // 3. Map variants to their corresponding products
    const variantMap: Record<number, any[]> = {};
    for (const v of rawVariants) {
      if (!variantMap[v.product_id]) {
        variantMap[v.product_id] = [];
      }
      variantMap[v.product_id].push({
        id: v.id,
        productId: v.product_id,
        attributeName: v.attribute_name,
        attributeValue: v.attribute_value,
        priceAdjustment: Number(v.price_adjustment),
        sku: v.sku,
        isActive: Boolean(v.is_active),
      });
    }

    const products = rawProducts.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      salesPrice: Number(p.sales_price),
      costPrice: Number(p.cost_price),
      notes: p.notes,
      isActive: Boolean(p.is_active),
      variants: variantMap[p.id] || [],
    }));

    return jsonSuccess(products, { count: products.length });
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR') {
      return jsonError('Database connection error. Please verify local MySQL is running.', 503, 'DB_UNAVAILABLE');
    }
    return jsonError('Failed to fetch products from database', 500);
  }
}
