import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig } from 'tsup';

const require = createRequire(import.meta.url);
const coreDist = join(dirname(require.resolve('@primavista/core/package.json')), 'dist');

/** Static demo for GitHub Pages. Everything is bundled, the page needs no server. */
export default defineConfig({
  entry: {
    'assets/vanilla': 'src/vanilla.ts',
    'assets/react-island': '../demo/assets/react/island.tsx',
  },
  outDir: 'dist',
  format: ['esm'],
  splitting: false,
  clean: true,
  minify: true,
  sourcemap: false,
  target: 'es2022',
  platform: 'browser',
  noExternal: [/.*/],
  define: { 'process.env.NODE_ENV': '"production"' },
  esbuildOptions(options) {
    options.conditions = ['production', 'browser', 'import', 'default'];
    options.legalComments = 'none';
  },
  onSuccess: async () => {
    mkdirSync('dist/assets', { recursive: true });
    const themes = readdirSync(join(coreDist, 'themes'))
      .sort()
      .map((file) => readFileSync(join(coreDist, 'themes', file), 'utf8'))
      .join('\n');
    writeFileSync('dist/assets/primavista.css', readFileSync(join(coreDist, 'primavista.css'), 'utf8') + '\n' + themes);
    for (const file of readdirSync('public')) copyFileSync(join('public', file), join('dist', file));
    copyFileSync('../docs/assets/logo.svg', 'dist/assets/logo.svg');
    writeFileSync('dist/.nojekyll', '');
  },
});
