import path from 'path';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';

export default defineConfig({
  plugins: [devtools(), solidPlugin()],
  resolve: {
    alias: {
      // Use local build of spa-solid-shoelace so we can extend configureMarked
      '@retrofit-ui/spa-solid-shoelace/components': path.resolve(
        __dirname,
        '../retrofit-ui/packages/spa-solid-shoelace/dist/components/spec-renderer.js',
      ),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
