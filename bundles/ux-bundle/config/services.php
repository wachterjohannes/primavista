<?php

declare(strict_types=1);

use Primavista\UxBundle\Form\PrimavistaType;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;

use function Symfony\Component\DependencyInjection\Loader\Configurator\service;

return static function (ContainerConfigurator $container): void {
    $container->services()
        ->set('primavista.form.type', PrimavistaType::class)
            ->args([service('stimulus.helper')])
            ->tag('form.type')
        ->alias(PrimavistaType::class, 'primavista.form.type');
};
