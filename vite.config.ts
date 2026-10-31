import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Auth routes: /api/auth/login → /.netlify/functions/auth-login
      // Must be declared before the generic /api rule.
      '/api/auth/login': {
        target: 'http://localhost:8888/.netlify/functions/auth-login',
        changeOrigin: true,
        rewrite: () => '',
      },
      '/api/auth/register': {
        target: 'http://localhost:8888/.netlify/functions/auth-register',
        changeOrigin: true,
        rewrite: () => '',
      },
      '/api/auth/logout': {
        target: 'http://localhost:8888/.netlify/functions/auth-logout',
        changeOrigin: true,
        rewrite: () => '',
      },
      '/api/auth/me': {
        target: 'http://localhost:8888/.netlify/functions/auth-me',
        changeOrigin: true,
        rewrite: () => '',
      },
      '/api/auth/forgot-password': {
        target: 'http://localhost:8888/.netlify/functions/auth-forgot-password',
        changeOrigin: true,
        rewrite: () => '',
      },
      '/api/auth/reset-password': {
        target: 'http://localhost:8888/.netlify/functions/auth-reset-password',
        changeOrigin: true,
        rewrite: () => '',
      },
      '/api/auth/create-staff': {
        target: 'http://localhost:8888/.netlify/functions/auth-create-staff',
        changeOrigin: true,
        rewrite: () => '',
      },
      // Dashboard routes
      '/api/dashboard': {
        target: 'http://localhost:8888/.netlify/functions/dashboard',
        changeOrigin: true,
        rewrite: () => '',
      },
      // Discounts routes
      '/api/discounts': {
        target: 'http://localhost:8888/.netlify/functions/discounts',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/discounts/, ''),
      },
      // Payments routes
      '/api/payments': {
        target: 'http://localhost:8888/.netlify/functions/payments',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/payments/, ''),
      },
      // Billing run routes
      '/api/billing/run': {
        target: 'http://localhost:8888/.netlify/functions/billing-run',
        changeOrigin: true,
        rewrite: () => '',
      },
      // Invoices routes
      '/api/invoices': {
        target: 'http://localhost:8888/.netlify/functions/invoices',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/invoices/, ''),
      },
      // Taxes routes
      '/api/taxes': {
        target: 'http://localhost:8888/.netlify/functions/taxes',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/taxes/, ''),
      },
      // Subscription routes
      '/api/subscriptions': {
        target: 'http://localhost:8888/.netlify/functions/subscriptions',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/subscriptions/, ''),
      },
      // Quotation template routes
      '/api/quotation-templates': {
        target: 'http://localhost:8888/.netlify/functions/quotation-templates',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/quotation-templates/, ''),
      },
      // Generic fallback: /api/health → /.netlify/functions/health, etc.
      '/api': {
        target: 'http://localhost:8888/.netlify/functions',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
