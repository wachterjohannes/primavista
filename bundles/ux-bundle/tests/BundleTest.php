<?php

declare(strict_types=1);

namespace Primavista\UxBundle\Tests;

use Primavista\UxBundle\Form\PrimavistaType;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\AssetMapper\AssetMapperInterface;
use Symfony\Component\Form\FormFactoryInterface;
use Symfony\Component\HtmlSanitizer\HtmlSanitizerInterface;

final class BundleTest extends KernelTestCase
{
    public function testFormTypeIsRegistered(): void
    {
        self::bootKernel();
        $factory = self::getContainer()->get('test.form_factory');
        \assert($factory instanceof FormFactoryInterface);

        $view = $factory->create(PrimavistaType::class, '<p>x</p>', ['placeholder' => 'Type'])->createView();

        self::assertSame('primavista--ux-bundle--editor', $view->vars['attr']['data-controller']);
        self::assertSame('<p>x</p>', $view->vars['value']);
    }

    public function testSanitizesSubmittedHtmlWithThePrimavistaSanitizer(): void
    {
        self::bootKernel();
        $factory = self::getContainer()->get('test.form_factory');
        \assert($factory instanceof FormFactoryInterface);

        $form = $factory->create(PrimavistaType::class);
        $form->submit('<p style="text-align: right;">a <internal-link href="1" provider="page">b</internal-link></p><img src="x" onerror="alert(1)">');

        self::assertSame('<p style="text-align: right;">a <internal-link href="1" provider="page">b</internal-link></p>', $form->getData());
    }

    public function testSanitizerIsRegisteredByName(): void
    {
        self::bootKernel();
        $sanitizer = self::getContainer()->get('test.primavista_sanitizer');
        \assert($sanitizer instanceof HtmlSanitizerInterface);

        self::assertSame('<p>a</p>', $sanitizer->sanitize('<p onclick="alert(1)">a</p>'));
    }

    public function testControllerAssetsAreMapped(): void
    {
        self::bootKernel();
        $assetMapper = self::getContainer()->get('asset_mapper');
        \assert($assetMapper instanceof AssetMapperInterface);

        self::assertNotNull($assetMapper->getAsset('@primavista/ux-bundle/dist/controller.js'));
        self::assertNotNull($assetMapper->getAsset('@primavista/ux-bundle/dist/primavista.css'));
    }
}
