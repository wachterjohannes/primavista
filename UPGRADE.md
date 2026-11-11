# Upgrade notes

Each release that updates Lexical gets an entry here. It says what authors of level 3 extensions (raw Lexical) have to change. Extensions built with the helpers or the configuration are not affected. See `docs/writing-extensions.md` for the levels.

## Writing an entry

A Lexical update fails `packages/core/test/lexicalExports.test.ts` when an export of a Lexical subpath appears, disappears or is renamed. Regenerate the file with `pnpm --filter @primavista/core exec vitest -u` and read the diff of `packages/core/test/__snapshots__/lexical-exports.txt`. The names that disappeared are what authors of raw Lexical extensions have to replace, they go into the entry. No removed names and a green test run for the examples is an entry that says "Nothing".

## Lexical 0.51 to 0.53

Nothing. The core needed no change in its source. Extensions that import Lexical through `@primavista/core/lexical` need no change either.
