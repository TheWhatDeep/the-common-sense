import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: { outDir: 'dist', sourcemap: false },
  server: {
    // `npm run dev` serves the UI; API calls go to `npm run worker:dev` on 8788.
    proxy: { '/api': 'http://localhost:8788' },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
