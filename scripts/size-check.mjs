/*
 * Reports raw and gzip sizes of the built files and fails when one grows
 * past its budget. Run after `pnpm build`. The budgets sit about 10 % above
 * the sizes after decisions 34, 36 and 39 (terser, autoformat, paste
 * cleanup), raise them on purpose, not to make CI green.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Repo relative file → budget in KB (1024 bytes). */
const BUDGETS = [
  { file: 'bundles/ux-bundle/assets/dist/controller.js', raw: 485, gzip: 151 },
  { file: 'bundles/ux-bundle/assets/dist/primavista.css', raw: 10.2, gzip: 2.8 },
  { file: 'packages/core/dist/index.js', raw: 118, gzip: 28.5 },
  { file: 'packages/react/dist/index.js', raw: 3.1, gzip: 1.05 },
  { file: 'packages/sulu/dist/index.js', raw: 4.8, gzip: 1.7 },
  { file: 'demo/assets/build/react-island.js', raw: 636, gzip: 200 },
];

const kb = (bytes) => (bytes / 1024).toFixed(2);

let failed = false;
const rows = [];
for (const { file, raw, gzip } of BUDGETS) {
  const path = join(root, file);
  if (!existsSync(path)) {
    console.error(`Missing ${file}, run pnpm build first.`);
    process.exit(1);
  }
  const content = readFileSync(path);
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
