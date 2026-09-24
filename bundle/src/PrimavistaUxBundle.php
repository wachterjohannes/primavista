<?php

declare(strict_types=1);

namespace Primavista\UxBundle;

use Symfony\Component\AssetMapper\AssetMapperInterface;
use Symfony\Component\Config\Definition\Configurator\DefinitionConfigurator;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\HttpKernel\Bundle\AbstractBundle;

final class PrimavistaUxBundle extends AbstractBundle
{
    public function configure(DefinitionConfigurator $definition): void
    {
        $definition->rootNode()->children()->end();
    }

    /**
     * @param array<string, mixed> $config
     */
    public function loadExtension(array $config, ContainerConfigurator $container, ContainerBuilder $builder): void
    {
        $container->import('../config/services.php');
    }

    public function prependExtension(ContainerConfigurator $container, ContainerBuilder $builder): void
    {
        if (!interface_exists(AssetMapperInterface::class) || !$this->isAssetMapperEnabled($builder)) {
            return;
        }

        $builder->prependExtensionConfig('framework', [
            'asset_mapper' => [
                'paths' => [
                    __DIR__.'/../assets/dist' => '@primavista/ux-bundle/dist',
                ],
            ],
        ]);
    }

    private function isAssetMapperEnabled(ContainerBuilder $builder): bool
    {
        $bundles = $builder->getParameter('kernel.bundles');
        if (!\is_array($bundles) || !isset($bundles['FrameworkBundle'])) {
            return false;
        }

        foreach ($builder->getExtensionConfig('framework') as $config) {
            if (isset($config['asset_mapper']['enabled']) && false === $config['asset_mapper']['enabled']) {
                return false;
            }
        }

        return true;
    }
}
