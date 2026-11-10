import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEXICAL_VERSION } from '../src';
import * as core from '../src/lexical';
import * as lexical from 'lexical';

describe('lexical subpaths', () => {
  it('hand out the same module as lexical', () => {
    expect(core.$getRoot).toBe(lexical.$getRoot);
  });

  it('exposes the Lexical version of the package', () => {
    const range = JSON.parse(readFileSync('package.json', 'utf8')).dependencies.lexical;
    expect(range).toContain(LEXICAL_VERSION);
  });
});
