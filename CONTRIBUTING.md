# Contributing

Thanks for taking a look. Primavista is young, so small focused pull requests are the most useful kind.

## Setup

```sh
pnpm install
pnpm build
pnpm size
pnpm test
pnpm verify:packages
(cd libs/html-sanitizer && composer install && composer test && composer phpstan)
(cd bundles/ux-bundle && composer install && composer test && composer phpstan)
(cd bundles/sulu-bundle && composer install && composer test && composer phpstan)
(cd demo && composer install)
pnpm e2e:install
pnpm e2e
```

`pnpm verify:packages` packs the packages, installs them into an empty folder with npm and checks that every entry loads as ESM and CommonJS, that there is one copy of Lexical, that the types resolve and that the editorial kit passes its tests against the tarballs. It needs network access.

`pnpm e2e` starts the demo with PHP's built-in server and runs Playwright against it. The demo specs run in Chromium. `e2e/kit.spec.ts` runs the editorial kit in Chromium and Firefox, with real selection, menus and a real copy and paste. `pnpm e2e:install` installs both browsers.

## Where things live

- `packages/core`: the editor. Every feature is a plugin in `src/plugins`. HTML import and export live in `src/html.ts`.
- `packages/react`: the mount wrapper.
- `packages/sulu`: the Sulu flavour. Sulu-specific markup, preset, theme and helpers live here, never in the core.
- `bundles/ux-bundle`: the Symfony UX bundle. `assets/dist` is built output and is committed, run `pnpm build` after touching `assets/src` or the core.
- `bundles/sulu-bundle`: the Sulu bundle. PHP registers the translations and sanitizes `text_editor` values on save, `assets/admin` holds the adapter and the registration a Sulu project imports into its admin build.
- `libs/html-sanitizer`: the `symfony/html-sanitizer` rules for the markup Primavista emits, shared by both bundles.
- `demo`: the Symfony app the browser tests run against.
- `pages`: the static demo and the rendered documentation for GitHub Pages, built with `pnpm build:pages`. It reuses the demo's React island and renders the Markdown files listed in `pages/build-docs.mjs`.
- `docs`: research, decisions and the Sulu integration notes.

## Ground rules

- A change to the emitted HTML needs a round-trip test in `packages/core/test/html.test.ts`. A new element or attribute also goes into `PrimavistaSanitizerConfig` in `libs/html-sanitizer` and its test, otherwise the server drops it.
- A new toolbar item needs a unit test and, if it touches the DOM in a way jsdom cannot cover, a Playwright test.
- Primavista's own API follows semver: `createEditor`, `PrimavistaPlugin`, the helpers, the schema, the toolbar and balloon API and `@primavista/core/testing`. Host systems build on it.
- The Lexical pass-through is the exception. `@primavista/core/lexical` and `PluginContext.editor` follow Lexical and carry no stability promise.
- A Lexical minor update is a Primavista minor release, never a patch. Update Lexical in its own pull request.
- A release that updates Lexical gets an entry in `UPGRADE.md` that says what authors of raw Lexical extensions have to change. "Nothing" is a valid entry.
- Remove API in two steps. Deprecate it with a console warning for one minor release, then remove it.
- Files in the repository are written in English.

## Releasing

Versions are managed with Changesets. Add a changeset with `pnpm changeset`, the release workflow bumps and publishes.
