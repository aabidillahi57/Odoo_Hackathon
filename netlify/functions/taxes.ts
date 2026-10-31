import { executeQuery, isDbConfigured } from './_shared/db';
import { jsonSuccess, jsonError, handleOptions } from './_shared/response';
import { getAuthenticatedUser } from './_shared/auth';

function parseTaxPath(path: string): { id?: number } {
  const cleanPath = path.replace(/^(\/\.netlify\/functions|\/api)?\/taxes\/?/, '');
  const segments = cleanPath.split('/').filter(Boolean);
  if (segments.length === 0) return {};
  const id = parseInt(segments[0], 10);
  if (!isNaN(id)) {
    return { id };
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
    return jsonError('Authentication required to access tax rules.', 401, 'UNAUTHORIZED', {}, origin);
  }

  const pathInfo = parseTaxPath(event.path || '');
  const queryId = event.queryStringParameters?.id ? parseInt(event.queryStringParameters.id, 10) : undefined;
  const taxId = pathInfo.id || queryId;

  try {
    // -------------------------------------------------------------------------
    // 1. GET /api/taxes & GET /api/taxes/:id
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'GET') {
      if (taxId) {
        const rows: any = await executeQuery('SELECT * FROM taxes WHERE id = ?;', [taxId]);
        if (!rows || rows.length === 0) {
          return jsonError(`Tax rule with ID ${taxId} not found.`, 404, 'TAX_NOT_FOUND', {}, origin);
        }
        const tax = rows[0];
        return jsonSuccess(
          {
            tax: {
              id: tax.id,
              name: tax.name,
              ratePercentage: Number(tax.rate_percentage),
              description: tax.description || '',
              isActive: Boolean(tax.is_active),
              createdAt: tax.created_at,
              updatedAt: tax.updated_at,
            },
          },
          undefined,
          200,
          {},
          origin
        );
      }

      // List taxes
      const activeOnly = currentUser.role === 'customer' || event.queryStringParameters?.active_only === 'true';
      let sql = 'SELECT * FROM taxes';
      const params: any[] = [];

      if (activeOnly) {
        sql += ' WHERE is_active = TRUE';
      }
      sql += ' ORDER BY id ASC;';

      const rows: any = await executeQuery(sql, params);
      const taxes = rows.map((tax: any) => ({
        id: tax.id,
        name: tax.name,
        ratePercentage: Number(tax.rate_percentage),
        description: tax.description || '',
        isActive: Boolean(tax.is_active),
        createdAt: tax.created_at,
        updatedAt: tax.updated_at,
      }));

      return jsonSuccess({ taxes, count: taxes.length }, undefined, 200, {}, origin);
    }

    // -------------------------------------------------------------------------
    // 2. POST /api/taxes — Admin Only
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'POST') {
      if (currentUser.role !== 'admin') {
        return jsonError(
          'Permission denied. Only Administrator accounts can create tax rules.',
          403,
          'FORBIDDEN',
          {},
          origin
        );
      }

      let body: any = {};
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return jsonError('Invalid JSON request body.', 400, 'INVALID_JSON', {}, origin);
      }

      const name = String(body.name || '').trim();
      if (!name) {
        return jsonError('Tax rule name is required.', 400, 'VALIDATION_ERROR', { field: 'name' }, origin);
      }

      if (body.ratePercentage === undefined || body.ratePercentage === null || isNaN(Number(body.ratePercentage))) {
        return jsonError('Tax rate percentage is required and must be numeric.', 400, 'VALIDATION_ERROR', { field: 'ratePercentage' }, origin);
      }

      const rate = Number(body.ratePercentage);
      if (rate < 0 || rate > 100) {
        return jsonError('Tax rate percentage must be between 0.00% and 100.00%.', 400, 'VALIDATION_ERROR', { field: 'ratePercentage' }, origin);
      }

      const description = body.description ? String(body.description).trim().slice(0, 255) : null;
      const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;

      const result: any = await executeQuery(
        'INSERT INTO taxes (name, rate_percentage, description, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW());',
        [name, rate.toFixed(2), description, isActive]
      );

      const insertedId = result.insertId;
      return jsonSuccess(
        {
          message: 'Tax rule created successfully.',
          tax: {
            id: insertedId,
            name,
            ratePercentage: rate,
            description: description || '',
            isActive,
          },
        },
        undefined,
        201,
        {},
        origin
      );
    }

    // -------------------------------------------------------------------------
    // 3. PUT /api/taxes/:id — Admin Only
    // -------------------------------------------------------------------------
    if (event.httpMethod === 'PUT' || event.httpMethod === 'PATCH') {
      if (currentUser.role !== 'admin') {
        return jsonError(
          'Permission denied. Only Administrator accounts can modify or deactivate tax rules.',
          403,
          'FORBIDDEN',
          {},
          origin
        );
      }

      if (!taxId) {
        return jsonError('Tax rule ID is required in URL.', 400, 'MISSING_ID', {}, origin);
      }

      const existingRows: any = await executeQuery('SELECT * FROM taxes WHERE id = ?;', [taxId]);
      if (!existingRows || existingRows.length === 0) {
        return jsonError(`Tax rule with ID ${taxId} not found.`, 404, 'TAX_NOT_FOUND', {}, origin);
      }
      const existing = existingRows[0];

      let body: any = {};
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return jsonError('Invalid JSON request body.', 400, 'INVALID_JSON', {}, origin);
      }

      const updatedName = body.name !== undefined ? String(body.name).trim() : existing.name;
      if (!updatedName) {
        return jsonError('Tax rule name cannot be empty.', 400, 'VALIDATION_ERROR', { field: 'name' }, origin);
      }

      let updatedRate = Number(existing.rate_percentage);
      if (body.ratePercentage !== undefined) {
        if (isNaN(Number(body.ratePercentage))) {
          return jsonError('Tax rate percentage must be numeric.', 400, 'VALIDATION_ERROR', { field: 'ratePercentage' }, origin);
        }
        updatedRate = Number(body.ratePercentage);
        if (updatedRate < 0 || updatedRate > 100) {
          return jsonError('Tax rate percentage must be between 0.00% and 100.00%.', 400, 'VALIDATION_ERROR', { field: 'ratePercentage' }, origin);
        }
      }

      const updatedDescription = body.description !== undefined ? String(body.description).trim().slice(0, 255) : existing.description;
      const updatedActive = body.isActive !== undefined ? Boolean(body.isActive) : Boolean(existing.is_active);

      await executeQuery(
        'UPDATE taxes SET name = ?, rate_percentage = ?, description = ?, is_active = ?, updated_at = NOW() WHERE id = ?;',
        [updatedName, updatedRate.toFixed(2), updatedDescription, updatedActive, taxId]
      );

      return jsonSuccess(
        {
          message: 'Tax rule updated successfully.',
          tax: {
            id: taxId,
            name: updatedName,
            ratePercentage: updatedRate,
            description: updatedDescription || '',
            isActive: updatedActive,
          },
        },
        undefined,
        200,
        {},
        origin
      );
    }

    return jsonError(`HTTP method ${event.httpMethod} not allowed.`, 405, 'METHOD_NOT_ALLOWED', {}, origin);
  } catch (error: any) {
    console.error('Error in taxes function:', error);
    return jsonError('Internal server error managing tax rules.', 500, 'INTERNAL_SERVER_ERROR', { details: error.message }, origin);
  }
}
