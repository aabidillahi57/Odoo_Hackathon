export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  meta?: Record<string, any>;
  error?: string;
  code?: string;
}

export function getCorsHeaders(origin?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };
}

export function jsonResponse(
  statusCode: number,
  payload: ApiResponse,
  extraHeaders: Record<string, string> = {},
  origin?: string
) {
  return {
    statusCode,
    headers: {
      ...getCorsHeaders(origin),
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  };
}

export function jsonSuccess<T>(
  data: T,
  meta?: Record<string, any>,
  statusCode = 200,
  extraHeaders: Record<string, string> = {},
  origin?: string
) {
  return jsonResponse(
    statusCode,
    {
      success: true,
      data,
      meta,
    },
    extraHeaders,
    origin
  );
}

export function jsonError(
  message: string,
  statusCode = 500,
  code?: string,
  extraHeaders: Record<string, string> = {},
  origin?: string
) {
  return jsonResponse(
    statusCode,
    {
      success: false,
      error: message,
      code,
    },
    extraHeaders,
    origin
  );
}

export function handleOptions(origin?: string) {
  return {
    statusCode: 204,
    headers: getCorsHeaders(origin),
    body: '',
  };
}
