import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';

const localShoelace = path.resolve(
  __dirname,
  '../retrofit-ui/packages/spa-solid-shoelace/dist/components/spec-renderer.js',
);

export default defineConfig({
  // VITE_BASE=/chalk-app/ for GitHub Pages; unset (defaults to /) for custom domain
  base: process.env.VITE_BASE ?? '/',
  plugins: [devtools(), solidPlugin()],
  resolve: {
    alias: {
      // Prefer the sibling monorepo build when available (local dev);
      // fall back to the published npm package in CI and standalone installs.
      ...(fs.existsSync(localShoelace)
        ? { '@retrofit-ui/spa-solid-shoelace/components': localShoelace }
        : {}),
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
