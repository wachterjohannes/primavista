/*
 * Installs the packed packages the way an outside project gets them and
 * checks that they work: every entry of @primavista/core loads as ESM and as
 * CommonJS, there is one copy of Lexical, the types resolve under node16 and
 * bundler resolution, and the editorial-kit example passes its
 * tests against the tarballs instead of the source tree. Run after
 * `pnpm build`. Needs network access for npm.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = mkdtempSync(join(tmpdir(), 'primavista-verify-'));
const packs = join(work, 'packs');
const consumer = join(work, 'consumer');
mkdirSync(packs);
mkdirSync(consumer);

const run = (command, args, cwd, options = {}) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: options.quiet ? 'pipe' : ['ignore', 'pipe', 'inherit'] });

const problems = [];
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
  if (!ok) problems.push(message);
};

// 1. Pack
for (const name of ['core', 'react', 'sulu']) {
  run('pnpm', ['pack', '--pack-destination', packs], join(root, 'packages', name));
}
const tarballs = readdirSync(packs).map((file) => join(packs, file));

// 2. Install into an empty project, together with what the example needs.
writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'consumer', private: true, type: 'module' }));
run('npm', ['install', '--no-audit', '--no-fund', ...tarballs, 'vitest@^5.1.0', 'jsdom@^31.0.0', 'typescript@^6.0.3'], consumer);

// 3. Every entry of the core loads as ESM and as CommonJS.
const exportsMap = JSON.parse(readFileSync(join(root, 'packages/core/package.json'), 'utf8')).exports;
const entries = Object.keys(exportsMap).filter((key) => typeof exportsMap[key] === 'object' && 'import' in exportsMap[key]);
const loader = `
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const failures = [];
for (const entry of ${JSON.stringify(entries)}) {
  const name = '@primavista/core' + entry.slice(1);
  for (const [kind, load] of [['esm', () => import(name)], ['cjs', () => require(name)]]) {
    try {
      const mod = await load();
      if (Object.keys(mod).length === 0) failures.push(kind + ' ' + name + ' is empty');
    } catch (error) {
      failures.push(kind + ' ' + name + ': ' + String(error.message).split('\\n')[0]);
    }
  }
}
console.log(JSON.stringify(failures));
`;
writeFileSync(join(consumer, 'load.mjs'), loader);
const failures = JSON.parse(run('node', ['load.mjs'], consumer, { quiet: true }).trim().split('\n').pop());
check(failures.length === 0, `all ${entries.length} entries of @primavista/core load as ESM and CommonJS${failures.length ? `: ${failures.join('; ')}` : ''}`);

// 3b. The test kit shares the core with the main entry in both formats. A second copy
// would carry its own node classes and ignore what internalLinks() configured.
const kitFiles = {
  esm: join(consumer, 'node_modules/@primavista/core/dist/testing.js'),
  cjs: join(consumer, 'node_modules/@primavista/core/dist/testing.cjs'),
};
const kitUsesCore = {
  esm: /from ['"]@primavista\/core['"]/.test(readFileSync(kitFiles.esm, 'utf8')),
  cjs: /require\(['"]@primavista\/core['"]\)/.test(readFileSync(kitFiles.cjs, 'utf8')),
};
const kitOwnCore = /class InternalLinkNode|function createEditor/.test(readFileSync(kitFiles.cjs, 'utf8'));
check(kitUsesCore.esm && kitUsesCore.cjs && !kitOwnCore, '@primavista/core/testing loads the core by name and carries no copy of it in ESM and CommonJS');

// 4. One copy of Lexical.
const tree = JSON.parse(run('npm', ['ls', 'lexical', '--all', '--json'], consumer, { quiet: true }));
const versions = new Set();
const walk = (node) => {
  for (const [name, child] of Object.entries(node.dependencies ?? {})) {
    if (name === 'lexical' && child.version) versions.add(child.version);
    walk(child);
  }
};
walk(tree);
check(versions.size === 1, `one version of lexical is installed (${[...versions].join(', ')})`);

// 4b. The check a project can run says the same.
try {
  run('npx', ['primavista-check-lexical'], consumer, { quiet: true });
  check(true, 'primavista-check-lexical passes');
} catch (error) {
  check(false, `primavista-check-lexical fails: ${String(error.stderr ?? error.stdout ?? error.message).split('\n')[0]}`);
}

// 5. Types resolve under every module resolution a project may use.
writeFileSync(
  join(consumer, 'types.ts'),
  `import { createEditor, inlineElement, type PrimavistaPlugin } from '@primavista/core';
import { $getSelection } from '@primavista/core/lexical';
import { $findMatchingParent } from '@primavista/core/lexical/utils';
import { mount } from '@primavista/core/testing';
export const plugin: PrimavistaPlugin = inlineElement({ name: 'x', tag: 'mark' });
export const all = [createEditor, $getSelection, $findMatchingParent, mount];
`,
);
const tsc = join(consumer, 'node_modules/.bin/tsc');
// node10 is not on the list: Lexical's own types refuse it ("requires moduleResolution bundler, node16, or nodenext").
for (const [module, resolution] of [['nodenext', 'nodenext'], ['esnext', 'bundler']]) {
  let ok = true;
  let output = '';
  try {
    const flags = ['--noEmit', '--strict', '--target', 'es2022', '--module', module, '--moduleResolution', resolution, '--lib', 'esnext,dom', 'types.ts'];
    run(tsc, flags, consumer, { quiet: true });
  } catch (error) {
    ok = false;
    output = String(error.stdout ?? error.message).split('\n').slice(0, 2).join(' ');
  }
  check(ok, `types resolve with moduleResolution ${resolution}${ok ? '' : `: ${output}`}`);
}

// 6. The example passes against the tarballs.
const example = join(consumer, 'example');
mkdirSync(example);
for (const file of ['src', 'test', 'vitest.config.ts']) cpSync(join(root, 'examples/editorial-kit', file), join(example, file), { recursive: true });
try {
  run('npx', ['vitest', 'run', '--root', example], consumer, { quiet: true });
  check(true, 'examples/editorial-kit passes its tests against the packed packages');
} catch (error) {
  check(false, `examples/editorial-kit fails against the packed packages: ${String(error.stdout ?? error.message).split('\n').slice(-12).join('\n')}`);
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s). The install is in ${work}.`);
  process.exit(1);
}
console.log('\nThe packed packages work in an empty project.');
