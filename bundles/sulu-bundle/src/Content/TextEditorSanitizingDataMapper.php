<?php

declare(strict_types=1);

namespace Primavista\SuluBundle\Content;

use Primavista\SuluBundle\HtmlSanitizer\TextEditorSanitizers;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\FieldMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\FormMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\OptionMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\TypedFormMetadata;
use Sulu\Bundle\AdminBundle\Metadata\MetadataProviderRegistry;
use Sulu\Content\Application\ContentDataMapper\DataMapper\DataMapperInterface;
use Sulu\Content\Domain\Model\DimensionContentInterface;
use Sulu\Content\Domain\Model\TemplateInterface;
use Symfony\Component\HtmlSanitizer\HtmlSanitizerInterface;

/**
 * Sanitizes every `text_editor` value a save writes, at the top level and
 * inside blocks, with the sanitizer of the property's text editor config.
 *
 * Sulu saves pages, snippets and articles through its content data mappers,
 * not through Symfony forms, so this mapper runs right after Sulu's
 * `TemplateDataMapper` (priority 128) and rewrites the template data it just
 * set. Only properties the request carries are touched, content that was not
 * part of the save keeps its stored markup.
 */
final class TextEditorSanitizingDataMapper implements DataMapperInterface
{
    public const PRIORITY = 127;

    private const FIELD_TYPE = 'text_editor';

    public function __construct(
        private readonly MetadataProviderRegistry $metadataProviderRegistry,
        private readonly TextEditorSanitizers $sanitizers,
    ) {
    }

    public function map(
        DimensionContentInterface $unlocalizedDimensionContent,
        DimensionContentInterface $localizedDimensionContent,
        array $data,
    ): void {
        if (!$localizedDimensionContent instanceof TemplateInterface
            || !$unlocalizedDimensionContent instanceof TemplateInterface
        ) {
            return;
        }

        $locale = $localizedDimensionContent->getLocale();
        $template = $localizedDimensionContent->getTemplateKey();
        if (null === $locale || null === $template) {
            return;
        }

        $typedMetadata = $this->metadataProviderRegistry->getMetadataProvider('form')
            ->getMetadata($localizedDimensionContent::getTemplateType(), $locale, []);
        $metadata = $typedMetadata instanceof TypedFormMetadata ? $typedMetadata->getForms()[$template] ?? null : null;
        if (!$metadata instanceof FormMetadata) {
            return;
        }

        foreach ([$unlocalizedDimensionContent, $localizedDimensionContent] as $dimensionContent) {
            $templateData = $dimensionContent->getTemplateData();
            $sanitized = $this->sanitizeFields($metadata, $templateData, array_keys($data));
            if ($sanitized !== $templateData) {
                $dimensionContent->setTemplateData($sanitized);
            }
        }
    }

    /**
     * @param array<string, mixed> $values
     * @param list<string|int>|null $names only these properties, null for all
     *
     * @return array<string, mixed>
     */
    private function sanitizeFields(FormMetadata $metadata, array $values, ?array $names = null): array
    {
        foreach ($metadata->getFlatFieldMetadata() as $field) {
            $name = $field->getName();
            if (!\array_key_exists($name, $values) || (null !== $names && !\in_array($name, $names, true))) {
                continue;
            }

            $values[$name] = $this->sanitizeValue($field, $values[$name]);
        }

        return $values;
    }

    private function sanitizeValue(FieldMetadata $field, mixed $value): mixed
    {
        if (self::FIELD_TYPE === $field->getType()) {
            return \is_string($value) ? $this->sanitizerFor($field)->sanitize($value) : $value;
        }

        $types = $field->getTypes();
        if ([] === $types || !\is_array($value)) {
            return $value;
        }

        // A block: a list of items, each with the key of its type.
        foreach ($value as $index => $item) {
            $type = \is_array($item) && \is_string($item['type'] ?? null) ? $types[$item['type']] ?? null : null;
            if (null !== $type) {
                /** @var array<string, mixed> $item */
                $value[$index] = $this->sanitizeFields($type, $item);
            }
        }

        return $value;
    }

    private function sanitizerFor(FieldMetadata $field): HtmlSanitizerInterface
    {
        $config = $field->findOption('config')?->getValue();

        return $this->sanitizers->get(
            \is_scalar($config) ? (string) $config : null,
            self::formats($field->findOption('formats')),
        );
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
