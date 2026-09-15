import { defineConfig, type Plugin } from 'vite';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Copies `public/strings/*.json` into `dist/strings/` under their own names.
 *
 * Needed because `publicDir` is off, so Vite emits only the HTML entry points and
 * what they import - the locale bundles are fetched at runtime by URL and are
 * imported by nothing. They must also keep UNHASHED names, because the URL is
 * built from `LOCALIZATION.resourceUrl` at runtime and a hash cannot be guessed.
 *
 * The dev server needs none of this: it serves anything under `root` already,
 * which is exactly why the gap does not show up until production.
 */
function localeBundles(): Plugin {
  const dir = resolve(__dirname, 'public/strings');
  return {
    name: 'next-actions:locale-bundles',
    generateBundle() {
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
        this.emitFile({
          type: 'asset',
          fileName: `strings/${file}`,
          source: readFileSync(resolve(dir, file), 'utf8'),
        });
      }
    },
  };
}

/**
 * Static site, zero runtime dependencies. The Trello client library is loaded
 * from p.trellocdn.com by a <script> tag and is never bundled.
 *
 * Root is `public/` so that the built connector sits at the SITE ROOT: the
 * registered Connector URL is then `https://host/` and not `https://host/public/`.
 * `src/` lives outside the root, hence the fs.allow entry for the dev server.
 */
export default defineConfig({
  // Relative asset URLs, so the connector works whether it is hosted at a domain
  // root or on a subpath (a GitHub Pages project site, a preview deploy).
  base: './',
  root: 'public',
  publicDir: false,
  plugins: [localeBundles()],
  server: { fs: { allow: ['..'] } },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      input: {
        connector: resolve(__dirname, 'public/index.html'),
        settings: resolve(__dirname, 'public/settings.html'),
        authorize: resolve(__dirname, 'public/authorize.html'),
        spike: resolve(__dirname, 'public/spike.html'),
        spikeReport: resolve(__dirname, 'public/spike-report.html'),
      },
    },
  },
});
