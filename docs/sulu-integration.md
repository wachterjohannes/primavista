# Replacing CKEditor 5 in Sulu Admin

How Primavista slots into Sulu 3.0 as the `text_editor` adapter. The feature list it has to cover is in `sulu-requirements.md`. The reference adapter is `sulu/PrimavistaTextEditor.js`, its Jest test `sulu/tests/PrimavistaTextEditor.test.js`, the translation keys are in `sulu/translations`.

Verified on 2026-09-24 against a local Sulu 3.0 checkout: the adapter and its test pass Sulu's Jest suite (21 tests in `containers/TextEditor`), `flow focus-check` and ESLint with Sulu's rules, and the admin builds with webpack.

## What changes in Sulu

All paths below `src/Sulu/Bundle/AdminBundle/Resources/js`.

1. `package.json`: add `@primavista/react` and `lexical` to `dependencies`. The CKEditor packages can go.
2. Copy `docs/sulu/PrimavistaTextEditor.js` to `containers/TextEditor/adapters/PrimavistaTextEditor.js` and the test to `containers/TextEditor/tests/adapters/`.
3. `index.js`: register the adapter with `textEditorRegistry.add('primavista', PrimavistaTextEditor)`. The CKEditor registration can stay while both exist.
4. `containers/Form/fields/TextEditor.js`: set `adapter="primavista"`.
5. Add the keys from `docs/sulu/translations/admin.*.json` to `Resources/translations/admin.*.json`.
6. Repository root `package.json`, Jest `transformIgnorePatterns`: add `lexical|@lexical|@preact|` to the allow list. Lexical ships ESM only and Jest has to transform it.
7. Repository root `.flowconfig`, `[untyped]` section: add `.*/node_modules/lexical/.*`, `.*/node_modules/@lexical/.*` and `.*/node_modules/@primavista/.*`. Lexical's `.js.flow` files use TypeScript syntax that Flow cannot parse.
8. Delete `containers/CKEditor5` once nothing else imports it. Projects that used `pluginRegistry` or `configRegistry` move their extensions to Primavista plugins (see below).

Nothing changes on the PHP side. The stored HTML is the same: paragraphs, headings, inline formats, lists, tables in `<figure class="table">` with `<thead>`, `<a>` for external links and `<sulu-link>` for internal ones, `&nbsp;` in empty paragraphs. `MarkupBundle` keeps resolving `<sulu-link>` on the response.

## Contract mapping

| Sulu prop or option | Primavista |
|---|---|
| `value` | `Editor value`, `undefined` becomes `""` |
| `onChange(value)` | `Editor onChange`, `""` is reported as `undefined` like the CKEditor adapter |
| `onBlur`, `onFocus` | same props, `onFocus` receives the contenteditable as target |
| `disabled` | `Editor disabled`, toggles read-only mode and the toolbar |
| `locale` | passed to the link overlays only |
| `options.formats` | `headings({ levels })`, default `h2` to `h6`. Headings outside the list are demoted to paragraphs on load, as CKEditor did. |
| `options.enter_mode = br` | `stripParagraphs` and `wrapParagraphs` from the core, same algorithm as Sulu's `utils.js` |
| CKEditor markup | `suluPreset()`: `figure.table`, `thead`, `&nbsp;`, theme `sulu` |

## Links

Sulu keeps its overlays. Primavista only asks for a dialog:

- `internalLinks({ providers, openDialog })`: one toolbar menu entry per registered link type (`linkTypeRegistry.getKeys()` minus `external`). `openDialog` receives `{ mode, provider, href, query, anchor, target, title, selectedText, collapsed, apply, remove, cancel }`. The adapter renders Sulu's `LinkTypeOverlay` for the provider and calls `apply` on confirm. The href is assembled as `id?query#anchor`, exactly what `LinkTag.php` parses.
- `links({ openDialog })`: the same for external links with `{ url, target, title, rel }`. `ExternalLinkTypeOverlay` handles `mailto:` subject and body as before.

Both toolbar buttons are disabled while the selection touches a link. Editing and removal happen in a balloon under the link, with a preview link for external URLs, matching Sulu's `LinkBalloonView`.

`sulu-validation-state` survives the round trip. The editor renders internal links as `<a class="pv-link pv-internal-link" data-provider data-validation-state>` and styles `removed` (red, strikethrough) and `unpublished` (marker) like `ckeditor5.scss` does. Editing a link resets the state.

## Theme

`suluPreset()` sets `theme: 'sulu'`, which adds `pv-theme-sulu` to the editor. `@primavista/core/themes/sulu.css` carries Sulu's colors and font from `ckeditor5.scss` and the Application palette: silver toolbar, Shakespeare accent, Open Sans 12px, 3px radius, blue links, red removed and gold unpublished markers. Override any `--pv-*` variable in Sulu's SCSS to adjust.

## Translations

The editor takes a `translate(key, fallback)` hook. The adapter maps every key to `sulu_admin.primavista.<key>` and falls back to the English default when Sulu has no translation. `docs/sulu/translations/admin.en.json` and `admin.de.json` hold the full key set.

## Project extensions

Where a project used `pluginRegistry.add(MyCkPlugin)` it now adds a Primavista plugin to the adapter's plugin list:

```js
plugins.push({
    name: 'project-callout',
    nodes: [CalloutNode],
    toolbar: [{ id: 'callout', label: 'Callout', icon, onClick: (editor) => editor.dispatchCommand(INSERT_CALLOUT, undefined) }],
    register: ({ editor }) => editor.registerCommand(INSERT_CALLOUT, …),
});
```

Toolbar order follows plugin order. `configRegistry` has no equivalent, because the toolbar is built from plugins instead of a config object. Removing a button means leaving the plugin out or passing fewer `formats`, `levels` or `alignments`.

## Not covered

- Custom overlays keep working since the adapter reads `linkTypeRegistry.getOverlay(key)`.
- Merging cells needs a drag or shift-click selection across cells, as in CKEditor.
- A manual click-through in a running Sulu Admin. The automated checks above ran, the browser check inside Sulu has not.
