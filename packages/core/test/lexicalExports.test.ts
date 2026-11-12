import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as clipboard from '../src/lexical/clipboard';
import * as codeCore from '../src/lexical/code-core';
import * as history from '../src/lexical/history';
import * as html from '../src/lexical/html';
import * as lexical from '../src/lexical/index';
import * as link from '../src/lexical/link';
import * as list from '../src/lexical/list';
import * as markdown from '../src/lexical/markdown';
import * as richText from '../src/lexical/rich-text';
import * as selection from '../src/lexical/selection';
import * as table from '../src/lexical/table';
import * as utils from '../src/lexical/utils';

/*
 * The names every Lexical subpath of the core hands out. A Lexical update that
 * removes or renames an export changes the file, and its diff is the list for
 * the entry in UPGRADE.md: the names that disappeared are what raw Lexical
 * extensions have to replace. Regenerate with `vitest -u` on purpose.
 *
 * The canary sets LEXICAL_CANARY=1. There only a removed name fails, because a
 * new name in the nightly is no break and would open an issue every day.
 */
const SUBPATHS: Record<string, Record<string, unknown>> = {
  'lexical': lexical,
  'lexical/clipboard': clipboard,
  'lexical/code-core': codeCore,
  'lexical/history': history,
  'lexical/html': html,
  'lexical/link': link,
  'lexical/list': list,
  'lexical/markdown': markdown,
  'lexical/rich-text': richText,
  'lexical/selection': selection,
  'lexical/table': table,
  'lexical/utils': utils,
};

const SNAPSHOT = './__snapshots__/lexical-exports.txt';

function render(): string {
  return Object.entries(SUBPATHS)
    .map(([path, mod]) => `## @primavista/core/${path}\n${Object.keys(mod).sort().join('\n')}\n`)
    .join('\n');
}

describe('Lexical subpaths', () => {
  it.skipIf(process.env['LEXICAL_CANARY'] === '1')('hand out these names', async () => {
    await expect(render()).toMatchFileSnapshot(SNAPSHOT);
  });

  it.runIf(process.env['LEXICAL_CANARY'] === '1')('still hand out every name of the snapshot', () => {
    const now = new Set(render().split('\n'));
    const removed = readFileSync(new URL(SNAPSHOT, import.meta.url), 'utf8')
      .split('\n')
      .filter((line) => line !== '' && !now.has(line));
    expect(removed, 'names that Lexical removed or renamed').toEqual([]);
  });
});
