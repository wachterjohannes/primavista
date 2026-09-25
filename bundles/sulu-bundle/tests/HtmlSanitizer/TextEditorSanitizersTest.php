<?php

declare(strict_types=1);

namespace Primavista\SuluBundle\Tests\HtmlSanitizer;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Primavista\SuluBundle\HtmlSanitizer\TextEditorSanitizers;

final class TextEditorSanitizersTest extends TestCase
{
    /** The configs Sulu 3.1 ships, as `sulu_admin.text_editor_configs` holds them. */
    private const CONFIGS = [
        'default' => TextEditorSanitizers::DEFAULT_CONFIG,
        'mini' => ['enterMode' => 'br', 'tags' => ['a', 'strong', 'i'], 'attributes' => []],
        'multilingual' => ['enterMode' => 'p', 'tags' => ['strong'], 'attributes' => ['lang', 'align']],
    ];

    /**
     * What Primavista writes with `suluPreset()`, and what CKEditor wrote before.
     *
     * @return iterable<string, array{string}>
     */
    public static function defaultMarkup(): iterable
    {
        yield 'headings h2 to h6' => ['<h2>2</h2><h3>3</h3><h4>4</h4><h5>5</h5><h6>6</h6>'];
        yield 'inline formats' => ['<p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s> <code>c</code> <sub>2</sub> <sup>3</sup></p>'];
        yield 'CKEditor italic and bold' => ['<p><i>i</i> <b>b</b></p>'];
        yield 'lists' => ['<ul><li>a</li></ul><ol start="2"><li>b</li></ol>'];
        yield 'links' => ['<p><a href="https://sulu.io" target="_blank" title="Sulu">a</a> <sulu-link href="abc-123?x=1#top" provider="page" target="_self" title="Home" sulu-validation-state="unpublished">b</sulu-link></p>'];
        yield 'alignment' => ['<p style="text-align: center;">c</p>'];
        yield 'CKEditor table' => ['<figure class="table"><table><thead><tr><th>h</th></tr></thead><tbody><tr><td colspan="2">x</td></tr></tbody></table></figure>'];
        yield 'empty paragraph' => ['<p>&nbsp;</p>'];
    }

    #[DataProvider('defaultMarkup')]
    public function testDefaultConfigKeepsSuluMarkup(string $html): void
    {
        $sanitizers = new TextEditorSanitizers(self::CONFIGS);

        self::assertSame(self::normalize($html), self::normalize($sanitizers->get('default')->sanitize($html)));
        self::assertSame(self::normalize($html), self::normalize($sanitizers->get(null)->sanitize($html)));
    }

    /**
     * @return iterable<string, array{string, string, string}>
     */
    public static function restrictedMarkup(): iterable
    {
        yield 'h1 is not in the default config' => ['default', '<h1>a</h1>', 'a'];
        yield 'script' => ['default', '<p>a</p><script>alert(1)</script>', '<p>a</p>'];
        yield 'javascript link' => ['default', '<p><a href="javascript:alert(1)">a</a></p>', '<p><a>a</a></p>'];
        yield 'foreign style' => ['default', '<p style="color: red">a</p>', '<p>a</p>'];
        yield 'internal-link is not Sulu markup' => ['default', '<p><internal-link href="1" provider="page">a</internal-link></p>', '<p>a</p>'];
        yield 'language needs the lang attribute' => ['default', '<p><span lang="fr">a</span></p>', '<p>a</p>'];
        yield 'mini keeps links, bold and italic' => ['mini', '<strong>a</strong> <i>b</i> <em>c</em> <sulu-link href="1" provider="media">d</sulu-link>', '<strong>a</strong> <i>b</i> <em>c</em> <sulu-link href="1" provider="media">d</sulu-link>'];
        yield 'mini drops blocks' => ['mini', '<h2>a</h2><ul><li>b</li></ul><table><tbody><tr><td>c</td></tr></tbody></table>', 'abc'];
        yield 'mini drops alignment' => ['mini', '<p style="text-align: center;">a</p>', '<p>a</p>'];
        yield 'lang attribute' => ['multilingual', '<p><span lang="fr">a</span> <u>b</u></p>', '<p><span lang="fr">a</span> b</p>'];
        yield 'earlier align key' => ['multilingual', '<p style="text-align: right;">a</p>', '<p style="text-align: right;">a</p>'];
    }

    #[DataProvider('restrictedMarkup')]
    public function testConfigsAllowOnlyTheirTagsAndAttributes(string $config, string $html, string $expected): void
    {
        self::assertSame($expected, (new TextEditorSanitizers(self::CONFIGS))->get($config)->sanitize($html));
    }

    public function testSulu30UsesTheDefaultConfig(): void
    {
        $sanitizers = new TextEditorSanitizers();

        self::assertSame('<h2>a</h2>b', $sanitizers->get(null)->sanitize('<h2>a</h2><h1>b</h1>'));
    }

    public function testFormatsReplaceTheHeadings(): void
    {
        $sanitizer = (new TextEditorSanitizers())->get(null, ['h1', 'h3', 'table']);

        self::assertSame(
            '<h1>1</h1>2<h3>3</h3><figure class="table"><table><tbody><tr><td>x</td></tr></tbody></table></figure>',
            $sanitizer->sanitize('<h1>1</h1><h2>2</h2><h3>3</h3><figure class="table"><table><tbody><tr><td>x</td></tr></tbody></table></figure>'),
        );
    }

    public function testUnknownConfigAllowsAllPrimavistaMarkup(): void
    {
        $sanitizer = (new TextEditorSanitizers(self::CONFIGS))->get('registered-in-javascript');

        self::assertSame(
            '<h1>a</h1><p><span lang="fr">b</span> <i>c</i></p>',
            $sanitizer->sanitize('<h1>a</h1><p><span lang="fr">b</span> <i>c</i></p><script>alert(1)</script>'),
        );
    }

    public function testReusesSanitizers(): void
    {
        $sanitizers = new TextEditorSanitizers(self::CONFIGS);

        self::assertSame($sanitizers->get('mini'), $sanitizers->get('mini'));
        self::assertNotSame($sanitizers->get(null), $sanitizers->get(null, ['h1']));
    }

    /** Parses and serializes again, so equal documents compare equal. */
    private static function normalize(string $html): string
    {
        $document = new \DOMDocument();
        $document->loadHTML('<?xml encoding="UTF-8"><body>'.$html.'</body>', \LIBXML_NOERROR | \LIBXML_HTML_NODEFDTD);
        $body = $document->getElementsByTagName('body')->item(0);
        \assert(null !== $body);

        $result = '';
        foreach ($body->childNodes as $child) {
            $result .= $document->saveHTML($child);
        }

        return $result;
    }
}
