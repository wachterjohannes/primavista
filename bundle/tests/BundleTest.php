<?php

declare(strict_types=1);

namespace Primavista\UxBundle\Tests;

use Primavista\UxBundle\Form\PrimavistaType;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\AssetMapper\AssetMapperInterface;
use Symfony\Component\Form\FormFactoryInterface;

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

    public function testControllerAssetsAreMapped(): void
    {
        self::bootKernel();
        $assetMapper = self::getContainer()->get('asset_mapper');
        \assert($assetMapper instanceof AssetMapperInterface);

        self::assertNotNull($assetMapper->getAsset('@primavista/ux-bundle/dist/controller.js'));
        self::assertNotNull($assetMapper->getAsset('@primavista/ux-bundle/dist/primavista.css'));
    }
}
