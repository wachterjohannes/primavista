<?php

declare(strict_types=1);

namespace Primavista\SuluBundle\Content;

use Primavista\SuluBundle\HtmlSanitizer\TextEditorSanitizersInterface;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\FieldMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\FormMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\OptionMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\TypedFormMetadata;
use Sulu\Bundle\AdminBundle\Metadata\MetadataProviderRegistry;
use Sulu\Content\Application\ContentDataMapper\DataMapper\DataMapperInterface;
use Sulu\Content\Domain\Model\DimensionContentInterface;
use Sulu\Content\Domain\Model\ExcerptInterface;
use Sulu\Content\Domain\Model\TemplateInterface;
use Symfony\Component\HtmlSanitizer\HtmlSanitizerInterface;

/**
 * Sanitizes every `text_editor` value a save writes with the sanitizer of the
 * property's text editor config: the template's properties at the top level,
 * in sections, in blocks, global blocks and block settings, in image map
 * hotspots, and the excerpt description.
 *
 * Sulu saves pages, snippets and articles through its content data mappers,
 * not through Symfony forms, so this mapper runs after Sulu's
 * `TemplateDataMapper` (128) and `ExcerptDataMapper` (64) and rewrites what
 * they just set. Only properties the request carries are touched. The admin
 * form posts every property, so the first save after the upgrade rewrites
 * every editor value of the document.
 */
final class TextEditorSanitizingDataMapper implements DataMapperInterface
{
    public const PRIORITY = 60;

    private const FIELD_TYPE = 'text_editor';

    private const GLOBAL_BLOCK_TAG = 'sulu.global_block';

    public function __construct(
        private readonly MetadataProviderRegistry $metadataProviderRegistry,
        private readonly TextEditorSanitizersInterface $sanitizers,
    ) {
    }

    public function map(
        DimensionContentInterface $unlocalizedDimensionContent,
        DimensionContentInterface $localizedDimensionContent,
        array $data,
    ): void {
        $locale = $localizedDimensionContent->getLocale();
        if (null === $locale) {
            return;
        }

        if ($localizedDimensionContent instanceof TemplateInterface && $unlocalizedDimensionContent instanceof TemplateInterface) {
            $this->mapTemplate($unlocalizedDimensionContent, $localizedDimensionContent, $locale, $data);
        }
        if ($localizedDimensionContent instanceof ExcerptInterface && \is_array($data['excerpt'] ?? null)) {
            $this->mapExcerpt($localizedDimensionContent, $locale, $data['excerpt']);
        }
    }

    /**
     * @param array<string, mixed> $data
     */
    private function mapTemplate(
        TemplateInterface $unlocalizedDimensionContent,
        TemplateInterface $localizedDimensionContent,
        string $locale,
        array $data,
    ): void {
        $template = $localizedDimensionContent->getTemplateKey();
        if (null === $template) {
            return;
        }

        $metadata = $this->form($localizedDimensionContent::getTemplateType(), $template, $locale, []);
        if (null === $metadata) {
            return;
        }

        $walker = new TemplateWalker($this, $locale);
        foreach ([$unlocalizedDimensionContent, $localizedDimensionContent] as $dimensionContent) {
            $templateData = $dimensionContent->getTemplateData();
            $sanitized = $walker->sanitizeFields($metadata, $templateData, array_keys($data));
            if ($sanitized !== $templateData) {
                $dimensionContent->setTemplateData($sanitized);
            }
        }
    }

    /**
     * The excerpt form names its properties `excerpt/description`, the
     * ExcerptDataMapper stores the posted array under the short names.
     *
     * @param array<string, mixed> $excerptData
     */
    private function mapExcerpt(ExcerptInterface $dimensionContent, string $locale, array $excerptData): void
    {
        $metadata = $this->metadataProviderRegistry->getMetadataProvider('form')
            ->getMetadata('content_excerpt', $locale, ['instanceOf' => $dimensionContent::class]);
        if (!$metadata instanceof FormMetadata) {
            return;
        }

        $stored = $dimensionContent->getExcerptData();
        $sanitized = $stored;
        foreach ($metadata->getFlatFieldMetadata() as $field) {
            $name = \explode('/', $field->getName(), 2)[1] ?? $field->getName();
            if (self::FIELD_TYPE !== $field->getType() || !\array_key_exists($name, $excerptData) || !\is_string($stored[$name] ?? null)) {
                continue;
            }
            $sanitized[$name] = $this->sanitizerFor($field)->sanitize($stored[$name]);
        }
        if ($sanitized !== $stored) {
            $dimensionContent->setExcerptData($sanitized);
        }
    }

    /**
     * @internal used by the walker
     */
    public function sanitizerFor(FieldMetadata $field): HtmlSanitizerInterface
    {
        $config = $field->findOption('config')?->getValue();

        return $this->sanitizers->get(
            \is_scalar($config) ? (string) $config : null,
            self::formats($field->findOption('formats')),
        );
    }

    /**
     * The form of a global block, `<type ref="…"/>` in the template. Its type
     * metadata is empty and carries only the tag, the properties live in the
     * block forms, the way Sulu's BlockPropertyResolver reads them.
     *
     * @internal used by the walker
     */
    public function globalBlockForm(FormMetadata $type, string $locale): ?FormMetadata
    {
        $tag = $type->getTagsByName(self::GLOBAL_BLOCK_TAG)[0] ?? null;
        $name = $tag?->getAttribute('global_block');

        return \is_string($name) ? $this->form('block', $name, $locale, ['ignore_global_blocks' => true]) : null;
    }

    /**
     * The settings form of a block, `settings_form_key` on the block property.
     *
     * @internal used by the walker
     */
    public function settingsForm(string $key, string $locale): ?FormMetadata
    {
        $metadata = $this->metadataProviderRegistry->getMetadataProvider('form')->getMetadata($key, $locale, []);

        return $metadata instanceof FormMetadata ? $metadata : null;
    }

    /**
     * Sulu's TemplateDataMapper stores a property named `a/b` under `a`.
     *
     * @internal used by the walker
     */
    public static function shortName(FieldMetadata $field): string
    {
        return \explode('/', $field->getName(), 2)[0];
    }

    /**
     * @param array<string, mixed> $options
     */
    private function form(string $type, string $key, string $locale, array $options): ?FormMetadata
    {
        $typed = $this->metadataProviderRegistry->getMetadataProvider('form')->getMetadata($type, $locale, $options);
        $form = $typed instanceof TypedFormMetadata ? $typed->getForms()[$key] ?? null : null;

        return $form instanceof FormMetadata ? $form : null;
    }

    /**
     * The deprecated `formats` param: a collection of params named after the headings.
     *
     * @return list<string>|null
     */
    private static function formats(?OptionMetadata $option): ?array
    {
        $value = $option?->getValue();
        if (!\is_array($value)) {
            return null;
        }

        $formats = [];
        foreach ($value as $format) {
            $name = $format->getName();
            if (\is_string($name)) {
                $formats[] = $name;
            }
        }

        return $formats;
    }
}
