import { defineConfig } from 'tsup';

/**
 * The React island is bundled the way Sulu bundles its admin: one
 * self-contained file with React inside. AssetMapper only serves it.
 */
export default defineConfig({
  entry: { 'react-island': 'assets/react/island.tsx' },
  outDir: 'assets/build',
  format: ['esm'],
  sourcemap: false,
  clean: true,
  minify: true,
  target: 'es2022',
  platform: 'browser',
  noExternal: [/.*/],
  define: { 'process.env.NODE_ENV': '"production"' },
  esbuildOptions(options) {
    options.conditions = ['production', 'browser', 'import', 'default'];
    options.legalComments = 'none';
  },
});
