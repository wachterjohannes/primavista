/*
 * Fails when a Lexical version differs from the one in packages/core.
 * Outside packages/core, Lexical may only be a devDependency (tests and type
 * checks), so a project or extension never carries a second copy.
 * Checks every package.json, every Markdown snippet that tells a project
 * what to put into its package.json, and the Lexical badge of the README.
 * After a Lexical update, run `pnpm up -r --latest lexical '@lexical/*'`
 * and fix what this reports.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

const expected = JSON.parse(read('packages/core/package.json')).dependencies?.lexical;
if (!expected) {
  console.error('packages/core/package.json has no "lexical" dependency to compare against.');
  process.exit(1);
}
const [major, minor] = expected.replace(/^[^\d]*/, '').split('.');
const minorVersion = `${major}.${minor}`;

const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const problems = [];
const corePackage = 'packages/core/package.json';
const isLexical = (name) => name === 'lexical' || name.startsWith('@lexical/');

for (const file of files.filter((f) => f.endsWith('package.json'))) {
  const json = JSON.parse(read(file));
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, range] of Object.entries(json[field] ?? {})) {
      if (!isLexical(name)) continue;
      if (range !== expected) {
        problems.push(`${file}: ${name} is ${range} in ${field}, expected ${expected}`);
      }
      if (file !== corePackage && field !== 'devDependencies') {
        problems.push(`${file}: ${name} is in ${field}, extensions get Lexical from @primavista/core/lexical`);
      }
    }
  }
}

const snippet = /"(lexical|@lexical\/[\w-]+)":\s*"([^"]+)"/g;
for (const file of files.filter((f) => f.endsWith('.md'))) {
  for (const [, name, range] of read(file).matchAll(snippet)) {
    if (range !== expected) problems.push(`${file}: ${name} is ${range}, expected ${expected}`);
  }
}

const badge = read('README.md').match(/Lexical(?:%20| )(\d+\.\d+)/g) ?? [];
if (badge.length === 0) problems.push('README.md: no Lexical version badge found');
for (const found of badge) {
  const version = found.replace(/^Lexical(?:%20| )/, '');
  if (version !== minorVersion) problems.push(`README.md: badge says Lexical ${version}, expected ${minorVersion}`);
}

if (problems.length > 0) {
  console.error(`Lexical versions differ from packages/core (${expected}):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`Lexical ${expected} is consistent in ${files.length} tracked files.`);
