import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const lexicalVersion = JSON.parse(readFileSync('package.json', 'utf8')).dependencies.lexical.replace(/^[^\d]*/, '');

export default defineConfig({
  define: { __LEXICAL_VERSION__: JSON.stringify(lexicalVersion) },
  entry: {
    index: 'src/index.ts',
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
  external: [/^lexical$/, /^@lexical\//],
  onSuccess: async () => {
    copyFileSync('src/primavista.css', 'dist/primavista.css');
    mkdirSync('dist/themes', { recursive: true });
    for (const file of readdirSync('src/themes')) {
      copyFileSync(`src/themes/${file}`, `dist/themes/${file}`);
    }
  },
});
