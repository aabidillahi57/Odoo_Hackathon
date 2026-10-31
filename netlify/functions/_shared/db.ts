import mysql, { Pool, PoolOptions } from 'mysql2/promise';
import dotenv from 'dotenv';

// Ensure .env is loaded in local execution
dotenv.config();

let pool: Pool | null = null;

export function isDbConfigured(): boolean {
  if (process.env.DATABASE_URL) {
    return true;
  }
  return Boolean(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER);
}

export function getDbPool(): Pool {
  if (pool) {
    return pool;
  }

  if (!isDbConfigured()) {
    throw new Error('Database is not configured. Please set MySQL environment variables in .env');
  }

  if (process.env.DATABASE_URL) {
    pool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      decimalNumbers: true,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    });
    return pool;
  }

  const poolOptions: PoolOptions = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'brightloop_subscriptions',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    decimalNumbers: true,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  };

  pool = mysql.createPool(poolOptions);
  return pool;
}

export async function checkDbHealth(): Promise<{
  connected: boolean;
  latencyMs?: number;
  host?: string;
  error?: string;
}> {
  if (!isDbConfigured()) {
    return {
      connected: false,
      error: 'Database environment variables are not configured in .env',
    };
  }

  const safeHost = process.env.DB_HOST || 'configured-host';
  const start = Date.now();

  try {
    const dbPool = getDbPool();
    // Lightweight ping query
    await dbPool.query('SELECT 1 AS ping;');
    const latencyMs = Date.now() - start;

    return {
      connected: true,
      latencyMs,
      host: safeHost,
    };
  } catch (err: any) {
    return {
      connected: false,
      host: safeHost,
      error: err.code === 'ECONNREFUSED'
        ? `Connection refused to ${safeHost}. Please ensure MySQL is running locally.`
        : err.code === 'ER_ACCESS_DENIED_ERROR'
        ? 'Access denied. Please check your DB_USER and DB_PASSWORD in .env.'
        : 'Could not connect to database.',
    };
  }
}

export async function executeQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const dbPool = getDbPool();
  const [rows] = await dbPool.execute(sql, params);
  return rows as T[];
}
