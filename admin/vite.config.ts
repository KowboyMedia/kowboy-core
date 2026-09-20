// The admin area's build. `npm run build` compiles the engine with tsc and this app with Vite into
// `dist/admin`, which Core's web process serves under /admin (docs/admin-panel-design.md §3).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: fileURLToPath(new URL('../dist/admin', import.meta.url)),
    emptyOutDir: true,
    sourcemap: true,
    // The charting library is a third of the app and only the Overview page draws with it, so it
    // is split off and fetched when that page opens.
    rolldownOptions: { output: { codeSplitting: true } },
  },
  server: {
    port: 5173,
    // In development the app runs on Vite and talks to a Core started beside it.
    proxy: { '/v1': 'http://127.0.0.1:3000' },
  },
});
