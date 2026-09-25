# primavista/sulu-bundle

Primavista as the text editor of Sulu Admin 3. The bundle registers the adapter under the key `primavista` and switches Sulu's `text_editor` field to it. Sulu itself stays untouched, nothing in `vendor/sulu/sulu` changes.

What you get: the toolbar Sulu's CKEditor setup had (heading, bold, italic, underline, strikethrough, sub, sup, lists, external and internal link, alignment, table, code), Sulu's own link overlays for pages, media and every other registered link type, validation states on internal links, `enter_mode: br`, the `formats` param, and the same stored HTML as before (`<sulu-link>`, `figure.table`, `&nbsp;`). Existing content opens unchanged.

The adapter also understands the text editor configs of Sulu 3.1 (`sulu_admin.text_editor.configs`, sulu/sulu#9091): `tags` and `attributes` switch plugins on and off, `lang` adds a language menu fed by the system's localizations.

## Installation

```sh
composer require primavista/sulu-bundle
```

```php
// config/bundles.php
Primavista\SuluBundle\PrimavistaSuluBundle::class => ['all' => true],
```

Add the bundle's JavaScript to the admin build in `assets/admin/package.json`:

```json
{
    "dependencies": {
        "sulu-primavista-bundle": "file:../../vendor/primavista/sulu-bundle/assets/admin"
    }
}
```

Until the packages are on npm, add the built Primavista packages as tarballs next to it (`pnpm pack` in the Primavista repository):

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

Import it in `assets/admin/app.js`:

```js
import 'sulu-primavista-bundle';
```

Then build the admin:

```sh
cd assets/admin
npm install --install-links --legacy-peer-deps
npm run build
```

`--install-links` makes npm copy the bundle instead of linking it, linked bundles do not build with Sulu's webpack config. `--legacy-peer-deps` is needed once the skeleton's lockfile is gone. After updating the bundle or the tarballs, run `rm -rf node_modules/sulu-primavista-bundle node_modules/@primavista` before `npm install`.

Translations for the toolbar and the link forms ship with the bundle in `translations/admin.{en,de}.json`. Add other languages in your project's `translations/admin.<locale>.json` under `sulu_admin.primavista.*`.

## How it works

- `assets/admin/index.js` registers an update config hook under `sulu_admin`, the same list Sulu fills its registries from once the admin config has loaded. Right after Sulu's registrations it adds `PrimavistaTextEditor` to `textEditorRegistry` and replaces the `text_editor` entry of `fieldRegistry` with a copy of Sulu's field that passes `adapter="primavista"`. Sulu's field hard-codes `ckeditor5` and the registry refuses a second registration, so the entry is dropped first. That is the only place where the bundle reaches into Sulu.
- `assets/admin/PrimavistaTextEditor.js` builds the plugin list with `suluPlugins()` from `@primavista/sulu`, renders Sulu's `LinkTypeOverlay` and `ExternalLinkTypeOverlay` when the editor asks for a link dialog, maps the value with `suluValueToHtml` and `htmlToSuluValue`, and translates through Sulu's translator with the `sulu_admin.primavista.` prefix.
- The PHP bundle registers the translation files and sanitizes on save, see below.

## Sanitizing

Sulu saves content through its API, not through Symfony forms, so a request that skips the editor could store any HTML. The bundle therefore sanitizes every `text_editor` value when a page, snippet or article is saved, at the top level, in sections and inside blocks. It hooks into Sulu's content data mappers right after the template data is written, and only touches the properties the request carries.

Each property gets the rules of its text editor config: with Sulu 3.1 the config its `config` param names in `sulu_admin.text_editor.configs`, with Sulu 3.0 Sulu's `default` config with the headings of its `formats` param. The server then allows what the toolbar offers:

| Config key | Allowed markup |
|---|---|
| always | `p`, `br`, `dir` on blocks |
| `h1` to `h6` | the heading |
| `strong`, `i`, `u`, `s`, `sub`, `sup`, `code` | the format, `i` as `<em>` and `<i>`, `strong` also as `<b>` for content written with CKEditor |
| `ul`, `ol` | the list and `li`, `ol` with `start` |
| `a` | `<a href target title rel>` and `<sulu-link href provider target title sulu-validation-state>` |
| `table` | `figure.table`, `table`, `thead`, `tbody`, `tr`, `th` and `td` with `colspan` and `rowspan` |
| attribute `style` | `style="text-align: …"` with `left`, `center`, `right` or `justify` on blocks and cells |
| attribute `lang` | `<span lang>` |

Scripts, event handlers, `javascript:` URLs and every other style go. Unknown elements lose their tag and keep their text. A config registered only in the admin JavaScript is unknown on the server, its properties get everything Primavista can write. The rules come from `primavista/html-sanitizer`, which the UX bundle uses too.

To store values as posted:

```yaml
# config/packages/primavista_sulu.yaml
primavista_sulu:
    sanitize: false
```

`Primavista\SuluBundle\HtmlSanitizer\TextEditorSanitizers` is a service, `get($configName)` returns the sanitizer of a config for your own entities.

## Tests

`assets/admin/tests/PrimavistaTextEditor.test.js` is a Jest test written for Sulu's test setup (Enzyme, jsdom). It runs inside a Sulu checkout or a project with Sulu's Jest configuration, with `lexical|@lexical|@preact` added to `transformIgnorePatterns`. See `docs/sulu-integration.md` in the repository.

The PHP side has its own suite, with `sulu/sulu` as a dev dependency for the data mapper test:

```sh
composer install
composer test
composer phpstan
```
