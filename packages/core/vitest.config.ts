import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const lexicalVersion = JSON.parse(readFileSync('package.json', 'utf8')).dependencies.lexical.replace(/^[^\d]*/, '');

export default defineConfig({
  resolve: { alias: { '@primavista/core': resolve(__dirname, 'src/index.ts') } },
  define: { __LEXICAL_VERSION__: JSON.stringify(lexicalVersion) },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
});
