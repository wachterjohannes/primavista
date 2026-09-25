<?php

declare(strict_types=1);

namespace Primavista\SuluBundle\Tests;

use PHPUnit\Framework\TestCase;
use Primavista\SuluBundle\Content\TextEditorSanitizingDataMapper;
use Primavista\SuluBundle\HtmlSanitizer\TextEditorSanitizers;
use Sulu\Bundle\AdminBundle\Metadata\MetadataProviderRegistry;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\ServiceLocator;
use Primavista\SuluBundle\PrimavistaSuluBundle;

final class BundleTest extends TestCase
{
    public function testPathPointsAtTheBundleRoot(): void
    {
        $bundle = new PrimavistaSuluBundle();

        self::assertSame(\dirname(__DIR__), $bundle->getPath());
        self::assertFileExists($bundle->getPath().'/translations/admin.en.json');
        self::assertFileExists($bundle->getPath().'/assets/admin/index.js');
    }

    public function testTranslationsCoverTheSameKeysInEveryLanguage(): void
    {
        $english = $this->translations('en');
        $german = $this->translations('de');

        self::assertSame(\array_keys($english), \array_keys($german));
        self::assertContains('sulu_admin.primavista.toolbar.bold', \array_keys($english));
        self::assertContains('sulu_admin.text_editor', \array_keys($english));
        foreach ($english as $key => $value) {
            self::assertStringStartsWith('sulu_admin.', $key);
            self::assertNotSame('', \trim($value), $key);
        }
    }

    public function testRegistersTheSanitizingDataMapperWithSulusConfigs(): void
    {
        $container = $this->container(['sanitize' => true], [
            'mini' => ['enterMode' => 'br', 'tags' => ['strong'], 'attributes' => []],
        ]);

        $definition = $container->getDefinition('primavista_sulu.text_editor_sanitizing_data_mapper');
        self::assertSame([['priority' => TextEditorSanitizingDataMapper::PRIORITY]], $definition->getTag('sulu_content.data_mapper'));

        $sanitizers = $container->get('primavista_sulu.text_editor_sanitizers');
        self::assertInstanceOf(TextEditorSanitizers::class, $sanitizers);
        self::assertSame('<strong>a</strong>b', $sanitizers->get('mini')->sanitize('<strong>a</strong><em>b</em>'));
    }

    public function testSanitizingCanBeSwitchedOff(): void
    {
        $container = $this->container(['sanitize' => false], null);

        self::assertFalse($container->hasDefinition('primavista_sulu.text_editor_sanitizing_data_mapper'));
        self::assertTrue($container->hasDefinition('primavista_sulu.text_editor_sanitizers'));
    }

    /**
     * @param array<string, mixed>                     $config
     * @param array<string, array<string, mixed>>|null $textEditorConfigs `sulu_admin.text_editor_configs`, null on Sulu 3.0
     */
    private function container(array $config, ?array $textEditorConfigs): ContainerBuilder
    {
        $container = new ContainerBuilder();
        $container->setParameter('kernel.environment', 'test');
        $container->setParameter('kernel.build_dir', sys_get_temp_dir());
        if (null !== $textEditorConfigs) {
            $container->setParameter(PrimavistaSuluBundle::TEXT_EDITOR_CONFIGS_PARAMETER, $textEditorConfigs);
        }
        $container->register('sulu_admin.metadata_provider_registry', MetadataProviderRegistry::class)
            ->addArgument(new ServiceLocator([]));

        $bundle = new PrimavistaSuluBundle();
        $bundle->build($container);
        $extension = $bundle->getContainerExtension();
        self::assertNotNull($extension);
        $extension->load([$config], $container);

        foreach ($container->getDefinitions() as $definition) {
            $definition->setPublic(true);
        }
        $container->compile();

        return $container;
    }

    /**
     * @return array<string, string>
     */
    private function translations(string $locale): array
    {
        $content = \file_get_contents(\dirname(__DIR__).'/translations/admin.'.$locale.'.json');
        self::assertNotFalse($content);

        /** @var array<string, string> $decoded */
        $decoded = \json_decode($content, true, 512, \JSON_THROW_ON_ERROR);

        return $decoded;
    }
}
