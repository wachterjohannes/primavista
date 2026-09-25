<?php

declare(strict_types=1);

namespace Primavista\SuluBundle\Tests\Fixtures;

use Sulu\Content\Domain\Model\ContentRichEntityInterface;
use Sulu\Content\Domain\Model\DimensionContentInterface;
use Sulu\Content\Domain\Model\DimensionContentTrait;
use Sulu\Content\Domain\Model\ExcerptInterface;
use Sulu\Content\Domain\Model\ExcerptTrait;
use Sulu\Content\Domain\Model\TemplateInterface;
use Sulu\Content\Domain\Model\TemplateTrait;

/**
 * The part of a page, snippet or article dimension content the data mapper
 * sees: locale, template key, template data and the excerpt.
 *
 * @implements DimensionContentInterface<ContentRichEntityInterface<self>>
 */
final class TemplateDimensionContent implements DimensionContentInterface, TemplateInterface, ExcerptInterface
{
    use DimensionContentTrait;
    use ExcerptTrait;
    use TemplateTrait;

    /**
     * @param array<string, mixed> $templateData
     */
    public function __construct(?string $locale, ?string $templateKey, array $templateData = [])
    {
        $this->setLocale($locale);
        $this->templateKey = $templateKey;
        $this->setTemplateData($templateData);
    }

    public static function getResourceKey(): string
    {
        return 'examples';
    }

    public static function getTemplateType(): string
    {
        return 'example';
    }

    /**
     * @return ContentRichEntityInterface<self>
     */
    public function getResource(): ContentRichEntityInterface
    {
        throw new \LogicException('Not needed by the data mapper.');
    }
}
