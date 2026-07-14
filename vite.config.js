import { defineConfig } from 'vite';
import base44Plugin from '@base44/vite-plugin';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [base44Plugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});