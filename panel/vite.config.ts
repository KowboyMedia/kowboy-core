// The admin panel's browser app (design B): built into dist/panel and served by Core under /admin.
// `npm run dev:panel` serves it with hot reload and hands the API to a Core on port 3000.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/admin/',
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('../dist/panel', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: { '/v1': 'http://localhost:3000' },
  },
});
