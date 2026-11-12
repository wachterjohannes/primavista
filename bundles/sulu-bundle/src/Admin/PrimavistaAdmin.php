<?php

declare(strict_types=1);

namespace Primavista\SuluBundle\Admin;

use Sulu\Bundle\AdminBundle\Admin\Admin;

/**
 * Hands `primavista_sulu.elements` and `primavista_sulu.tags` to the admin
 * JavaScript. It builds one inline element plugin per element and warns when a
 * plugin writes an element the server does not allow. Sulu sends it under the key
 * `primavista` with the rest of the admin config.
 *
 * @phpstan-import-type ElementConfig from \Primavista\SuluBundle\HtmlSanitizer\TextEditorSanitizers
 */
final class PrimavistaAdmin extends Admin
{
    public const CONFIG_KEY = 'primavista';

    /**
     * @param list<ElementConfig> $elements
     * @param list<string>        $tags     `primavista_sulu.tags`, the tags the server allows for plugins the admin JavaScript adds
     */
    public function __construct(private readonly array $elements, private readonly array $tags = [])
    {
    }

    public function getConfigKey(): string
    {
        return self::CONFIG_KEY;
    }

    public function getConfig(): ?array
    {
        $elements = [];
        foreach ($this->elements as $element) {
            $elements[] = [
                'tag' => $element['tag'],
                'class' => $element['class'],
                'attributes' => $element['attributes'],
                'label' => $element['label'] ?? $element['tag'],
            ];
        }

        return [] === $elements && [] === $this->tags ? null : ['elements' => $elements, 'tags' => $this->tags];
    }
}
