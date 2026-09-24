import { copyFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  platform: 'browser',
  external: ['@primavista/core', /^lexical$/, /^@lexical\//],
  onSuccess: async () => {
    copyFileSync('src/sulu.css', 'dist/sulu.css');
  },
});
