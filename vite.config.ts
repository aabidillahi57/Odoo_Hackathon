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
      // Generic fallback: /api/health → /.netlify/functions/health, etc.
      '/api': {
        target: 'http://localhost:8888/.netlify/functions',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
