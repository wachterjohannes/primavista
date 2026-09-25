<?php

declare(strict_types=1);

namespace Primavista\SuluBundle;

use Primavista\SuluBundle\Content\TextEditorSanitizingDataMapper;
use Primavista\SuluBundle\HtmlSanitizer\TextEditorSanitizers;
use Primavista\SuluBundle\HtmlSanitizer\TextEditorSanitizersInterface;
use Sulu\Content\Application\ContentDataMapper\DataMapper\DataMapperInterface;
use Symfony\Component\Config\Definition\Configurator\DefinitionConfigurator;
use Symfony\Component\DependencyInjection\Compiler\CompilerPassInterface;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\HttpKernel\Bundle\AbstractBundle;

use function Symfony\Component\DependencyInjection\Loader\Configurator\service;

/**
 * Registers the translations of the editor's toolbar and link forms with
 * Symfony's translator, from which Sulu Admin loads its "admin" domain.
 * The JavaScript side lives in assets/admin and is imported by the
 * project's admin build, see README.md.
 *
 * With Sulu's content packages installed it also sanitizes every
 * `text_editor` value on save, see `TextEditorSanitizingDataMapper`.
 */
final class PrimavistaSuluBundle extends AbstractBundle
{
    /** Where Sulu 3.1 puts the resolved text editor configs (sulu/sulu#9091). */
    public const TEXT_EDITOR_CONFIGS_PARAMETER = 'sulu_admin.text_editor_configs';

    public function getPath(): string
    {
        return \dirname(__DIR__);
    }

    public function configure(DefinitionConfigurator $definition): void
    {
        $definition->rootNode()
            ->children()
                ->booleanNode('sanitize')
                    ->defaultTrue()
                    ->info('Sanitize text_editor values on save with the property\'s text editor config.')
                ->end()
            ->end();
    }

    /**
     * @param array{sanitize: bool} $config
     */
    public function loadExtension(array $config, ContainerConfigurator $container, ContainerBuilder $builder): void
    {
        $container->services()
            ->set('primavista_sulu.text_editor_sanitizers', TextEditorSanitizers::class)
            ->alias(TextEditorSanitizers::class, 'primavista_sulu.text_editor_sanitizers')
            ->alias(TextEditorSanitizersInterface::class, 'primavista_sulu.text_editor_sanitizers');

        if (!$config['sanitize'] || !interface_exists(DataMapperInterface::class)) {
            return;
        }

        $container->services()
            ->set('primavista_sulu.text_editor_sanitizing_data_mapper', TextEditorSanitizingDataMapper::class)
                ->args([
                    service('sulu_admin.metadata_provider_registry'),
                    service('primavista_sulu.text_editor_sanitizers'),
                ])
                ->tag('sulu_content.data_mapper', ['priority' => TextEditorSanitizingDataMapper::PRIORITY]);
    }

    public function build(ContainerBuilder $container): void
    {
        // Sulu's admin extension may load after this one, so the configs
        // are read once every extension has set its parameters.
        $container->addCompilerPass(new class implements CompilerPassInterface {
            public function process(ContainerBuilder $container): void
            {
                if ($container->hasParameter(PrimavistaSuluBundle::TEXT_EDITOR_CONFIGS_PARAMETER)) {
                    $container->getDefinition('primavista_sulu.text_editor_sanitizers')
                        ->setArgument(0, '%'.PrimavistaSuluBundle::TEXT_EDITOR_CONFIGS_PARAMETER.'%');
                }
            }
        });
    }
}
