<?php

declare(strict_types=1);

namespace Primavista\SuluBundle\Content;

use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\FieldMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\FormMetadata;

/**
 * Walks template data along its form metadata and sanitizes every
 * `text_editor` value: plain properties, block items, global block items,
 * block settings and image map hotspots.
 *
 * @internal
 */
final class TemplateWalker
{
    private const FIELD_TYPE = 'text_editor';

    /** @var array<string, FormMetadata|null> */
    private array $globalBlockForms = [];

    public function __construct(
        private readonly TextEditorSanitizingDataMapper $mapper,
        private readonly string $locale,
    ) {
    }

    /**
     * @param array<string, mixed> $values
     * @param list<string|int>|null $names only these properties, null for all
     *
     * @return array<string, mixed>
     */
    public function sanitizeFields(FormMetadata $metadata, array $values, ?array $names = null): array
    {
        foreach ($metadata->getFlatFieldMetadata() as $field) {
            // Top-level template data uses the short name, block data the full one.
            $name = null !== $names ? TextEditorSanitizingDataMapper::shortName($field) : $field->getName();
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
            return \is_string($value) ? $this->mapper->sanitizerFor($field)->sanitize($value) : $value;
        }

        $types = $field->getTypes();
        if ([] === $types || !\is_array($value)) {
            return $value;
        }

        // An image map keeps its typed items under `hotspots`.
        if (\is_array($value['hotspots'] ?? null)) {
            $value['hotspots'] = $this->sanitizeItems($types, $value['hotspots'], null);

            return $value;
        }

        // A block: a list of items, each with the key of its type and its settings.
        $settingsFormKey = $field->findOption('settings_form_key')?->getValue();

        return $this->sanitizeItems($types, $value, \is_string($settingsFormKey) ? $settingsFormKey : null);
    }

    /**
     * @param array<string, FormMetadata> $types
     * @param array<mixed> $items
     *
     * @return array<mixed>
     */
    private function sanitizeItems(array $types, array $items, ?string $settingsFormKey): array
    {
        foreach ($items as $index => $item) {
            if (!\is_array($item) || !\is_string($item['type'] ?? null)) {
                continue;
            }
            $type = $types[$item['type']] ?? null;
            if (null === $type) {
                continue;
            }
            $form = $this->resolve($type);
            if (null !== $form) {
                /** @var array<string, mixed> $item */
                $item = $this->sanitizeFields($form, $item);
            }
            $settingsForm = null !== $settingsFormKey && \is_array($item['settings'] ?? null) ? $this->mapper->settingsForm($settingsFormKey, $this->locale) : null;
            if (null !== $settingsForm) {
                /** @var array<string, mixed> $settings */
                $settings = $item['settings'];
                $item['settings'] = $this->sanitizeFields($settingsForm, $settings);
            }
            $items[$index] = $item;
        }

        return $items;
    }

    /** A global block type points at a block form, every other type is its own form. */
    private function resolve(FormMetadata $type): ?FormMetadata
    {
        if (!$type->hasTag('sulu.global_block')) {
            return $type;
        }

        $key = $type->getKey();

        return $this->globalBlockForms[$key] ??= $this->mapper->globalBlockForm($type, $this->locale);
    }
}
