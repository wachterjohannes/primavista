<?php

declare(strict_types=1);

namespace Primavista\HtmlSanitizer;

use Symfony\Component\HtmlSanitizer\HtmlSanitizerConfig;
use Symfony\Component\HtmlSanitizer\Visitor\AttributeSanitizer\AttributeSanitizerInterface;

/**
 * Keeps `style` only when it is exactly one `text-align` declaration with a
 * value the alignment plugin writes, and normalizes it to the editor's
 * `text-align: center;`. Every other inline style is dropped.
 */
final class TextAlignAttributeSanitizer implements AttributeSanitizerInterface
{
    private const PATTERN = '/^\s*text-align\s*:\s*(left|center|right|justify)\s*;?\s*$/i';

    public function getSupportedElements(): array
    {
        return PrimavistaSanitizerConfig::ALIGNABLE_ELEMENTS;
    }

    public function getSupportedAttributes(): array
    {
        return ['style'];
    }

    public function sanitizeAttribute(string $element, string $attribute, string $value, HtmlSanitizerConfig $config): ?string
    {
        if (1 !== preg_match(self::PATTERN, $value, $match)) {
            return null;
        }

        return 'text-align: '.strtolower($match[1]).';';
    }
}
