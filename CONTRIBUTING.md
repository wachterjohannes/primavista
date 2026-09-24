# Contributing

Thanks for taking a look. Primavista is young, so small focused pull requests are the most useful kind.

## Setup

```sh
pnpm install
pnpm build
pnpm test
(cd bundle && composer install && composer test && composer phpstan)
(cd demo && composer install)
pnpm e2e:install
pnpm e2e
```

`pnpm e2e` starts the demo with PHP's built-in server and runs Playwright against it.

## Where things live

- `packages/core`: the editor. Every feature is a plugin in `src/plugins`. HTML import and export live in `src/html.ts`.
- `packages/react`: the mount wrapper.
- `bundle`: the Symfony bundle. `assets/dist` is built output and is committed, run `pnpm build` after touching `assets/src` or the core.
- `demo`: the Symfony app the browser tests run against.
- `pages`: the static demo and the rendered documentation for GitHub Pages, built with `pnpm build:pages`. It reuses the demo's React island and renders the Markdown files listed in `pages/build-docs.mjs`.
- `docs`: research, decisions and the Sulu integration notes.

## Ground rules

- A change to the emitted HTML needs a round-trip test in `packages/core/test/html.test.ts`.
- A new toolbar item needs a unit test and, if it touches the DOM in a way jsdom cannot cover, a Playwright test.
- Keep the plugin interface stable. Host systems build on it.
- Files in the repository are written in English.

## Releasing

Versions are managed with Changesets. Add a changeset with `pnpm changeset`, the release workflow bumps and publishes.
