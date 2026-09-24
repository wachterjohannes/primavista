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
    'sanitize_html' => true,
]);
```

`PrimavistaType` extends `TextareaType`. The submitted value is an HTML string. `sanitize_html` comes from Symfony's form component and runs `symfony/html-sanitizer` on the submitted value. Relative links are dropped by the default sanitizer, so CMS content usually needs:

```yaml
framework:
    html_sanitizer:
        sanitizers:
            default:
                allow_relative_links: true
                allow_relative_medias: true
```

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
