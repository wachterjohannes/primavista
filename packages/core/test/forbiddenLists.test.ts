import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN_TAGS, GENERIC_TAGS } from '../src/nodes/match';

/*
 * The Sulu bundle refuses the same tags as the helpers. The lists live in two
 * languages, so this test keeps them equal.
 */
const php = readFileSync(join(process.cwd(), '../../bundles/sulu-bundle/src/PrimavistaSuluBundle.php'), 'utf8');

function phpList(name: string): string[] {
  const match = new RegExp(`${name} = \\[(.*?)\\];`, 's').exec(php);
  if (!match?.[1]) throw new Error(`${name} not found in PrimavistaSuluBundle.php`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1] as string).sort();
}

describe('tag lists of the helpers and the Sulu bundle', () => {
  it('forbid the same tags', () => {
    expect(phpList('FORBIDDEN_TAGS')).toEqual([...FORBIDDEN_TAGS].sort());
  });

  it('treat the same tags as generic', () => {
    expect(phpList('GENERIC_TAGS')).toEqual([...GENERIC_TAGS].sort());
  });
});
