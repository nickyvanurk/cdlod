import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  resolve: {
    conditions: ['development', 'browser'],
  },

  define: { global: 'window' },
  plugins: [glsl()],
  base: './',
});
