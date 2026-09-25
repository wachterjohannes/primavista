<?php

declare(strict_types=1);

namespace Primavista\UxBundle\Tests\Form;

use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use Primavista\UxBundle\Form\PrimavistaType;
use Primavista\UxBundle\HtmlSanitizer\PrimavistaSanitizerConfig;
use Symfony\Component\DependencyInjection\ServiceLocator;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\Extension\HtmlSanitizer\Type\TextTypeHtmlSanitizerExtension;
use Symfony\Component\Form\PreloadedExtension;
use Symfony\Component\Form\Test\TypeTestCase;
use Symfony\Component\HtmlSanitizer\HtmlSanitizer;
use Symfony\Component\HtmlSanitizer\HtmlSanitizerConfig;
use Symfony\UX\StimulusBundle\Helper\StimulusHelper;

/**
 * With FrameworkBundle's html_sanitizer form extension, the way an app runs
 * the type. PrimavistaTypeTest covers the type without it.
 */
#[AllowMockObjectsWithoutExpectations]
final class PrimavistaTypeSanitizingTest extends TypeTestCase
{
    private const HTML = '<p style="text-align: center;" onclick="alert(1)"><internal-link href="1" provider="page">a</internal-link></p><script>alert(1)</script>';

    protected function getExtensions(): array
    {
        $sanitizers = new ServiceLocator([
            'default' => static fn () => new HtmlSanitizer((new HtmlSanitizerConfig())->allowSafeElements()),
            PrimavistaType::SANITIZER => static fn () => new HtmlSanitizer(PrimavistaSanitizerConfig::create()),
        ]);

        return [
            new PreloadedExtension(
                [new PrimavistaType(new StimulusHelper(null))],
                [TextType::class => [new TextTypeHtmlSanitizerExtension($sanitizers)]],
            ),
        ];
    }

    public function testSanitizesWithThePrimavistaSanitizerByDefault(): void
    {
        $form = $this->factory->create(PrimavistaType::class);
        $form->submit(self::HTML);

        self::assertSame('<p style="text-align: center;"><internal-link href="1" provider="page">a</internal-link></p>', $form->getData());
    }

    public function testUsesAnotherSanitizer(): void
    {
        $form = $this->factory->create(PrimavistaType::class, null, ['sanitizer' => 'default']);
        $form->submit(self::HTML);

        self::assertSame('<p></p>', $form->getData());
    }

    public function testCanBeSwitchedOff(): void
    {
        $form = $this->factory->create(PrimavistaType::class, null, ['sanitize_html' => false]);
        $form->submit(self::HTML);

        self::assertSame(self::HTML, $form->getData());
    }

    public function testLeavesOtherTextFieldsAlone(): void
    {
        $form = $this->factory->create(TextareaType::class);
        $form->submit(self::HTML);

        self::assertSame(self::HTML, $form->getData());
    }
}
