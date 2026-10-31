export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  meta?: Record<string, any>;
  error?: string;
  code?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function jsonResponse(statusCode: number, payload: ApiResponse) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(payload),
  };
}

export function jsonSuccess<T>(data: T, meta?: Record<string, any>, statusCode = 200) {
  return jsonResponse(statusCode, {
    success: true,
    data,
    meta,
  });
}

export function jsonError(message: string, statusCode = 500, code?: string) {
  return jsonResponse(statusCode, {
    success: false,
    error: message,
    code,
  });
}

export function handleOptions() {
  return {
    statusCode: 204,
    headers: CORS_HEADERS,
    body: '',
  };
}
