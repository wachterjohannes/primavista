import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  platform: 'browser',
  external: [/^lexical$/, /^@lexical\//],
  onSuccess: async () => {
    copyFileSync('src/primavista.css', 'dist/primavista.css');
    mkdirSync('dist/themes', { recursive: true });
    for (const file of readdirSync('src/themes')) {
      copyFileSync(`src/themes/${file}`, `dist/themes/${file}`);
    }
  },
});
