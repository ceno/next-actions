import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * Static site, zero runtime dependencies. The Trello client library is loaded
 * from p.trellocdn.com by a <script> tag and is never bundled.
 *
 * Root is `public/` so that the built connector sits at the SITE ROOT: the
 * registered Connector URL is then `https://host/` and not `https://host/public/`.
 * `src/` lives outside the root, hence the fs.allow entry for the dev server.
 */
export default defineConfig({
  root: 'public',
  publicDir: false,
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
      },
    },
  },
});
