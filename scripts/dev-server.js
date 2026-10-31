#!/usr/bin/env node
import http from 'http';
import path from 'path';
import url from 'url';
import dotenv from 'dotenv';
import jitiFactory from 'jiti';

dotenv.config();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const functionsDir = path.resolve(projectRoot, 'netlify/functions');
const jiti = jitiFactory(import.meta.url, { cache: false });

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT || '8888', 10);

function getFunctionFileName(pathname) {
  // 1. Direct /.netlify/functions/:name
  if (pathname.startsWith('/.netlify/functions/')) {
    const fnName = pathname.replace('/.netlify/functions/', '').split('/')[0].split('?')[0];
    return `${fnName}.ts`;
  }

  // 2. Auth routes
  if (pathname === '/api/auth/login') return 'auth-login.ts';
  if (pathname === '/api/auth/register') return 'auth-register.ts';
  if (pathname === '/api/auth/logout') return 'auth-logout.ts';
  if (pathname === '/api/auth/me') return 'auth-me.ts';
  if (pathname === '/api/auth/forgot-password') return 'auth-forgot-password.ts';
  if (pathname === '/api/auth/reset-password') return 'auth-reset-password.ts';
  if (pathname === '/api/auth/create-staff') return 'auth-create-staff.ts';

  // 3. Domain routes
  if (pathname.startsWith('/api/email')) return 'email-settings.ts';
  if (pathname.startsWith('/api/dashboard')) return 'dashboard.ts';
  if (pathname.startsWith('/api/discounts')) return 'discounts.ts';
  if (pathname.startsWith('/api/payments')) return 'payments.ts';
  if (pathname === '/api/billing/run') return 'billing-run.ts';
  if (pathname.startsWith('/api/invoices')) return 'invoices.ts';
  if (pathname.startsWith('/api/taxes')) return 'taxes.ts';
  if (pathname.startsWith('/api/subscriptions')) return 'subscriptions.ts';
  if (pathname.startsWith('/api/quotation-templates')) return 'quotation-templates.ts';
  if (pathname.startsWith('/api/customers')) return 'customers.ts';
  if (pathname.startsWith('/api/plans')) return 'plans.ts';
  if (pathname.startsWith('/api/products')) return 'products.ts';
  if (pathname.startsWith('/api/health')) return 'health.ts';

  // 4. Generic fallback: /api/:name
  const segment = pathname.replace(/^\/api\//, '').split('/')[0].split('?')[0];
  if (segment) {
    return `${segment}.ts`;
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  const reqUrl = req.url || '/';
  const parsedUrl = new URL(reqUrl, `http://${req.headers.host || `localhost:${PORT}`}`);
  const pathname = parsedUrl.pathname;

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
    });
    return res.end();
  }

  const functionFile = getFunctionFileName(pathname);
  if (!functionFile) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: `Route not found: ${pathname}` }));
  }

  const functionPath = path.resolve(functionsDir, functionFile);

  const bodyChunks = [];
  req.on('data', (chunk) => bodyChunks.push(chunk));
  req.on('end', async () => {
    try {
      const rawBody = Buffer.concat(bodyChunks).toString('utf-8');

      const queryStringParameters = {};
      for (const [k, v] of parsedUrl.searchParams.entries()) {
        queryStringParameters[k] = v;
      }

      const event = {
        path: pathname,
        httpMethod: req.method || 'GET',
        headers: req.headers,
        queryStringParameters,
        body: rawBody || null,
      };

      const mod = jiti(functionPath);
      const handler = mod.handler || mod.default;

      if (typeof handler !== 'function') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({ success: false, error: `Handler not exported as a function in ${functionFile}` })
        );
      }

      const response = await handler(event, {});

      const statusCode = response.statusCode || 200;
      const headers = response.headers || {};

      // Ensure CORS headers
      if (!headers['Access-Control-Allow-Origin'] && req.headers.origin) {
        headers['Access-Control-Allow-Origin'] = req.headers.origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
      }

      res.writeHead(statusCode, headers);
      if (response.multiValueHeaders) {
        for (const [key, vals] of Object.entries(response.multiValueHeaders)) {
          if (Array.isArray(vals)) {
            res.setHeader(key, vals);
          }
        }
      }

      res.end(response.body || '');
    } catch (err) {
      console.error(`[Backend Server Error ${pathname}]:`, err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message || 'Internal server error' }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('===========================================================');
  console.log(`🚀 Brightloop Backend Functions Server running on port ${PORT}`);
  console.log(`   Local URL:    http://127.0.0.1:${PORT}`);
  console.log(`   Health Check: http://127.0.0.1:${PORT}/api/health`);
  console.log('===========================================================');
});

