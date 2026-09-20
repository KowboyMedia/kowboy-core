// The admin panel's build: a React app compiled into static files under admin/dist, which the
// web process serves under /admin (engine/admin-api/static.ts). In development `npm run dev:admin`
// serves it from here and passes API calls to a running web process.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: here,
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': `${here}src` } },
  build: {
    outDir: `${here}dist`,
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        // The libraries in chunks of their own, so a change to the app's own code is a small download.
        manualChunks: {
          react: [
            'react',
            'react-dom',
            'react-router',
            '@tanstack/react-query',
            '@tanstack/react-table',
          ],
          ui: ['radix-ui', 'cmdk', 'sonner', 'lucide-react'],
          charts: ['recharts'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/v1': { target: process.env['CORE_URL'] ?? 'http://127.0.0.1:3000', changeOrigin: false },
    },
  },
});
