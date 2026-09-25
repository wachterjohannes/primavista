# primavista/ux-bundle

Primavista WYSIWYG editor for Symfony forms. A form type plus a Stimulus controller, served by AssetMapper without a build step.

```sh
composer require primavista/ux-bundle
```

Flex registers the bundle and adds the controller to `assets/controllers.json`. If the controller does not show up in the browser, run `bin/console cache:clear` once.

## Form type

```php
use Primavista\UxBundle\Form\PrimavistaType;

$builder->add('body', PrimavistaType::class, [
    'label' => 'Body',
    'placeholder' => 'Start writing…',
]);
```

`PrimavistaType` extends `TextareaType`. The submitted value is an HTML string.

## Sanitizing

The server is the trust boundary: anyone can post to the form without the editor. `PrimavistaType` therefore sanitizes on submit by default, with the `primavista` sanitizer the bundle registers next to the ones from `framework.html_sanitizer`. It keeps exactly the markup the editor emits:

- `p`, `h1` to `h6`, `br`, `strong`, `em`, `u`, `s`, `code`, `sub`, `sup`
- `ul`, `ol` with `start`, `li`
- `a` with `href`, `target`, `title`, `rel`. Absolute `http`, `https`, `mailto` and `tel` URLs and relative URLs.
- `internal-link` with `href`, `provider`, `target`, `title`, `validation-state`. The href is a resource id and may not carry a scheme.
- `span` with `lang`
- `table`, `thead`, `tbody`, `tr`, `th` and `td` with `colspan` and `rowspan`, `figure` with a forced `class="table"`
- `style` on blocks and cells, only as `text-align: left|center|right|justify`, and `dir` on blocks

Everything else goes: scripts, embeds and foreign namespaces with their content, event handlers, `javascript:` URLs, other inline styles, classes. Unknown elements lose their tag but keep their text, so `<b>`, `<i>` or `<div>` from content written before Primavista survive a save that only touched another field. The sanitizer writes its own serialization (`<br />`, entity-encoded characters in attributes), which the editor reads back unchanged.

Options, all from Symfony's form component:

```php
$builder->add('body', PrimavistaType::class, ['sanitize_html' => false]);    // store the value as posted
$builder->add('body', PrimavistaType::class, ['sanitizer' => 'app_content']); // a sanitizer from framework.html_sanitizer
```

The defaults apply while FrameworkBundle's `html_sanitizer` is enabled. With the split `symfony/*` packages that happens as soon as `symfony/html-sanitizer` is installed, which the bundle requires. With the monolithic `symfony/symfony` package, or after `framework: { html_sanitizer: false }`, nothing is sanitized and the value is stored as posted. The same sanitizer is available as the Twig filter `sanitize_html('primavista')` and for autowiring as `HtmlSanitizerInterface $primavista`, the name FrameworkBundle would give it. Fields that set `sanitize_html: true` themselves now get this sanitizer instead of `default`.

Custom plugins that add markup, or `internalLinks({ tag, validationAttribute })` with other names, need their own sanitizer. Build it from the same rules and pass its name as `sanitizer`:

```yaml
services:
    app.sanitizer_config.content:
        class: Symfony\Component\HtmlSanitizer\HtmlSanitizerConfig
        factory: [Primavista\HtmlSanitizer\PrimavistaSanitizerConfig, create]
        arguments: ['cms-link', 'cms-state']
        calls:
            - [allowElement, ['mark'], true]
    app.sanitizer.content:
        class: Symfony\Component\HtmlSanitizer\HtmlSanitizer
        arguments: ['@app.sanitizer_config.content']
        tags: [{ name: html_sanitizer, sanitizer: app_content }]
```

`PrimavistaSanitizerConfig` lives in `primavista/html-sanitizer`, which the bundle requires. It needs no Twig and no bundle, only `symfony/html-sanitizer`. `PrimavistaSanitizerConfig::create('sulu-link', 'sulu-validation-state')` covers Sulu's `<sulu-link>`, the optional `elements`, `alignment` and `language` arguments narrow the rules to an editor with fewer plugins.

## Controller

The textarea keeps the value and receives `input` and `change` events on every edit, so Live Components and plain forms both work. The controller removes the `required` attribute from the hidden textarea, because browsers refuse to validate hidden controls. Keep server-side constraints such as `NotBlank`.

Events, all bubbling from the textarea:

| Event | `detail` |
|---|---|
| `primavista:pre-connect` | `{ plugins, textarea, core }`. Mutate `plugins` to add or replace plugins. `core` is the `@primavista/core` module with the Lexical re-exports. |
| `primavista:connect` | `{ editor, textarea }` |
| `primavista:disconnect` | `{ textarea }` |

```js
document.addEventListener('primavista:pre-connect', ({ detail }) => {
    const { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND } = detail.core.lexical;
    detail.plugins.push({
        name: 'highlight',
        toolbar: [{
            id: 'highlight',
            label: 'Highlight',
            icon: 'H',
            isActive: () => {
                const selection = $getSelection();
                return $isRangeSelection(selection) && selection.hasFormat('highlight');
            },
            onClick: (editor) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'highlight'),
        }],
    });
});
```

## Internal links

Add the plugin in `primavista:pre-connect` with the providers your app knows. Without `openDialog` a small form asks for the resource id, query, anchor and title:

```js
detail.plugins.push(detail.core.internalLinks({
    providers: [{ key: 'page', label: 'Page' }, { key: 'media', label: 'Media' }],
    defaultTarget: '_self',
    openDialog: (state) => openMyPicker(state),
}));
```

The stored markup is `<internal-link href="id?query#anchor" provider="page" target="_self" title="…">text</internal-link>`. Resolve it when rendering, or configure `tag` and `validationAttribute` for another format. Sulu's `<sulu-link>` format comes from `@primavista/sulu`.

## Development

```sh
composer install
composer test
composer phpstan
```

The JavaScript in `assets/dist` is built from the monorepo root with `pnpm build` and committed.
