# primavista/html-sanitizer

The [`symfony/html-sanitizer`](https://symfony.com/doc/current/html_sanitizer.html) configuration for the markup the [Primavista](https://github.com/wachterjohannes/primavista) editor emits, and nothing else. `primavista/ux-bundle` registers it as the `primavista` sanitizer of its form type, `primavista/sulu-bundle` builds one per Sulu text editor config. Any other host builds its own:

```php
use Primavista\HtmlSanitizer\PrimavistaSanitizerConfig;
use Symfony\Component\HtmlSanitizer\HtmlSanitizer;

$sanitizer = new HtmlSanitizer(PrimavistaSanitizerConfig::create());
$sanitizer->sanitize($html);
```

`create()` without arguments allows everything the default plugins write: paragraphs, headings, the inline formats, lists, links and `<internal-link>`, tables with the `figure.table` wrapper, `<span lang>` and `text-align` on blocks and cells. The arguments narrow it:

```php
PrimavistaSanitizerConfig::create(
    internalLinkTag: 'sulu-link',                    // InternalLinkNode.tagName
    validationAttribute: 'sulu-validation-state',    // InternalLinkNode.validationAttribute
    elements: ['h2', 'h3', 'strong', 'em', 'a'],     // null for all, `p` and `br` are always allowed
    alignment: false,                                // style="text-align: …"
    language: false,                                 // <span lang>
);
```

Scripts, embeds and foreign namespaces go with their content. Event handlers, `javascript:` URLs, classes and every other inline style go. Unknown elements lose their tag and keep their text, so content written by another editor survives a save that only touched another field. Add to the returned config for markup of custom plugins.

```sh
composer install
composer test
composer phpstan
```
