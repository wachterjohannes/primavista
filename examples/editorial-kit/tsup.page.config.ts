import { copyFileSync, mkdirSync } from 'node:fs';
import { defineConfig } from 'tsup';

/** Bundles the browser test page into dist-page, one self-contained script. */
export default defineConfig({
  entry: { main: 'page/main.ts' },
  outDir: 'dist-page',
  format: ['esm'],
  clean: true,
  target: 'es2022',
  platform: 'browser',
  noExternal: [/.*/],
  define: { 'process.env.NODE_ENV': '"production"' },
  onSuccess: async () => {
    mkdirSync('dist-page', { recursive: true });
    copyFileSync('page/index.html', 'dist-page/index.html');
    copyFileSync('../../packages/core/src/primavista.css', 'dist-page/primavista.css');
  },
});
