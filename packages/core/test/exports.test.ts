import { describe, expect, it } from 'vitest';
import * as core from '../src';
import * as testing from '../src/testing';

/*
 * The names the package exports are its public API. A change shows up in
 * this snapshot, so a removed or renamed export cannot slip through a review.
 * Update the snapshot on purpose with `vitest -u` and say so in the PR. Types
 * and interfaces are not covered, they have no runtime name.
 */
describe('public API', () => {
  it('exports these names from @primavista/core', () => {
    expect(Object.keys(core).sort()).toMatchSnapshot();
  });

  it('exports these names from @primavista/core/testing', () => {
    expect(Object.keys(testing).sort()).toMatchSnapshot();
  });
});
