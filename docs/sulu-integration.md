# Replacing CKEditor 5 in Sulu Admin

How Primavista becomes the `text_editor` adapter of Sulu 3. The feature list it has to cover is in `sulu-requirements.md`. Sulu-specific code (the `<sulu-link>` plugin, Sulu's toolbar, the CKEditor-compatible preset, the theme and the `enter_mode` helpers) is the package `@primavista/sulu`, the core stays free of it. The reference adapter is `sulu/PrimavistaTextEditor.js`, its Jest test `sulu/tests/PrimavistaTextEditor.test.js`, the translation keys are in `sulu/translations`.

Verified on 2026-09-24 in a Sulu 3.0.9 skeleton with the adapter wired in: Sulu's Jest suite for `containers/TextEditor` (21 tests), `flow focus-check`, ESLint with Sulu's rules, the admin webpack build, and the click-through below in the browser.

## Screencast

[![Primavista inside Sulu Admin](assets/sulu-screencast.gif)](assets/sulu-screencast.mp4)

Thirty seconds, recorded with Playwright ([MP4](assets/sulu-screencast.mp4)): a heading, italic and bold, a list, an internal link through Sulu's link overlay and page chooser, an external link through Sulu's overlay, a table filled with Tab and trimmed with the table tools, "Save and publish", and the published page. The Sulu preview on the right follows every keystroke.

The stored value after the video:

```html
<h2>Primavista inside Sulu</h2>
<p>This paragraph is written with the <em>new editor</em>. It replaces <strong>CKEditor</strong>.</p>
<ul><li>MIT licensed</li><li>Built on Lexical</li></ul>
<p>Read more on the <sulu-link href="01a0d4a4-fb6d-76d2-848c-4eafa2d95aa8" provider="page" target="_self">homepage</sulu-link>
   and at <a href="https://sulu.io" target="_self" title="Sulu website">sulu.io</a>.</p>
<p>&nbsp;</p>
<figure class="table"><table><thead><tr><th>Editor</th><th>License</th><th>Size</th></tr></thead>
<tbody><tr><td>Primavista</td><td>MIT</td><td>133 KB</td></tr></tbody></table></figure>
```

The same markup CKEditor wrote. On the website `MarkupBundle` turns the `<sulu-link>` into `<a href="/">` as before.

## 1. The change in sulu/sulu

All paths below `src/Sulu/Bundle/AdminBundle/Resources/js` unless noted. This is the content of the pull request against Sulu.

1. `package.json`: add `"@primavista/react": "^0.1.0"`, `"@primavista/sulu": "^0.1.0"` and `"lexical": "^0.51.0"` to `dependencies`. The CKEditor packages can go once step 8 is done.
2. Copy `docs/sulu/PrimavistaTextEditor.js` to `containers/TextEditor/adapters/PrimavistaTextEditor.js` and `docs/sulu/tests/PrimavistaTextEditor.test.js` to `containers/TextEditor/tests/adapters/`.
3. `index.js`: import the adapter and register it in `registerTextEditors()` with `textEditorRegistry.add('primavista', PrimavistaTextEditor)`. The registry throws on duplicate keys, so the CKEditor entry stays until it is removed for good.
4. `containers/Form/fields/TextEditor.js`: change `adapter="ckeditor5"` to `adapter="primavista"`.
5. `Resources/translations/admin.en.json` and `admin.de.json`: add the keys from `docs/sulu/translations`. They cover the toolbar, the link forms and the `sulu_admin.text_editor` label of the content area.
6. Repository root `package.json`, Jest `transformIgnorePatterns`: prepend `lexical|@lexical|@preact|` to the allow list. Lexical ships ESM only and Jest has to transform it.
7. Repository root `.flowconfig`, `[untyped]` section: add `.*/node_modules/lexical/.*`, `.*/node_modules/@lexical/.*` and `.*/node_modules/@primavista/.*`. Lexical's `.js.flow` files use syntax Flow cannot parse.
8. Later: delete `containers/CKEditor5` once nothing imports it. Projects that used `pluginRegistry` or `configRegistry` move their extensions to Primavista plugins (see below).

Check with Sulu's own tooling from the repository root:

```sh
npm install
npx jest src/Sulu/Bundle/AdminBundle/Resources/js/containers/TextEditor
npx flow focus-check src/Sulu/Bundle/AdminBundle/Resources/js/containers/TextEditor/adapters/PrimavistaTextEditor.js
npx eslint src/Sulu/Bundle/AdminBundle/Resources/js/containers/TextEditor
```

Nothing changes on the PHP side. The stored HTML is the same: paragraphs, headings, inline formats, lists, tables in `<figure class="table">` with `<thead>`, `<a>` for external links and `<sulu-link>` for internal ones, `&nbsp;` in empty paragraphs. Existing content opens in Primavista unchanged.

## 2. Using it in a Sulu project today

Until the pull request is merged and the packages are on npm, a project pulls in a patched `sulu/sulu` and installs Primavista from tarballs. This is exactly how the screencast project was built.

**sulu/sulu with the adapter.** Point Composer at a checkout or fork that contains the changes from section 1, with an inline alias for the version the skeleton expects:

```json
{
    "repositories": [
        { "type": "path", "url": "../sulu", "options": { "symlink": true } }
    ],
    "require": {
        "sulu/sulu": "dev-primavista as 3.0.9"
    }
}
```

`composer update sulu/sulu -W` (the flag allows dependency changes). A `vcs` repository pointing at a fork works the same way. Sulu's webpack config resolves modules with `symlinks: false`, so a symlinked `vendor/sulu/sulu` builds fine.

**Primavista packages.** Build and pack them in this repository:

```sh
pnpm install && pnpm build
pnpm --filter @primavista/core --filter @primavista/react --filter @primavista/sulu exec pnpm pack --pack-destination /path/to/project/primavista
```

Reference the tarballs in the project's `assets/admin/package.json`. The `@primavista/react` and `@primavista/sulu` dependencies of `sulu-admin-bundle` resolve to the same copies, npm dedupes them:

```json
{
    "dependencies": {
        "@primavista/core": "file:../../primavista/primavista-core-0.1.0.tgz",
        "@primavista/react": "file:../../primavista/primavista-react-0.1.0.tgz",
        "@primavista/sulu": "file:../../primavista/primavista-sulu-0.1.0.tgz",
        "lexical": "^0.51.0"
    }
}
```

Tarballs instead of `file:` links to the package directories: a link would pull the packages' own `node_modules` into the build and risk a second React.

**Translations.** Copy the keys from `docs/sulu/translations/admin.*.json` into the project's `translations/admin.en.json` and `admin.de.json` (or wait for them to arrive with `sulu/sulu`).

**Build the admin.**

```sh
cd assets/admin
rm -rf node_modules package-lock.json
npm install --install-links --legacy-peer-deps
npm run build
```

`npm run build` writes to `public/build/admin`. Sulu's `sulu:admin:update-build` is not an option here, it downloads a prebuilt bundle without the adapter.

`--install-links` makes npm copy the `file:` bundles from `vendor/sulu/sulu` into `node_modules` instead of linking them. Linked bundles do not build, npm leaves their dependencies (`classnames` and friends) out. `--legacy-peer-deps` is needed once the skeleton's lockfile is gone, because `mobx-react` 5 declares React 16 as peer. A change in `vendor/sulu/sulu` is invisible until the copy is refreshed: `rm -rf node_modules/sulu-admin-bundle && npm install --install-links --legacy-peer-deps`.

**Content templates.** Nothing to change. Every `text_editor` property now renders Primavista. `formats` and `enter_mode` keep their meaning.

**After a Primavista change.** `pnpm build`, pack again, then in the project `rm -rf assets/admin/node_modules/@primavista assets/admin/package-lock.json && npm install && npm run build`. After an adapter change in the Sulu checkout, refresh the copy as described above and run `npm run build`.

## 3. Checklist in the browser

Open a page with a `text_editor` field and walk through what the screencast does:

- The editor carries `pv-editor pv-theme-sulu`, the toolbar shows undo, redo, bold, italic, underline, strikethrough, sub, sup, code, the heading select (`h2` to `h6` by default), lists, external link, internal link, alignment and insert table. Inside a table the row, column, merge, split and delete tools appear.
- The internal link button opens a menu with one entry per link type from `linkTypeRegistry` (pages, media, articles, plus project types). Picking one opens Sulu's `LinkTypeOverlay` with the chooser. After confirming, the link shows as `pv-internal-link` and the balloon reads `Pages: <uuid>`.
- The external link button opens Sulu's `ExternalLinkTypeOverlay`. The balloon offers preview, edit and unlink. Both link buttons are disabled while the caret is inside a link.
- Tab moves between table cells.
- Save and publish stores the markup shown above. Reloading the form brings the content back, `sulu-validation-state` included.
- The browser console stays clean. A missing translation key would show as a warning there.

## Contract mapping

| Sulu prop or option | Primavista |
|---|---|
| `value` | `Editor value`, `undefined` becomes `""` |
| `onChange(value)` | `Editor onChange`, `""` is reported as `undefined` like the CKEditor adapter |
| `onBlur`, `onFocus` | same props, `onFocus` receives the contenteditable as target |
| `disabled` | `Editor disabled`, toggles read-only mode and the toolbar |
| `locale` | passed to the link overlays only |
| `options.formats` | `suluPlugins({ formats })`, default `h2` to `h6`. Headings outside the list are demoted to paragraphs on load, as CKEditor did. |
| `options.enter_mode = br` | `suluValueToHtml` and `htmlToSuluValue` from `@primavista/sulu`, same algorithm as Sulu's `utils.js` |
| CKEditor markup | `suluPreset()` from `@primavista/sulu`: `figure.table`, `thead`, `&nbsp;`, theme `sulu` |

## Links

Sulu keeps its overlays. Primavista only asks for a dialog:

- `suluLinks({ providers, openDialog })` (the core's `internalLinks` in Sulu's format, part of `suluPlugins()`): one toolbar menu entry per registered link type (`linkTypeRegistry.getKeys()` minus `external`). `openDialog` receives `{ mode, provider, href, query, anchor, target, title, selectedText, collapsed, apply, remove, cancel }`. The adapter renders Sulu's `LinkTypeOverlay` for the provider and calls `apply` on confirm. The href is assembled as `id?query#anchor`, exactly what `LinkTag.php` parses.
- `links({ openDialog })`: the same for external links with `{ url, target, title, rel }`. `ExternalLinkTypeOverlay` handles `mailto:` subject and body as before.

Both toolbar buttons are disabled while the selection touches a link. Editing and removal happen in a balloon under the link, with a preview link for external URLs, matching Sulu's `LinkBalloonView`.

`sulu-validation-state` survives the round trip. The editor renders internal links as `<a class="pv-link pv-internal-link" data-provider data-validation-state>` and styles `removed` (red, strikethrough) and `unpublished` (marker) like `ckeditor5.scss` does. Editing a link resets the state.

## Theme

`suluPreset()` sets `theme: 'sulu'`, which adds `pv-theme-sulu` to the editor. `@primavista/sulu/sulu.css` carries Sulu's colors and font from `ckeditor5.scss` and the Application palette: silver toolbar, Shakespeare accent, Open Sans 12px, 3px radius, blue links, red removed and gold unpublished markers. Override any `--pv-*` variable in Sulu's SCSS to adjust.

## Translations

The editor takes a `translate(key, fallback)` hook. The adapter maps every key with `suluTranslationKey()` to `sulu_admin.primavista.<key>` and falls back to the English default when Sulu has no translation. `docs/sulu/translations/admin.en.json` and `admin.de.json` hold the full key set plus `sulu_admin.text_editor`, the accessible label of the content area.

## Project extensions

Where a project used `pluginRegistry.add(MyCkPlugin)` it now appends a Primavista plugin to the list `suluPlugins()` returns:

```js
plugins.push({
    name: 'project-callout',
    nodes: [CalloutNode],
    toolbar: [{ id: 'callout', label: 'Callout', icon, onClick: (editor) => editor.dispatchCommand(INSERT_CALLOUT, undefined) }],
    register: ({ editor }) => editor.registerCommand(INSERT_CALLOUT, …),
});
```

Toolbar order follows plugin order. `configRegistry` has no equivalent, because the toolbar is built from plugins instead of a config object. Removing a button means leaving the plugin out or passing fewer `formats`, `levels` or `alignments`.

## Recording the screencast

`e2e/sulu-screencast.mjs` drives a running Sulu Admin with Playwright and records the flow above. It needs a project set up as in section 2 and the uuid of a page with a `text_editor` field named `article`. The field is emptied before recording starts.

```sh
SULU_URL=http://127.0.0.1:8899 SULU_PAGE=<uuid> pnpm screencast:sulu
ffmpeg -i e2e/output/sulu-screencast.webm -c:v libx264 -crf 23 -pix_fmt yuv420p -movflags +faststart -an docs/assets/sulu-screencast.mp4
ffmpeg -i e2e/output/sulu-screencast.webm -vf "fps=10,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=5" docs/assets/sulu-screencast.gif
ffmpeg -ss 22 -i e2e/output/sulu-screencast.webm -frames:v 1 docs/assets/sulu-screencast.png
```

`SULU_USER`, `SULU_PASSWORD`, `SULU_WEBSPACE`, `SULU_LOCALE` and `SULU_PAGE_TITLE` (the page picked in the chooser) have defaults for the skeleton.

## Not covered

- Custom overlays keep working since the adapter reads `linkTypeRegistry.getOverlay(key)`.
- Merging cells needs a drag or shift-click selection across cells, as in CKEditor.
- The packages are not on npm yet. Until then section 2 applies.
