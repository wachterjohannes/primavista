#!/usr/bin/env node
/*
 * Fails when more than one version of Lexical is installed in the project.
 * A second copy breaks instanceof checks and node registration with messages
 * that do not point at the cause. Run it in the project root, for example as
 * an npm script: "check:lexical": "primavista-check-lexical".
 */
import { execFileSync } from 'node:child_process';

let tree;
try {
  tree = JSON.parse(execFileSync('npm', ['ls', 'lexical', '--all', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
} catch (error) {
  // npm ls exits with 1 for problems such as missing peers but still prints the tree.
  if (!error.stdout) {
    console.error('primavista-check-lexical: could not run `npm ls lexical`.');
    process.exit(2);
  }
  tree = JSON.parse(error.stdout);
}

const found = new Map();
const walk = (node, path) => {
  for (const [name, child] of Object.entries(node.dependencies ?? {})) {
    const here = [...path, name];
    if (name === 'lexical' && child.version) {
      found.set(child.version, [...(found.get(child.version) ?? []), here.slice(0, -1).join(' > ') || '(project)']);
    }
    walk(child, here);
  }
};
walk(tree, []);

if (found.size === 0) {
  console.log('Lexical is not installed.');
} else if (found.size === 1) {
  console.log(`One copy of Lexical is installed (${[...found.keys()][0]}).`);
} else {
  console.error(`More than one version of Lexical is installed:`);
  for (const [version, users] of found) console.error(`  ${version}, used by ${[...new Set(users)].slice(0, 3).join(', ')}`);
  console.error('Remove the extra copy. Extensions should import Lexical from @primavista/core/lexical and not depend on lexical themselves.');
  process.exit(1);
}
