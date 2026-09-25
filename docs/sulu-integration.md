# Replacing CKEditor 5 in Sulu Admin

How Primavista becomes the `text_editor` adapter of Sulu 3, through the bundle `primavista/sulu-bundle` in `bundles/sulu-bundle`. The feature list it has to cover is in `sulu-requirements.md`. Sulu itself is not changed.

Verified on 2026-09-24 in a Sulu 3.0.9 skeleton with the bundle installed: the adapter's Jest test inside a Sulu checkout, the admin webpack build, and the click-through below in the browser. The adapter also passes its test against Sulu's pull request 9091 (text editor configs, targeted at 3.1).

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

## The pieces

| Package | Role |
|---|---|
| `@primavista/core` | The editor. Knows nothing about Sulu. |
| `@primavista/react` | The React component Sulu Admin mounts. |
| `@primavista/sulu` | `suluPlugins()`, `<sulu-link>`, the CKEditor-compatible preset, the Sulu theme, `enter_mode` and value helpers. |
| `primavista/sulu-bundle` | The Symfony bundle: translations plus the admin JavaScript that registers the adapter and switches the field. |

## 1. Installing the bundle in a Sulu project

Step by step, this is how the screencast project was built. The bundle README in `bundles/sulu-bundle` has the same steps in short.

**Composer.** Until the packages are on Packagist, point at the repository. The bundle requires `primavista/html-sanitizer`, and Composer only reads `repositories` from the project's own `composer.json`, so the library needs an entry too, with a version that satisfies the bundle's `^0.1`:

```json
{
    "repositories": [
        { "type": "path", "url": "../primavista/bundles/sulu-bundle" },
        {
            "type": "path",
            "url": "../primavista/libs/html-sanitizer",
            "options": { "versions": { "primavista/html-sanitizer": "0.1.0" } }
        }
    ]
}
```

```sh
composer require primavista/sulu-bundle:@dev
```

```php
// config/bundles.php
Primavista\SuluBundle\PrimavistaSuluBundle::class => ['all' => true],
```

**Primavista packages.** Until they are on npm, build and pack them in this repository:

```sh
pnpm install && pnpm build
pnpm --filter @primavista/core --filter @primavista/react --filter @primavista/sulu exec pnpm pack --pack-destination /path/to/project/primavista
```

**Admin build.** In the project's `assets/admin/package.json`:

```json
{
    "dependencies": {
        "@primavista/core": "file:../../primavista/primavista-core-0.1.0.tgz",
        "@primavista/react": "file:../../primavista/primavista-react-0.1.0.tgz",
        "@primavista/sulu": "file:../../primavista/primavista-sulu-0.1.0.tgz",
        "lexical": "^0.51.0",
        "sulu-primavista-bundle": "file:../../vendor/primavista/sulu-bundle/assets/admin"
    }
}
```

Tarballs instead of `file:` links to the package directories: a link would pull the packages' own `node_modules` into the build and risk a second React. The bundle's package is named `sulu-primavista-bundle` on purpose, Sulu's webpack config only transpiles `node_modules/sulu-*-bundle`.

In `assets/admin/app.js`:

```js
import 'sulu-primavista-bundle';
```

Then:

```sh
cd assets/admin
rm -rf node_modules package-lock.json
npm install --install-links --legacy-peer-deps
npm run build
```

`npm run build` writes to `public/build/admin`. Sulu's `sulu:admin:update-build` is not an option here, it downloads a prebuilt bundle without the adapter.

`--install-links` makes npm copy the `file:` bundles into `node_modules` instead of linking them. Linked bundles do not build, npm leaves their dependencies (`classnames` and friends) out. `--legacy-peer-deps` is needed once the skeleton's lockfile is gone, because `mobx-react` 5 declares React 16 as peer. A change in the bundle or the tarballs is invisible until the copy is refreshed: `rm -rf node_modules/sulu-primavista-bundle node_modules/@primavista && npm install --install-links --legacy-peer-deps`.

**Content templates.** Nothing to change. Every `text_editor` property now renders Primavista. `formats` and `enter_mode` keep their meaning, and with Sulu 3.1 the `config` param does too.

**Nothing on the PHP side.** Saving sanitizes `text_editor` values with the property's text editor config, see the bundle README. The stored HTML is the same: paragraphs, headings, inline formats, lists, tables in `<figure class="table">` with `<thead>`, `<a>` for external links and `<sulu-link>` for internal ones, `&nbsp;` in empty paragraphs. Existing content opens in Primavista unchanged.

## 2. What the bundle does inside Sulu

- Everything happens in an update config hook under `sulu_admin`, because Sulu fills its registries from that hook once the admin config has loaded, not on import. The bundle's hook is appended to the same list and runs right after Sulu's.
- `textEditorRegistry.add('primavista', PrimavistaTextEditor)`: a second adapter next to `ckeditor5`.
- The `text_editor` entry of `fieldRegistry` is replaced by a copy of Sulu's field that passes `adapter="primavista"`. Sulu's field hard-codes `ckeditor5` and the registry refuses a second registration, so the bundle drops the entry first. This is the one place where it reaches into Sulu internals. A `sulu_admin.text_editor.adapter` setting in Sulu would make it unnecessary.
- The adapter builds its plugins with `suluPlugins()` from a text editor config. Sulu 3.1 (pull request 9091) passes the resolved config as a prop. On Sulu 3.0 the adapter derives it from the deprecated `formats` and `enter_mode` params with `suluConfigFromLegacyOptions()`, the same rules Sulu 3.1 applies.
- Link dialogs: `internalLinks` asks for a dialog, the adapter renders Sulu's `LinkTypeOverlay` for the provider (`linkTypeRegistry.getOverlay(key)`) and calls `apply` on confirm. External links go through `ExternalLinkTypeOverlay`, `mailto:` subject and body included.
- Translations: every toolbar and form string goes through Sulu's `translate()` with the `sulu_admin.primavista.` prefix. The bundle ships English and German.
- Languages: with `attributes: {lang: true}` in a Sulu 3.1 config the toolbar gets a language menu. Its entries are the system's localizations from `localizationStore`.
- Sanitizing: `TextEditorSanitizingDataMapper` runs after Sulu's `TemplateDataMapper` and sanitizes every `text_editor` value of the save, inside blocks too, with the allowlist of the property's config from `sulu_admin.text_editor_configs`. Sulu 3.0 falls back to the `default` config and the `formats` param.

## 3. Checklist in the browser

Open a page with a `text_editor` field and walk through what the screencast does:

- The editor carries `pv-editor pv-theme-sulu`, the toolbar shows undo, redo, the heading select (`h2` to `h6` by default), bold, italic, underline, strikethrough, sub, sup, code, lists, external link, internal link, alignment and insert table. Inside a table the row, column, merge, split and delete tools appear.
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
| `config` (Sulu 3.1) | `suluPlugins({ config })`: `tags` and `attributes` switch plugins on, `enterMode` drives the value mapping |
| `options.formats` (Sulu 3.0) | replaces the heading tags of the default config, default `h2` to `h6`. Headings outside the list are demoted to paragraphs on load, as CKEditor did. |
| `options.enter_mode = br` | `suluValueToHtml` and `htmlToSuluValue` from `@primavista/sulu`, same algorithm as Sulu's `utils.js` |
| `options.autoformat`, `options.word_count`, `options.word_count_limit` | Primavista's own params: typing shortcuts and the word count bar, see the bundle README |
| `primavistaPluginRegistry` | plugins added in the admin build, appended to every editor, `suluPlugins({ plugins })`. The server allows their tags through `primavista_sulu.tags` |
| CKEditor markup | `suluPreset()` from `@primavista/sulu`: `figure.table`, `thead`, `&nbsp;`, theme `sulu` |

Tag keys map to plugins as in Sulu 3.1: `h1` to `h6` to the heading select, `strong`, `i`, `u`, `s`, `sub`, `sup`, `code` to the inline formats, `ul` and `ol` to the list buttons, `a` to both link plugins, `table` to tables. Attribute `style` adds alignment (`align` from an earlier draft of the pull request still works), `lang` the language menu.

## Links

Sulu keeps its overlays. Primavista only asks for a dialog:

- `suluLinks({ providers, openDialog })` (the core's `internalLinks` in Sulu's format, part of `suluPlugins()`): one toolbar menu entry per registered link type (`linkTypeRegistry.getKeys()` minus `external`). `openDialog` receives `{ mode, provider, href, query, anchor, target, title, selectedText, collapsed, apply, remove, cancel }`. The adapter renders Sulu's `LinkTypeOverlay` for the provider and calls `apply` on confirm. The href is assembled as `id?query#anchor`, exactly what `LinkTag.php` parses.
- `links({ openDialog })`: the same for external links with `{ url, target, title, rel }`. `ExternalLinkTypeOverlay` handles `mailto:` subject and body as before.

Both toolbar buttons are disabled while the selection touches a link. Editing and removal happen in a balloon under the link, with a preview link for external URLs, matching Sulu's `LinkBalloonView`.

`sulu-validation-state` survives the round trip. The editor renders internal links as `<a class="pv-link pv-internal-link" data-provider data-validation-state>` and styles `removed` (red, strikethrough) and `unpublished` (marker) like `ckeditor5.scss` does. Editing a link resets the state.

## Theme

`suluPreset()` sets `theme: 'sulu'`, which adds `pv-theme-sulu` to the editor. `@primavista/sulu/sulu.css` carries Sulu's colors and font from `ckeditor5.scss` and the Application palette: silver toolbar, Shakespeare accent, Open Sans 12px, 3px radius, blue links, red removed and gold unpublished markers. Override any `--pv-*` variable in Sulu's SCSS to adjust.

## Project extensions

Where a project used `ckeditorPluginRegistry.add(MyCkPlugin)` it now appends a Primavista plugin to the list `suluPlugins()` returns. The bundle exports the adapter, so a project can subclass it or fork `assets/admin` and register its own list:

```js
plugins.push({
    name: 'project-callout',
    nodes: [CalloutNode],
    toolbar: [{ id: 'callout', label: 'Callout', icon, onClick: (editor) => editor.dispatchCommand(INSERT_CALLOUT, undefined) }],
    register: ({ editor }) => editor.registerCommand(INSERT_CALLOUT, …),
});
```

Toolbar order follows plugin order. `ckeditorConfigRegistry` has no equivalent, because the toolbar is built from plugins instead of a config object. Removing a button means a narrower config, or leaving the plugin out.

## Running the adapter's Jest test

The test in `bundles/sulu-bundle/assets/admin/tests` is written for Sulu's test setup. Inside a Sulu checkout:

```sh
cp -R /path/to/primavista/bundles/sulu-bundle/assets/admin tests/js/primavista
cp -R /path/to/primavista/packages/{core,react,sulu} node_modules/@primavista/   # dist folders of the built packages
npx jest tests/js/primavista
```

Sulu's Jest needs `lexical|@lexical|@preact|` in `transformIgnorePatterns`, because Lexical ships ESM only.

## What Sulu could offer

Three small additions would make the bundle plain: a setting that names the `text_editor` adapter, so the field does not have to be replaced, the text editor configs of pull request 9091, which the adapter already reads, and sanitizing `text_editor` values with those configs on save, which the bundle's data mapper does until then.

## Recording the screencast

`e2e/sulu-screencast.mjs` drives a running Sulu Admin with Playwright and records the flow above. It needs a project set up as in section 1 and the uuid of a page with a `text_editor` field named `article`. The field is emptied before recording starts.

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
- The packages are not on npm and the bundle is not on Packagist yet. Until then the tarball and path repository steps of section 1 apply.
