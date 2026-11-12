import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig } from 'tsup';

// The installed version, not the range in package.json: ^0.53.0 with 0.53.2 installed is 0.53.2.
function installedLexicalVersion(): string {
  // `lexical/package.json` is not in the exports of the package, so walk up from its entry file.
  let directory = dirname(createRequire(import.meta.url).resolve('lexical'));
  while (!existsSync(join(directory, 'package.json')) || JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')).name !== 'lexical') {
    const parent = dirname(directory);
    if (parent === directory) throw new Error('Cannot find the installed lexical package');
    directory = parent;
  }
  return JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')).version;
}
const lexicalVersion = installedLexicalVersion();

export default defineConfig({
  define: { __LEXICAL_VERSION__: JSON.stringify(lexicalVersion) },
  entry: {
    index: 'src/index.ts',
    testing: 'src/testing.ts',
    'lexical/index': 'src/lexical/index.ts',
    'lexical/clipboard': 'src/lexical/clipboard.ts',
    'lexical/code-core': 'src/lexical/code-core.ts',
    'lexical/history': 'src/lexical/history.ts',
    'lexical/html': 'src/lexical/html.ts',
    'lexical/link': 'src/lexical/link.ts',
    'lexical/list': 'src/lexical/list.ts',
    'lexical/markdown': 'src/lexical/markdown.ts',
    'lexical/rich-text': 'src/lexical/rich-text.ts',
    'lexical/selection': 'src/lexical/selection.ts',
    'lexical/table': 'src/lexical/table.ts',
    'lexical/utils': 'src/lexical/utils.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  platform: 'browser',
  // The core itself is external for the testing entry, so both formats share one copy of it.
  external: [/^lexical$/, /^@lexical\//, '@primavista/core'],
  onSuccess: async () => {
    copyFileSync('src/primavista.css', 'dist/primavista.css');
    mkdirSync('dist/themes', { recursive: true });
    for (const file of readdirSync('src/themes')) {
      copyFileSync(`src/themes/${file}`, `dist/themes/${file}`);
    }
  },
});
