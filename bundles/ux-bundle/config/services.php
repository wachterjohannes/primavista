<?php

declare(strict_types=1);

use Primavista\UxBundle\Form\PrimavistaType;
use Primavista\UxBundle\HtmlSanitizer\PrimavistaSanitizerConfig;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\HtmlSanitizer\HtmlSanitizer;
use Symfony\Component\HtmlSanitizer\HtmlSanitizerConfig;
use Symfony\Component\HtmlSanitizer\HtmlSanitizerInterface;

use function Symfony\Component\DependencyInjection\Loader\Configurator\service;

return static function (ContainerConfigurator $container): void {
    $container->services()
        ->set('primavista.form.type', PrimavistaType::class)
            ->args([service('stimulus.helper')])
            ->tag('form.type')
        ->alias(PrimavistaType::class, 'primavista.form.type')

        // Registered the way FrameworkBundle registers the sanitizers of
        // framework.html_sanitizer, so the `sanitizer` form option, the Twig
        // filter `sanitize_html` and autowiring find it by name.
        ->set('html_sanitizer.config.primavista', HtmlSanitizerConfig::class)
            ->factory([PrimavistaSanitizerConfig::class, 'create'])
        ->set('html_sanitizer.sanitizer.primavista', HtmlSanitizer::class)
            ->args([service('html_sanitizer.config.primavista')])
            ->tag('html_sanitizer', ['sanitizer' => PrimavistaType::SANITIZER])
        ->alias(HtmlSanitizerInterface::class.' $primavistaSanitizer', 'html_sanitizer.sanitizer.primavista');
};
