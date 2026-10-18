import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./apps/web', import.meta.url)) } },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/worker/src/**/*.test.ts', 'apps/web/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/.next/**'],
  },
});
