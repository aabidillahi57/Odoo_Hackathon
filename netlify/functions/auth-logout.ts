import { jsonSuccess, jsonError, handleOptions } from './_shared/response';
import { revokeSession, buildClearSessionCookie } from './_shared/auth';

export async function handler(event: any) {
  const origin = event.headers.origin || event.headers.Origin;

  if (event.httpMethod === 'OPTIONS') {
    return handleOptions(origin);
  }

  if (event.httpMethod !== 'POST') {
    return jsonError('Method Not Allowed', 405, undefined, {}, origin);
  }

  try {
    await revokeSession(event);
    const clearCookie = buildClearSessionCookie();

    return jsonSuccess(
      { message: 'Logged out successfully' },
      undefined,
      200,
      { 'Set-Cookie': clearCookie },
      origin
    );
  } catch {
    return jsonError('Logout failed', 500, undefined, {}, origin);
  }
}
