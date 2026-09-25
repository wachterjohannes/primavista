<?php

declare(strict_types=1);

namespace Primavista\SuluBundle\HtmlSanitizer;

use Primavista\HtmlSanitizer\PrimavistaSanitizerConfig;
use Symfony\Component\HtmlSanitizer\HtmlSanitizer;
use Symfony\Component\HtmlSanitizer\HtmlSanitizerConfig;
use Symfony\Component\HtmlSanitizer\HtmlSanitizerInterface;

/**
 * One sanitizer per Sulu text editor config, allowing what the config lets
 * the editor produce and nothing else. The configs are the ones Sulu 3.1
 * resolves into `sulu_admin.text_editor_configs` (sulu/sulu#9091). Sulu 3.0
 * has none, there every property uses Sulu's `default` config, with the
 * deprecated `formats` param replacing its heading tags, the rule
 * `suluConfigFromLegacyOptions()` in `@primavista/sulu` follows too.
 *
 * Markup from before Primavista stays: CKEditor wrote italic as `<i>`, so the
 * `i` key allows `<i>` next to the editor's `<em>`, and `strong` allows `<b>`.
 *
 * @phpstan-type TextEditorConfig array{enterMode: string, tags: list<string>, attributes: list<string>}
 */
final class TextEditorSanitizers implements TextEditorSanitizersInterface
{
    public const DEFAULT_CONFIG_NAME = 'default';

    /** Sulu's shipped `default` config, `SULU_DEFAULT_CONFIG` in `@primavista/sulu`. */
    public const DEFAULT_CONFIG = [
        'enterMode' => 'p',
        'tags' => ['h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'i', 'u', 's', 'sub', 'sup', 'ul', 'ol', 'a', 'table', 'code'],
        'attributes' => ['style'],
    ];

    public const LINK_TAG = 'sulu-link';

    public const VALIDATION_ATTRIBUTE = 'sulu-validation-state';

    private const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

    /** Tag keys of a config that name a different element than the one the editor writes. */
    private const ELEMENT_PER_TAG = ['i' => 'em'];

    /** Elements kept for content written before Primavista. */
    private const LEGACY_ELEMENTS = ['i' => 'i', 'strong' => 'b'];

    /** @var array<string, HtmlSanitizerInterface> */
    private array $sanitizers = [];

    /**
     * @param array<string, TextEditorConfig> $configs        `sulu_admin.text_editor_configs`, empty on Sulu 3.0
     * @param list<string>                    $additionalTags tags every config allows on top, `primavista_sulu.tags`,
     *                                                        for plugins a project adds in the admin JavaScript on Sulu 3.0
     */
    public function __construct(
        private readonly array $configs = [],
        private readonly array $additionalTags = [],
    ) {
    }

    public function get(?string $configName, ?array $formats = null): HtmlSanitizerInterface
    {
        $key = ($configName ?? '').'|'.implode(',', $formats ?? ['-']);

        return $this->sanitizers[$key] ??= new HtmlSanitizer($this->createConfig($configName, $formats));
    }

    /**
     * @param list<string>|null $formats
     */
    private function createConfig(?string $configName, ?array $formats): HtmlSanitizerConfig
    {
        $configName ??= self::DEFAULT_CONFIG_NAME;
        $config = $this->configs[$configName] ?? (self::DEFAULT_CONFIG_NAME === $configName ? self::DEFAULT_CONFIG : null);

        // A config registered only in the admin JavaScript is unknown here.
        // Allow everything Primavista can write rather than strip what the
        // editor offered, the markup is still free of anything executable.
        if (null === $config) {
            return self::withLegacyElements(
                PrimavistaSanitizerConfig::create(self::LINK_TAG, self::VALIDATION_ATTRIBUTE),
                array_keys(self::LEGACY_ELEMENTS),
            );
        }

        $config = self::applyFormats($config, $formats);
        $config['tags'] = array_values(array_unique([...$config['tags'], ...$this->additionalTags]));

        return self::createFromConfig($config);
    }

    /**
     * @param TextEditorConfig $config
     */
    public static function createFromConfig(array $config): HtmlSanitizerConfig
    {
        $elements = [];
        foreach ($config['tags'] as $tag) {
            $element = self::ELEMENT_PER_TAG[$tag] ?? $tag;
            if (\in_array($element, PrimavistaSanitizerConfig::ELEMENTS, true)) {
                $elements[] = $element;
            }
        }
        $attributes = $config['attributes'];

        return self::withLegacyElements(
            PrimavistaSanitizerConfig::create(
                self::LINK_TAG,
                self::VALIDATION_ATTRIBUTE,
                array_values(array_unique($elements)),
                // `align` is the key of an earlier draft of sulu/sulu#9091.
                alignment: \in_array('style', $attributes, true) || \in_array('align', $attributes, true),
                language: \in_array('lang', $attributes, true),
            ),
            $config['tags'],
        );
    }

    /**
     * @param list<string> $tags
     */
    private static function withLegacyElements(HtmlSanitizerConfig $config, array $tags): HtmlSanitizerConfig
    {
        foreach (self::LEGACY_ELEMENTS as $tag => $element) {
            if (\in_array($tag, $tags, true)) {
                $config = $config->allowElement($element);
            }
        }

        return $config;
    }

    /**
     * A `formats` param replaces the heading tags of the config, even when it
     * names none of them. Anything but a heading in it was always ignored.
     *
     * @param TextEditorConfig  $config
     * @param list<string>|null $formats
     *
     * @return TextEditorConfig
     */
    private static function applyFormats(array $config, ?array $formats): array
    {
        if (null === $formats || [] === $formats) {
            return $config;
        }

        $config['tags'] = [
            ...array_values(array_diff($config['tags'], self::HEADING_TAGS)),
            ...array_values(array_intersect($formats, self::HEADING_TAGS)),
        ];

        return $config;
    }
}
