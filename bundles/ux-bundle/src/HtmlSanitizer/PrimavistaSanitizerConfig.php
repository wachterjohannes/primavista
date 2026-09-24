<?php

declare(strict_types=1);

namespace Primavista\UxBundle\HtmlSanitizer;

use Symfony\Component\HtmlSanitizer\HtmlSanitizerConfig;

/**
 * The `symfony/html-sanitizer` configuration for the markup Primavista
 * emits, and nothing else. The bundle registers it as the `primavista`
 * sanitizer, other hosts build their own from it:
 *
 * `new HtmlSanitizer(PrimavistaSanitizerConfig::create('sulu-link', 'sulu-validation-state'))`
 *
 * Unknown elements are dropped with their children, unknown attributes are
 * dropped. Add to the returned config for markup of custom plugins.
 */
final class PrimavistaSanitizerConfig
{
    /** Blocks that carry `style="text-align: …"` from the alignment plugin. */
    public const ALIGNABLE_ELEMENTS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th'];

    private const TEXT_ELEMENTS = ['strong', 'em', 'u', 's', 'code', 'sub', 'sup', 'br'];

    private const TABLE_ELEMENTS = ['table', 'thead', 'tbody', 'tr'];

    /**
     * @param string $internalLinkTag     element name of the internal link, `InternalLinkNode.tagName` in the core
     * @param string $validationAttribute attribute for unpublished or removed targets, `InternalLinkNode.validationAttribute` in the core
     */
    public static function create(
        string $internalLinkTag = 'internal-link',
        string $validationAttribute = 'validation-state',
    ): HtmlSanitizerConfig {
        $config = new HtmlSanitizerConfig();

        foreach (self::ALIGNABLE_ELEMENTS as $element) {
            // Lexical writes `dir` for right-to-left blocks, the editor removes only `ltr`.
            $attributes = \in_array($element, ['td', 'th'], true) ? ['style', 'colspan', 'rowspan'] : ['style', 'dir'];
            $config = $config->allowElement($element, $attributes);
        }
        foreach ([...self::TEXT_ELEMENTS, ...self::TABLE_ELEMENTS] as $element) {
            $config = $config->allowElement($element);
        }

        return $config
            ->allowElement('ul', ['dir'])
            ->allowElement('ol', ['dir', 'start'])
            ->allowElement('span', ['lang'])
            ->allowElement('a', ['href', 'target', 'title', 'rel'])
            ->allowElement($internalLinkTag, ['href', 'provider', 'target', 'title', $validationAttribute])
            // CKEditor's table wrapper, written with `html.tableWrapper: 'figure'`.
            ->allowElement('figure')
            ->forceAttribute('figure', 'class', 'table')
            ->withAttributeSanitizer(new TextAlignAttributeSanitizer())
            ->allowRelativeLinks()
            // Symfony checks `href` outside of `<a>` against the media rules.
            // Nothing else here loads media, so these rules only apply to the
            // internal link, whose href is a resource id and never has a scheme.
            ->allowRelativeMedias()
            ->allowMediaSchemes([])
            // The default of 20,000 bytes would cut long articles. The request
            // size limit of the server bounds the input already.
            ->withMaxInputLength(-1);
    }
}
