<?php

declare(strict_types=1);

namespace Primavista\SuluBundle\Tests\Content;

use Doctrine\Common\Collections\ArrayCollection;
use PHPUnit\Framework\TestCase;
use Primavista\SuluBundle\Content\TextEditorSanitizingDataMapper;
use Primavista\SuluBundle\HtmlSanitizer\TextEditorSanitizers;
use Primavista\SuluBundle\Tests\Fixtures\TemplateDimensionContent;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\FieldMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\FormMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\TagMetadata;
use Sulu\Bundle\AdminBundle\Metadata\FormMetadata\TypedFormMetadata;
use Sulu\Bundle\AdminBundle\Metadata\MetadataInterface;
use Sulu\Bundle\AdminBundle\Metadata\MetadataProviderInterface;
use Sulu\Bundle\AdminBundle\Metadata\MetadataProviderRegistry;
use Sulu\Content\Application\ContentDataMapper\ContentDataMapper;
use Sulu\Content\Application\ContentDataMapper\DataMapper\DataMapperInterface;
use Sulu\Content\Application\ContentDataMapper\DataMapper\ExcerptDataMapper;
use Sulu\Content\Application\ContentDataMapper\DataMapper\TemplateDataMapper;
use Sulu\Content\Domain\Model\DimensionContentCollection;
use Symfony\Component\DependencyInjection\ServiceLocator;

/**
 * The mapper behind Sulu's own TemplateDataMapper and ExcerptDataMapper, in
 * the order the tagged iterator produces, with the data a save request posts.
 */
final class ContentDataMapperIntegrationTest extends TestCase
{
    private const SCRIPT = '<script>alert(1)</script>';

    public function testSanitizesWhatSulusMappersStored(): void
    {
        $unlocalized = new TemplateDimensionContent(null, null);
        $localized = new TemplateDimensionContent('en', null);
        $collection = new DimensionContentCollection(
            new ArrayCollection([$unlocalized, $localized]),
            ['locale' => 'en', 'stage' => 'draft'],
            TemplateDimensionContent::class,
        );

        $this->contentDataMapper()->map($collection, ['locale' => 'en', 'stage' => 'draft'], [
            'template' => 'default',
            'title' => 'Title',
            'text' => '<p>Body</p>'.self::SCRIPT,
            'blocks' => [
                ['type' => 'text', 'text' => '<p>a</p>'.self::SCRIPT],
                ['type' => 'quote', 'text' => '<p>q</p>'.self::SCRIPT],
            ],
            'excerpt' => ['title' => 'E', 'description' => '<p>d</p>'.self::SCRIPT],
        ]);

        self::assertSame('default', $localized->getTemplateKey());
        self::assertSame([
            'title' => 'Title',
            'text' => '<p>Body</p>',
            'blocks' => [
                ['type' => 'text', 'text' => '<p>a</p>'],
                ['type' => 'quote', 'text' => '<p>q</p>'],
            ],
        ], $localized->getTemplateData());
        self::assertSame(['title' => 'E', 'description' => '<p>d</p>'], $localized->getExcerptData());
    }

    private function contentDataMapper(): ContentDataMapper
    {
        $registry = new MetadataProviderRegistry(new ServiceLocator(['form' => fn () => $this->formProvider()]));
        $sanitizing = new TextEditorSanitizingDataMapper($registry, new TextEditorSanitizers());

        /** @var list<array{DataMapperInterface, int}> $tagged */
        $tagged = [
            [new TemplateDataMapper($registry), 128],
            [new ExcerptDataMapper($this->formProvider()), 64],
            [$sanitizing, TextEditorSanitizingDataMapper::PRIORITY],
        ];
        usort($tagged, static fn (array $a, array $b) => $b[1] <=> $a[1]);

        return new ContentDataMapper(array_map(static fn (array $entry) => $entry[0], $tagged));
    }

    private function formProvider(): MetadataProviderInterface
    {
        $quoteRef = new FormMetadata();
        $tag = new TagMetadata();
        $tag->setName('sulu.global_block');
        $tag->setAttributes(['global_block' => 'quote']);
        $quoteRef->addTag($tag);
        $quoteRef->setKey('quote');

        $textType = self::form([self::field('text', 'text_editor')]);
        $textType->setKey('text');
        $blocks = new FieldMetadata('blocks');
        $blocks->setType('block');
        $blocks->setMultilingual(true);
        $blocks->addType($textType);
        $blocks->addType($quoteRef);

        $template = self::form([self::field('title', 'text_line'), self::field('text', 'text_editor'), $blocks]);
        $templates = new TypedFormMetadata();
        $templates->addForm('default', $template);
        $templates->setDefaultType('default');

        $blockForms = new TypedFormMetadata();
        $blockForms->addForm('quote', self::form([self::field('text', 'text_editor')]));

        $excerpt = self::form([self::field('excerpt/title', 'text_line'), self::field('excerpt/description', 'text_editor')]);

        return new class($templates, $blockForms, $excerpt) implements MetadataProviderInterface {
            public function __construct(
                private readonly TypedFormMetadata $templates,
                private readonly TypedFormMetadata $blockForms,
                private readonly FormMetadata $excerpt,
            ) {
            }

            public function getMetadata(string $key, string $locale, array $metadataOptions): MetadataInterface
            {
                return match ($key) {
                    'block' => $this->blockForms,
                    'content_excerpt' => $this->excerpt,
                    default => $this->templates,
                };
            }
        };
    }

    /**
     * @param list<FieldMetadata> $fields
     */
    private static function form(array $fields): FormMetadata
    {
        $form = new FormMetadata();
        foreach ($fields as $field) {
            $form->addItem($field);
        }

        return $form;
    }

    private static function field(string $name, string $type): FieldMetadata
    {
        $field = new FieldMetadata($name);
        $field->setType($type);
        $field->setMultilingual(true);

        return $field;
    }
}
