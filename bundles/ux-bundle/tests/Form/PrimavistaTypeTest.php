<?php

declare(strict_types=1);

namespace Primavista\UxBundle\Tests\Form;

use PHPUnit\Framework\Attributes\AllowMockObjectsWithoutExpectations;
use Primavista\UxBundle\Form\PrimavistaType;
use Symfony\Component\Form\PreloadedExtension;
use Symfony\Component\Form\Test\TypeTestCase;
use Symfony\UX\StimulusBundle\Helper\StimulusHelper;

/** TypeTestCase mocks the event dispatcher without expectations. */
#[AllowMockObjectsWithoutExpectations]
final class PrimavistaTypeTest extends TypeTestCase
{
    protected function getExtensions(): array
    {
        return [
            new PreloadedExtension([new PrimavistaType(new StimulusHelper(null))], []),
        ];
    }

    public function testRendersStimulusController(): void
    {
        $view = $this->factory->create(PrimavistaType::class)->createView();

        self::assertSame('primavista--ux-bundle--editor', $view->vars['attr']['data-controller']);
        self::assertArrayNotHasKey('data-primavista--ux-bundle--editor-placeholder-value', $view->vars['attr']);
        self::assertContains('primavista', $view->vars['block_prefixes']);
        self::assertContains('textarea', $view->vars['block_prefixes']);
    }

    public function testPassesPlaceholderAsValue(): void
    {
        $view = $this->factory->create(PrimavistaType::class, null, ['placeholder' => 'Write here'])->createView();

        self::assertSame('Write here', $view->vars['attr']['data-primavista--ux-bundle--editor-placeholder-value']);
    }

    public function testPassesThemeAsValue(): void
    {
        $view = $this->factory->create(PrimavistaType::class, null, ['theme' => 'sulu'])->createView();

        self::assertSame('sulu', $view->vars['attr']['data-primavista--ux-bundle--editor-theme-value']);
    }

    public function testKeepsAdditionalControllers(): void
    {
        $view = $this->factory
            ->create(PrimavistaType::class, null, ['attr' => ['data-controller' => 'app--tracker', 'rows' => 12]])
            ->createView();

        self::assertSame('app--tracker primavista--ux-bundle--editor', $view->vars['attr']['data-controller']);
        self::assertSame(12, $view->vars['attr']['rows']);
    }

    public function testSubmitsHtmlAsString(): void
    {
        $form = $this->factory->create(PrimavistaType::class);
        $form->submit('<p>Hello <strong>world</strong></p>');

        self::assertTrue($form->isSynchronized());
        self::assertSame('<p>Hello <strong>world</strong></p>', $form->getData());
    }

    public function testRejectsInvalidPlaceholderType(): void
    {
        $this->expectException(\Symfony\Component\OptionsResolver\Exception\InvalidOptionsException::class);

        $this->factory->create(PrimavistaType::class, null, ['placeholder' => 42]);
    }
}
