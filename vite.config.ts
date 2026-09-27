import fs from 'fs';
import path from 'path';
import { defineConfig, type PluginOption } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const localShoelace = path.resolve(
  __dirname,
  '../retrofit-ui/packages/spa-solid-shoelace/dist/components/spec-renderer.js',
);

// Two build targets share this config:
//   `vite build`                 → dist/          multi-file SPA for GitHub Pages
//   `vite build --mode artifact` → dist-artifact/ one self-contained chalk.html for
//                                  publishing as a Claude artifact (.env.artifact sets
//                                  VITE_TARGET=artifact, which src/target.ts reads).
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact';

  const plugins: PluginOption[] = [
    mode === 'development' && devtools(),
    solidPlugin(),
    tailwindcss(),
    // Inlines every script/style/asset into index.html: the artifact sandbox cannot load
    // sibling files, only what is in the single published document.
    artifact && viteSingleFile({ removeViteModuleLoader: true }),
    artifact && singleFileExtras(),
  ];

  return {
    // VITE_BASE=/chalk-app/ for GitHub Pages; unset (defaults to /) for custom domain.
    // The artifact has no origin of its own, so everything must be relative.
    base: artifact ? './' : process.env.VITE_BASE ?? '/',
    plugins,
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
      ...(artifact
        ? {
            outDir: 'dist-artifact',
            // Fonts and images become data: URIs (allowed by the artifact CSP) instead of files.
            assetsInlineLimit: Number.MAX_SAFE_INTEGER,
            cssCodeSplit: false,
            // Never leave the artifact half-built next to a stale copy.
            emptyOutDir: true,
            rollupOptions: {
              treeshake: {
                // chat.ts only reaches the SDK behind `IS_ARTIFACT ? … : …`, which folds to the
                // artifact branch here, but Rollup still keeps the SDK for its top-level side
                // effects. Nothing in this build can use it (the sandbox blocks the API origin).
                moduleSideEffects: (id) => !id.includes('@anthropic-ai/sdk'),
              },
            },
          }
        : {}),
    },
    test: {
      environment: 'node',
      globals: true,
      // Playwright specs live in e2e/ and run via `pnpm test:e2e`.
      exclude: ['**/node_modules/**', 'e2e/**'],
    },
  };
});

// What vite-plugin-singlefile leaves undone: `<link href>` assets referenced from index.html
// (the favicon) are not inlined, and the output is named index.html. Runs after singlefile.
function singleFileExtras(): PluginOption {
  const favicon = path.resolve(__dirname, 'src/assets/favicon.svg');
  return {
    name: 'chalk:singlefile-extras',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const dataUri = `data:image/svg+xml;base64,${fs.readFileSync(favicon).toString('base64')}`;
        return html.replace(/<link rel="icon"[^>]*href="[^"]*"/, (tag) => tag.replace(/href="[^"]*"/, `href="${dataUri}"`));
      },
    },
    generateBundle(_, bundle) {
      // Everything else is now inside the HTML; a stray file would silently fail to load in the sandbox.
      for (const name of Object.keys(bundle)) {
        if (!name.endsWith('.html')) delete bundle[name];
      }
    },
    closeBundle() {
      const dir = path.resolve(__dirname, 'dist-artifact');
      const from = path.join(dir, 'index.html');
      if (fs.existsSync(from)) fs.renameSync(from, path.join(dir, 'chalk.html'));
    },
  };
}
