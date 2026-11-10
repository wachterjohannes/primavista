<?php

declare(strict_types=1);

namespace Primavista\SuluBundle\Admin;

use Sulu\Bundle\AdminBundle\Admin\Admin;

/**
 * Hands the `primavista_sulu.elements` config to the admin JavaScript, which
 * builds one inline element plugin per entry. Sulu sends it under the key
 * `primavista` with the rest of the admin config.
 *
 * @phpstan-import-type ElementConfig from \Primavista\SuluBundle\HtmlSanitizer\TextEditorSanitizers
 */
final class PrimavistaAdmin extends Admin
{
    public const CONFIG_KEY = 'primavista';

    /**
     * @param list<ElementConfig> $elements
     */
    public function __construct(private readonly array $elements)
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

        return [] === $elements ? null : ['elements' => $elements];
    }
}
