<?php

declare(strict_types=1);

namespace Primavista\SuluBundle\HtmlSanitizer;

use Symfony\Component\HtmlSanitizer\HtmlSanitizerInterface;

/**
 * The sanitizer of a `text_editor` property. Decorate or replace the service
 * `primavista_sulu.text_editor_sanitizers` to allow the markup of custom
 * plugins, for example `<mark>` from a highlight plugin.
 */
interface TextEditorSanitizersInterface
{
    /**
     * @param string|null       $configName the property's `config` param, null for none
     * @param list<string>|null $formats    its deprecated `formats` param, null for none
     */
    public function get(?string $configName, ?array $formats = null): HtmlSanitizerInterface;
}
