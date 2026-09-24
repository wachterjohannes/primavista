import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { minify } from 'terser';
import { defineConfig } from 'tsup';

const require = createRequire(import.meta.url);
const corePackageDir = dirname(require.resolve('@primavista/core/package.json'));

/*
 * The original textarea keeps the value for the form post. It stays in the
 * document for the form and is moved off-screen.
 */
const BUNDLE_CSS = `
/* Symfony UX bundle */

.pv-textarea {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  margin: -1px !important;
  padding: 0 !important;
  border: 0 !important;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
}
`;

/**
 * The controller ships self-contained: @primavista/core and Lexical are
 * bundled in, only Stimulus stays external. That keeps the Symfony side at
 * zero build steps with AssetMapper.
 *
 * esbuild minifies, a second pass with terser saves another 4 % gzip. See
 * decision 34 for the numbers.
 */
export default defineConfig({
  entry: { controller: 'src/controller.ts' },
  format: ['esm'],
  dts: true,
  sourcemap: false,
  clean: true,
  minify: true,
  target: 'es2022',
  platform: 'browser',
  external: ['@hotwired/stimulus'],
  noExternal: ['@primavista/core', /^lexical$/, /^@lexical\//],
  define: { 'process.env.NODE_ENV': '"production"' },
  esbuildOptions(options) {
    options.conditions = ['production', 'browser', 'import', 'default'];
    options.legalComments = 'none';
  },
  onSuccess: async () => {
    const controller = readFileSync('dist/controller.js', 'utf8');
    const minified = await minify(controller, {
      module: true,
      compress: { passes: 2 },
      format: { comments: false },
    });
    writeFileSync('dist/controller.js', minified.code ?? controller);

    // One stylesheet for AssetMapper: base look, every theme, bundle rules.
    const themesDir = join(corePackageDir, 'dist', 'themes');
    const themes = readdirSync(themesDir)
      .sort()
      .map((file) => readFileSync(join(themesDir, file), 'utf8'))
      .join('\n');
    const coreCss = readFileSync(join(corePackageDir, 'dist', 'primavista.css'), 'utf8');
    writeFileSync('dist/primavista.css', coreCss + '\n' + themes + BUNDLE_CSS);
  },
});
