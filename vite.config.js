import { defineConfig } from 'vite';
import base44Plugin from '@base44/vite-plugin';

export default defineConfig({
  plugins: [base44Plugin()],
  server: {
    host: '0.0.0.0',
  },
});