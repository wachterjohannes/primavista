<?php

declare(strict_types=1);

namespace Primavista\HtmlSanitizer;

use Symfony\Component\HtmlSanitizer\HtmlSanitizerConfig;
use Symfony\Component\HtmlSanitizer\HtmlSanitizerAction;

/**
 * The `symfony/html-sanitizer` configuration for the markup Primavista
 * emits, and nothing else. `primavista/ux-bundle` registers it as the
 * `primavista` sanitizer, `primavista/sulu-bundle` builds one per Sulu text
 * editor config, other hosts build their own from it:
 *
 * `new HtmlSanitizer(PrimavistaSanitizerConfig::create('sulu-link', 'sulu-validation-state'))`
 *
 * Unknown elements lose their tag but keep their text, because a field that
 * was not touched posts its stored markup as is, and content written by
 * another editor (`<b>`, `<i>`, `<div>`) must survive a save that only changed
 * the title. Only elements that carry executable or foreign content are
 * dropped with their children. Unknown attributes are dropped. Add to the
 * returned config for markup of custom plugins.
 */
final class PrimavistaSanitizerConfig
{
    /** Blocks that carry `style="text-align: …"` from the alignment plugin. */
    public const ALIGNABLE_ELEMENTS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th'];

    /**
     * Elements a plugin adds, the vocabulary of `$elements`. `ul` and `ol`
     * bring `li`, `table` brings its sections, rows, cells and the `figure`
     * wrapper, `a` brings the internal link, `pre` brings the `code` inside it.
     */
    public const ELEMENTS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'u', 's', 'sub', 'sup', 'code', 'ul', 'ol', 'a', 'table', 'blockquote', 'pre', 'hr'];

    private const HEADING_ELEMENTS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

    private const TEXT_ELEMENTS = ['strong', 'em', 'u', 's', 'code', 'sub', 'sup'];

    private const TABLE_ELEMENTS = ['table', 'thead', 'tbody', 'tr'];

    /** Elements whose content must not leak into text: scripts, embeds, form controls, foreign namespaces. */
    private const DROPPED_ELEMENTS = ['script', 'noscript', 'template', 'iframe', 'object', 'embed', 'svg', 'math', 'textarea', 'select', 'button', 'form'];

    /**
     * Without `$elements` the config allows everything the default plugins
     * emit. With it, only paragraphs, line breaks and the listed elements, for
     * an editor with fewer plugins, for example one driven by a Sulu text
     * editor config.
     *
     * @param string            $internalLinkTag     element name of the internal link, `InternalLinkNode.tagName` in the core
     * @param string            $validationAttribute attribute for unpublished or removed targets, `InternalLinkNode.validationAttribute` in the core
     * @param list<string>|null $elements            entries of `ELEMENTS`, null for all of them
     * @param bool              $alignment           `style="text-align: …"` on blocks and cells, the alignment plugin
     * @param bool              $language            `<span lang>`, the language plugin
     */
    public static function create(
        string $internalLinkTag = 'internal-link',
        string $validationAttribute = 'validation-state',
        ?array $elements = null,
        bool $alignment = true,
        bool $language = true,
    ): HtmlSanitizerConfig {
        // `p` and `br` are always allowed, naming them is not an error.
        $unknown = array_diff($elements ?? [], self::ELEMENTS, ['p', 'br']);
        if ([] !== $unknown) {
            throw new \InvalidArgumentException(\sprintf('Unknown elements "%s", expected any of "%s".', implode('", "', $unknown), implode('", "', self::ELEMENTS)));
        }
        $enabled = static fn (string $element): bool => null === $elements || \in_array($element, $elements, true);
        $blockAttributes = $alignment ? ['style', 'dir'] : ['dir'];

        $config = (new HtmlSanitizerConfig())
            ->defaultAction(HtmlSanitizerAction::Block)
            ->allowElement('p', $blockAttributes)
            ->allowElement('br');

        foreach (self::DROPPED_ELEMENTS as $element) {
            $config = $config->dropElement($element);
        }
        foreach (self::HEADING_ELEMENTS as $element) {
            if ($enabled($element)) {
                $config = $config->allowElement($element, $blockAttributes);
            }
        }
        foreach (self::TEXT_ELEMENTS as $element) {
            if ($enabled($element)) {
                $config = $config->allowElement($element);
            }
        }
        if ($enabled('ul') || $enabled('ol')) {
            $config = $config->allowElement('li', $blockAttributes);
        }
        if ($enabled('ul')) {
            $config = $config->allowElement('ul', ['dir']);
        }
        if ($enabled('ol')) {
            $config = $config->allowElement('ol', ['dir', 'start']);
        }
        if ($enabled('table')) {
            foreach (self::TABLE_ELEMENTS as $element) {
                $config = $config->allowElement($element);
            }
            $cellAttributes = $alignment ? ['style', 'colspan', 'rowspan'] : ['colspan', 'rowspan'];
            $config = $config
                ->allowElement('td', $cellAttributes)
                ->allowElement('th', $cellAttributes)
                // CKEditor's table wrapper, written with `html.tableWrapper: 'figure'`.
                ->allowElement('figure')
                ->forceAttribute('figure', 'class', 'table');
        }
        if ($enabled('a')) {
            $config = $config
                ->allowElement('a', ['href', 'target', 'title', 'rel'])
                ->allowElement($internalLinkTag, ['href', 'provider', 'target', 'title', $validationAttribute]);
        }
        if ($enabled('blockquote')) {
            $config = $config->allowElement('blockquote', ['dir']);
        }
        if ($enabled('pre')) {
            $config = $config->allowElement('pre')->allowElement('code');
        }
        if ($enabled('hr')) {
            $config = $config->allowElement('hr');
        }
        if ($language) {
            $config = $config->allowElement('span', ['lang']);
        }
        if ($alignment) {
            $config = $config->withAttributeSanitizer(new TextAlignAttributeSanitizer());
        }

        return $config
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
