import { resolve } from 'path';
import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  resolve: {
    conditions: ['development', 'browser'],

    alias: {
      '@core': resolve('src/core'),
      '@ui': resolve('src/ui'),
      '@assets': resolve('src/assets'),
    },
  },

  define: { global: 'window' },
  plugins: [glsl()],
  base: './',
});
