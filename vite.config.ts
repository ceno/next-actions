import { defineConfig, type Plugin } from 'vite';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Copies the files that are fetched by URL rather than imported:
 * `public/strings/*.json` into `dist/strings/`, and `public/icon.png` into
 * `dist/`, all under their own UNHASHED names.
 *
 * Needed because `publicDir` is off, so Vite emits only the HTML entry points
 * and what they import. Nothing imports these. The names cannot be hashed
 * either: the locale URL is built from `LOCALIZATION.resourceUrl` at runtime,
 * and the icon URL is registered in Trello's admin UI by hand. A hash in either
 * is a URL nobody can guess.
 *
 * The icon in particular is load-bearing and was silently missing: with
 * `emptyOutDir` on, every clean build deleted the copy that had been put in
 * `dist/` by hand, Trello's `GET /icon.png` 404ed, and the Power-Up rendered in
 * Trello's own menus as a nameless blank row.
 *
 * The dev server needs none of this: it serves anything under `root` already,
 * which is exactly why the gap does not show up until production.
 */
function staticAssets(): Plugin {
  const stringsDir = resolve(__dirname, 'public/strings');
  return {
    name: 'next-actions:static-assets',
    generateBundle() {
      for (const file of readdirSync(stringsDir).filter((f) => f.endsWith('.json'))) {
        this.emitFile({
          type: 'asset',
          fileName: `strings/${file}`,
          source: readFileSync(resolve(stringsDir, file), 'utf8'),
        });
      }
      // Binary, so it must be emitted as bytes and never as a UTF-8 string.
      this.emitFile({
        type: 'asset',
        fileName: 'icon.png',
        source: readFileSync(resolve(__dirname, 'public/icon.png')),
      });
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
  plugins: [staticAssets()],
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
        // Dev-only. Harmless in dist, and it is the quickest way to look at the
        // badge output on a machine that has never registered a Power-Up.
        preview: resolve(__dirname, 'public/preview.html'),
        spike: resolve(__dirname, 'public/spike.html'),
        spikeReport: resolve(__dirname, 'public/spike-report.html'),
      },
    },
  },
});
