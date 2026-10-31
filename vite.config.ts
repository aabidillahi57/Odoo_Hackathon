import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import dotenv from 'dotenv';
import jitiFactory from 'jiti';

dotenv.config();

const jiti = jitiFactory(import.meta.url, { cache: false });

function getFunctionFileName(pathname: string): string | null {
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

/**
 * Vite Dev Middleware: In-process Netlify Functions runner.
 * Eliminates ECONNREFUSED proxy errors when Vite runs without an external backend process.
 */
function netlifyFunctionsPlugin() {
  return {
    name: 'netlify-functions-middleware',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const rawUrl = req.url || '';
        if (!rawUrl.startsWith('/api') && !rawUrl.startsWith('/.netlify/functions')) {
          return next();
        }

        const urlObj = new URL(rawUrl, `http://${req.headers.host || 'localhost:5173'}`);
        const pathname = urlObj.pathname;
        const functionFile = getFunctionFileName(pathname);

        if (!functionFile) {
          return next();
        }

        const functionPath = path.resolve(process.cwd(), 'netlify/functions', functionFile);

        const bodyChunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => bodyChunks.push(chunk));
        req.on('end', async () => {
          try {
            const rawBody = Buffer.concat(bodyChunks).toString('utf-8');
            const queryStringParameters: Record<string, string> = {};
            for (const [k, v] of urlObj.searchParams.entries()) {
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
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: false, error: `Handler not exported in ${functionFile}` }));
            }

            const response = await handler(event, {});
            const statusCode = response.statusCode || 200;
            const headers = response.headers || {};

            // Ensure CORS & cookie headers
            if (!headers['Access-Control-Allow-Origin'] && req.headers.origin) {
              headers['Access-Control-Allow-Origin'] = req.headers.origin;
              headers['Access-Control-Allow-Credentials'] = 'true';
            }

            res.statusCode = statusCode;
            for (const [k, v] of Object.entries(headers)) {
              if (v !== undefined && v !== null) {
                res.setHeader(k, v as any);
              }
            }
            if (response.multiValueHeaders) {
              for (const [key, vals] of Object.entries(response.multiValueHeaders)) {
                if (Array.isArray(vals)) {
                  res.setHeader(key, vals);
                }
              }
            }

            res.end(response.body || '');
          } catch (err: any) {
            console.error(`[Vite Functions Middleware Error ${pathname}]:`, err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message || 'Internal server error' }));
          }
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), netlifyFunctionsPlugin()],
  server: {
    port: 5173,
    host: true,
  },
});

