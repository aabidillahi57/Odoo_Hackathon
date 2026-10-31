import { checkDbHealth } from './_shared/db';
import { jsonSuccess, jsonError, handleOptions } from './_shared/response';

export async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  if (event.httpMethod !== 'GET') {
    return jsonError('Method Not Allowed', 405);
  }

  try {
    const dbStatus = await checkDbHealth();

    const healthData = {
      status: 'ok',
      service: 'Brightloop Subscription Management API',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: dbStatus,
    };

    return jsonSuccess(healthData, undefined, 200);
  } catch (error: any) {
    return jsonError('Failed to check service health', 500);
  }
}
