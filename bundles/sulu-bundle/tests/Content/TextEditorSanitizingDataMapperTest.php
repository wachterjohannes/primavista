<?php

declare(strict_types=1);

namespace Primavista\SuluBundle\Tests\Content;

use PHPUnit\Framework\TestCase;
use Primavista\SuluBundle\Content\TextEditorSanitizingDataMapper;
use Primavista\SuluBundle\HtmlSanitizer\TextEditorSanitizers;
use Primavista\SuluBundle\Tests\Fixtures\TemplateDimensionContent;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\FieldMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\FormMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\OptionMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\SectionMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\TagMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\TypedFormMetadata;
use Sulu\Bundle\AdminBundle\Metadata\MetadataInterface;
use Sulu\Bundle\AdminBundle\Metadata\MetadataProviderInterface;
use Sulu\Bundle\AdminBundle\Metadata\MetadataProviderRegistry;
use Symfony\Component\DependencyInjection\ServiceLocator;

final class TextEditorSanitizingDataMapperTest extends TestCase
{
    private const SCRIPT = '<script>alert(1)</script>';

    public function testSanitizesTextEditorValuesWithTheirConfig(): void
    {
        [$unlocalized, $localized] = $this->map([
            'title' => 'Title <script>',
            'text' => '<h2>Head</h2><p onclick="alert(1)">Body</p>'.self::SCRIPT,
            'teaser' => '<h2>Head</h2><strong>short</strong>',
            'shared' => '<p>Shared</p>'.self::SCRIPT,
        ]);

        self::assertSame([
            'title' => 'Title <script>',
            'text' => '<h2>Head</h2><p>Body</p>',
            'teaser' => 'Head<strong>short</strong>',
        ], $localized->getTemplateData());
        self::assertSame(['shared' => '<p>Shared</p>'], $unlocalized->getTemplateData());
    }

    public function testSanitizesTextEditorsInsideBlocks(): void
    {
        [, $localized] = $this->map([
            'blocks' => [
                ['type' => 'text', 'settings' => [], 'text' => '<p>a</p>'.self::SCRIPT, 'title' => '<b>kept</b>'],
                ['type' => 'nested', 'blocks' => [['type' => 'text', 'text' => '<h1>b</h1>']]],
                ['type' => 'unknown', 'text' => self::SCRIPT],
                'not a block',
            ],
        ]);

        self::assertSame([
            ['type' => 'text', 'settings' => [], 'text' => '<p>a</p>', 'title' => '<b>kept</b>'],
            ['type' => 'nested', 'blocks' => [['type' => 'text', 'text' => 'b']]],
            ['type' => 'unknown', 'text' => self::SCRIPT],
            'not a block',
        ], $localized->getTemplateData()['blocks']);
    }

    public function testSanitizesGlobalBlocksAndImageMapHotspots(): void
    {
        [, $localized] = $this->map([
            'blocks' => [
                ['type' => 'quote', 'text' => '<p>q</p>'.self::SCRIPT, 'title' => self::SCRIPT],
                ['type' => 'missing_global', 'text' => self::SCRIPT],
            ],
            'map' => [
                'imageId' => 7,
                'hotspots' => [
                    ['type' => 'text', 'hotspot' => ['type' => 'point'], 'text' => '<p>h</p>'.self::SCRIPT],
                    ['type' => 'quote', 'hotspot' => ['type' => 'point'], 'text' => '<p>g</p>'.self::SCRIPT],
                ],
            ],
        ]);

        self::assertSame([
            ['type' => 'quote', 'text' => '<p>q</p>', 'title' => self::SCRIPT],
            ['type' => 'missing_global', 'text' => self::SCRIPT],
        ], $localized->getTemplateData()['blocks']);
        self::assertSame([
            'imageId' => 7,
            'hotspots' => [
                ['type' => 'text', 'hotspot' => ['type' => 'point'], 'text' => '<p>h</p>'],
                ['type' => 'quote', 'hotspot' => ['type' => 'point'], 'text' => '<p>g</p>'],
            ],
        ], $localized->getTemplateData()['map']);
    }

    public function testSanitizesBlockSettings(): void
    {
        [, $localized] = $this->map([
            'blocks' => [
                ['type' => 'text', 'text' => '<p>a</p>', 'settings' => ['note' => '<p>n</p>'.self::SCRIPT, 'flag' => true]],
                ['type' => 'text', 'text' => '<p>b</p>'],
            ],
        ]);

        self::assertSame([
            ['type' => 'text', 'text' => '<p>a</p>', 'settings' => ['note' => '<p>n</p>', 'flag' => true]],
            ['type' => 'text', 'text' => '<p>b</p>'],
        ], $localized->getTemplateData()['blocks']);
    }

    public function testSanitizesTheExcerptDescription(): void
    {
        $localized = new TemplateDimensionContent('en', 'default');
        $localized->setExcerptData(['title' => 'T <script>', 'description' => '<p>d</p>'.self::SCRIPT]);

        $this->mapper()->map(new TemplateDimensionContent(null, null), $localized, [
            'excerpt' => ['title' => 'T <script>', 'description' => '<p>d</p>'.self::SCRIPT],
        ]);

        self::assertSame(['title' => 'T <script>', 'description' => '<p>d</p>'], $localized->getExcerptData());
    }

    public function testLeavesTheExcerptWhenTheSaveDidNotCarryIt(): void
    {
        $localized = new TemplateDimensionContent('en', 'default');
        $localized->setExcerptData(['description' => self::SCRIPT]);

        $this->mapper()->map(new TemplateDimensionContent(null, null), $localized, ['text' => '<p>x</p>']);

        self::assertSame(['description' => self::SCRIPT], $localized->getExcerptData());
    }

    public function testUsesTheShortNameOfSlashedProperties(): void
    {
        [, $localized] = $this->map(['slashed' => '<p>s</p>'.self::SCRIPT]);

        self::assertSame(['slashed' => '<p>s</p>'], $localized->getTemplateData());
    }

    public function testLeavesPropertiesTheSaveDidNotCarry(): void
    {
        $unlocalized = new TemplateDimensionContent(null, 'default', ['shared' => '<p>old</p>'.self::SCRIPT]);
        $localized = new TemplateDimensionContent('en', 'default', [
            'text' => '<p>new</p>'.self::SCRIPT,
            'teaser' => '<p>stored before Primavista</p>',
        ]);

        $this->mapper()->map($unlocalized, $localized, ['text' => '<p>new</p>'.self::SCRIPT]);

        self::assertSame(['text' => '<p>new</p>', 'teaser' => '<p>stored before Primavista</p>'], $localized->getTemplateData());
        self::assertSame(['shared' => '<p>old</p>'.self::SCRIPT], $unlocalized->getTemplateData());
    }

    public function testIgnoresUnknownTemplates(): void
    {
        $localized = new TemplateDimensionContent('en', 'missing', ['text' => self::SCRIPT]);

        $this->mapper()->map(new TemplateDimensionContent(null, null), $localized, ['text' => self::SCRIPT]);

        self::assertSame(['text' => self::SCRIPT], $localized->getTemplateData());
    }

    /**
     * Runs the mapper the way Sulu does after its TemplateDataMapper stored the request data.
     *
     * @param array<string, mixed> $data
     *
     * @return array{TemplateDimensionContent, TemplateDimensionContent}
     */
    private function map(array $data): array
    {
        $unlocalized = new TemplateDimensionContent(null, null, array_intersect_key($data, ['shared' => true]));
        $localized = new TemplateDimensionContent('en', 'default', array_diff_key($data, ['shared' => true]));

        $this->mapper()->map($unlocalized, $localized, $data);

        return [$unlocalized, $localized];
    }

    private function mapper(): TextEditorSanitizingDataMapper
    {
        $form = self::form([
            self::field('title', 'text_line'),
            self::field('text', 'text_editor'),
            self::section([self::field('teaser', 'text_editor', ['config' => 'mini'])]),
            self::field('shared', 'text_editor'),
            self::field('slashed/en', 'text_editor'),
            self::blocks('blocks', [
                'text' => self::form([self::field('title', 'text_line'), self::field('text', 'text_editor')]),
                'nested' => self::form([self::blocks('blocks', [
                    'text' => self::form([self::field('text', 'text_editor', ['formats' => ['h2']])]),
                ])]),
                'quote' => self::globalBlock('quote'),
                'missing_global' => self::globalBlock('missing_global'),
            ]),
            self::blocks('map', [
                'text' => self::form([self::field('text', 'text_editor')]),
                'quote' => self::globalBlock('quote'),
            ], 'image_map'),
        ]);
        $typedForm = new TypedFormMetadata();
        $typedForm->addForm('default', $form);

        // The block forms Sulu resolves `<type ref="quote"/>` against, without the tag.
        $blockForms = new TypedFormMetadata();
        $blockForms->addForm('quote', self::form([self::field('title', 'text_line'), self::field('text', 'text_editor')]));

        $excerptForm = self::form([self::field('excerpt/title', 'text_line'), self::field('excerpt/description', 'text_editor')]);
        $settingsForm = self::form([self::field('note', 'text_editor'), self::field('flag', 'checkbox')]);

        $provider = new class($typedForm, $blockForms, $excerptForm, $settingsForm) implements MetadataProviderInterface {
            public function __construct(
                private readonly TypedFormMetadata $metadata,
                private readonly TypedFormMetadata $blockForms,
                private readonly FormMetadata $excerptForm,
                private readonly FormMetadata $settingsForm,
            ) {
            }

            public function getMetadata(string $key, string $locale, array $metadataOptions): MetadataInterface
            {
                return match ($key) {
                    'block' => $this->blockForms,
                    'content_excerpt' => $this->excerptForm,
                    'block_settings' => $this->settingsForm,
                    default => $this->metadata,
                };
            }
        };
        $registry = new MetadataProviderRegistry(new ServiceLocator(['form' => static fn () => $provider]));

        return new TextEditorSanitizingDataMapper($registry, new TextEditorSanitizers([
            'default' => TextEditorSanitizers::DEFAULT_CONFIG,
            'mini' => ['enterMode' => 'br', 'tags' => ['a', 'strong', 'i'], 'attributes' => []],
        ]));
    }

    /**
     * @param list<FieldMetadata|SectionMetadata> $items
     */
    private static function form(array $items): FormMetadata
    {
        $form = new FormMetadata();
        foreach ($items as $item) {
            $form->addItem($item);
        }

        return $form;
    }

    /**
     * @param list<FieldMetadata> $fields
     */
    private static function section(array $fields): SectionMetadata
    {
        $section = new SectionMetadata('section');
        foreach ($fields as $field) {
            $section->addItem($field);
        }

        return $section;
    }

    /**
     * @param array<string, string|list<string>> $params
     */
    private static function field(string $name, string $type, array $params = []): FieldMetadata
    {
        $field = new FieldMetadata($name);
        $field->setType($type);
        foreach ($params as $paramName => $value) {
            $option = new OptionMetadata();
            $option->setName($paramName);
            if (\is_array($value)) {
                foreach ($value as $format) {
                    $valueOption = new OptionMetadata();
                    $valueOption->setName($format);
                    $option->addValueOption($valueOption);
                }
            } else {
                $option->setValue($value);
            }
            $field->addOption($option);
        }

        return $field;
    }

    /** The empty type Sulu's parser creates for `<type ref="…"/>`: only the tag, no items. */
    private static function globalBlock(string $name): FormMetadata
    {
        $tag = new TagMetadata();
        $tag->setName('sulu.global_block');
        $tag->setAttributes(['global_block' => $name]);
        $form = new FormMetadata();
        $form->addTag($tag);

        return $form;
    }

    /**
     * @param array<string, FormMetadata> $types
     */
    private static function blocks(string $name, array $types, string $fieldType = 'block'): FieldMetadata
    {
        $field = new FieldMetadata($name);
        $field->setType($fieldType);
        if ('block' === $fieldType) {
            $option = new OptionMetadata();
            $option->setName('settings_form_key');
            $option->setValue('block_settings');
            $field->addOption($option);
        }
        foreach ($types as $key => $type) {
            $type->setKey($key);
            $field->addType($type);
        }

        return $field;
    }
}
