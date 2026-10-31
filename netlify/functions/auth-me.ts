import { jsonSuccess, jsonError, handleOptions } from './_shared/response';
import { getAuthenticatedUser } from './_shared/auth';
import { isDbConfigured } from './_shared/db';

export async function handler(event: any) {
  const origin = event.headers.origin || event.headers.Origin;

  if (event.httpMethod === 'OPTIONS') {
    return handleOptions(origin);
  }

  if (event.httpMethod !== 'GET') {
    return jsonError('Method Not Allowed', 405, undefined, {}, origin);
  }

  if (!isDbConfigured()) {
    return jsonError('Database is not configured.', 503, 'DB_NOT_CONFIGURED', {}, origin);
  }

  try {
    const user = await getAuthenticatedUser(event);

    if (!user) {
      return jsonError('Unauthenticated. Please sign in.', 401, 'UNAUTHENTICATED', {}, origin);
    }

    const userProfile = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      customerId: user.customerId,
    };

    return jsonSuccess({ user: userProfile }, undefined, 200, {}, origin);
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR') {
      return jsonError('Database connection unavailable.', 503, 'DB_UNAVAILABLE', {}, origin);
    }
    return jsonError('Failed to fetch user session', 500, undefined, {}, origin);
  }
}
