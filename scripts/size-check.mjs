/*
 * Reports raw and gzip sizes of the built files and fails when one grows
 * past its budget. Run after `pnpm build`. The budgets sit about 10 % above
 * the sizes after decisions 34, 36, 39 and 43 (terser, autoformat, paste
 * cleanup, block plugins), raise them on purpose, not to make CI green.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Repo relative file → budget in KB (1024 bytes). With `chunks` the shared
 * `chunk-*.js` files next to the entry count too, tsup moves code into them
 * as soon as a package has a second entry point.
 */
const BUDGETS = [
  { file: 'bundles/ux-bundle/assets/dist/controller.js', raw: 485, gzip: 151 },
  { file: 'bundles/ux-bundle/assets/dist/primavista.css', raw: 11.5, gzip: 3.1 },
  { file: 'packages/core/dist/index.js', raw: 135, gzip: 32, chunks: true },
  { file: 'packages/react/dist/index.js', raw: 3.1, gzip: 1.05 },
  { file: 'packages/sulu/dist/index.js', raw: 5.5, gzip: 1.9 },
  { file: 'demo/assets/build/react-island.js', raw: 640, gzip: 202 },
];

const kb = (bytes) => (bytes / 1024).toFixed(2);

let failed = false;
const rows = [];
for (const { file, raw, gzip, chunks } of BUDGETS) {
  const path = join(root, file);
  if (!existsSync(path)) {
    console.error(`Missing ${file}, run pnpm build first.`);
    process.exit(1);
  }
  const parts = [readFileSync(path)];
  if (chunks) {
    const dir = dirname(path);
    for (const name of readdirSync(dir).filter((entry) => /^chunk-.*\.js$/.test(entry))) {
      parts.push(readFileSync(join(dir, name)));
    }
  }
  const content = Buffer.concat(parts);
  const size = { raw: content.length, gzip: gzipSync(content, { level: 9 }).length };
  const over = size.raw > raw * 1024 || size.gzip > gzip * 1024;
  failed ||= over;
  rows.push({
    file,
    raw: `${kb(size.raw)} / ${raw} KB`,
    gzip: `${kb(size.gzip)} / ${gzip} KB`,
    status: over ? 'over budget' : 'ok',
  });
}

console.table(rows);
if (failed) {
  console.error('A file is over its size budget. See scripts/size-check.mjs.');
  process.exit(1);
}
