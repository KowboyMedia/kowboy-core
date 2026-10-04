// The forms widget's build (docs/forms.md, "The widget"): one plain script, no framework, with
// its stylesheet inlined for the shadow root, into `dist/widget/forms.js`, which Core's web
// process serves at /widget/forms.js (engine/http/forms.ts). `npm run build` runs it.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  build: {
    outDir: fileURLToPath(new URL('../../dist/widget', import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
    lib: {
      entry: fileURLToPath(new URL('./src/main.ts', import.meta.url)),
      name: 'CoreForms',
      formats: ['iife'],
      fileName: () => 'forms.js',
    },
  },
});
