<?php

declare(strict_types=1);

namespace Primavista\UxBundle\Tests\Fixtures;

use Primavista\UxBundle\PrimavistaUxBundle;
use Symfony\Bundle\FrameworkBundle\FrameworkBundle;
use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Bundle\TwigBundle\TwigBundle;
use Symfony\Component\Config\Loader\LoaderInterface;
use Symfony\Component\HttpKernel\Kernel;
use Symfony\UX\StimulusBundle\StimulusBundle;

final class TestKernel extends Kernel
{
    use MicroKernelTrait;

    public function registerBundles(): iterable
    {
        return [
            new FrameworkBundle(),
            new TwigBundle(),
            new StimulusBundle(),
            new PrimavistaUxBundle(),
        ];
    }

    public function registerContainerConfiguration(LoaderInterface $loader): void
    {
        $loader->load(static function ($container): void {
            $container->loadFromExtension('framework', [
                'secret' => 'test',
                'test' => true,
                'http_method_override' => false,
                'handle_all_throwables' => true,
                'php_errors' => ['log' => true],
                'form' => ['enabled' => true],
                'csrf_protection' => false,
                'asset_mapper' => [
                    'paths' => [__DIR__.'/assets'],
                ],
                'validation' => false,
            ]);
            $container->loadFromExtension('twig', [
                'strict_variables' => true,
            ]);
            $container->setAlias('test.form_factory', 'form.factory')->setPublic(true);
        });
    }

    public function getCacheDir(): string
    {
        return sys_get_temp_dir().'/primavista-ux-bundle/cache/'.spl_object_id($this);
    }

    public function getLogDir(): string
    {
        return sys_get_temp_dir().'/primavista-ux-bundle/log';
    }

    public function getProjectDir(): string
    {
        return __DIR__;
    }
}
