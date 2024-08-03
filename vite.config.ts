import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  resolve: {
    conditions: ['development', 'browser'],
  },
  build: {
    target: 'esnext'
  },

  define: { global: 'window' },
  plugins: [glsl()],
  base: './',
});
