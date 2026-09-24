<?php

declare(strict_types=1);

namespace Primavista\UxBundle\Tests\HtmlSanitizer;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Primavista\UxBundle\HtmlSanitizer\PrimavistaSanitizerConfig;
use Symfony\Component\HtmlSanitizer\HtmlSanitizer;

final class PrimavistaSanitizerConfigTest extends TestCase
{
    /**
     * Every construct the core and its plugins export, see
     * packages/core/test/html.test.ts.
     *
     * @return iterable<string, array{string}>
     */
    public static function emittedMarkup(): iterable
    {
        yield 'paragraphs' => ['<p>One</p><p>Two<br>lines</p>'];
        yield 'headings' => ['<h1>1</h1><h2>2</h2><h3>3</h3><h4>4</h4><h5>5</h5><h6>6</h6>'];
        yield 'text formats' => ['<p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s> <code>c</code> <sub>2</sub> <sup>3</sup></p>'];
        yield 'nested formats' => ['<p><strong><em><u>all</u></em></strong></p>'];
        yield 'lists' => ['<ul><li>a</li><li>b<ul><li>nested</li></ul></li></ul><ol start="3"><li>c</li></ol>'];
        yield 'alignment' => ['<p style="text-align: center;">c</p><h2 style="text-align: right;">r</h2><ul><li style="text-align: justify;">j</li></ul>'];
        yield 'right to left' => ['<p dir="rtl">שלום</p>'];
        yield 'external link' => ['<p><a href="https://sulu.io" target="_blank" title="Sulu CMS" rel="noopener noreferrer">Sulu</a></p>'];
        yield 'relative, mail and phone links' => ['<p><a href="/about#team">a</a> <a href="mailto:hello@example.com">m</a> <a href="tel:+43123">t</a></p>'];
        yield 'internal link' => ['<p><internal-link href="abc-123?x=1#top" provider="page" target="_self" title="Home" validation-state="unpublished">Home</internal-link></p>'];
        yield 'language' => ['<p>Say <span lang="fr">bonjour</span> and <span lang="de-AT">Servus</span></p>'];
        yield 'table' => ['<table><tbody><tr><td colspan="2">wide</td></tr><tr><td rowspan="2" style="text-align: right;">tall</td><td><p>one</p><p>two</p></td></tr><tr><td>x</td></tr></tbody></table>'];
        yield 'table with head section' => ['<table><thead><tr><th>h</th><th>i</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'];
        yield 'CKEditor table wrapper' => ['<figure class="table"><table><tbody><tr><td>x</td></tr></tbody></table></figure>'];
        yield 'empty paragraph as nbsp' => ['<p>&nbsp;</p>'];
    }

    #[DataProvider('emittedMarkup')]
    public function testKeepsEmittedMarkup(string $html): void
    {
        self::assertSame(self::normalize($html), self::normalize($this->sanitize($html)));
    }

    /** The sanitizer writes its own serialization of the same document. */
    public function testReserializesEquivalentMarkup(): void
    {
        self::assertSame(
            "<p>a<br />b</p><p>\u{a0}</p><p><internal-link href=\"1?x&#61;1\" provider=\"page\">c</internal-link></p>",
            $this->sanitize('<p>a<br>b</p><p>&nbsp;</p><p><internal-link href="1?x=1" provider="page">c</internal-link></p>'),
        );
    }

    /**
     * @return iterable<string, array{string, string}>
     */
    public static function hostileMarkup(): iterable
    {
        yield 'script' => ['<p>a</p><script>alert(1)</script>', '<p>a</p>'];
        yield 'event handler' => ['<p onclick="alert(1)">a</p><internal-link href="1" provider="page" onmouseover="alert(1)">b</internal-link>', '<p>a</p><internal-link href="1" provider="page">b</internal-link>'];
        yield 'javascript link' => ['<p><a href="javascript:alert(1)">a</a></p>', '<p><a>a</a></p>'];
        yield 'obfuscated javascript link' => ['<p><a href=" JaVaScRiPt:alert(1)">a</a></p>', '<p><a>a</a></p>'];
        yield 'data link' => ['<p><a href="data:text/html;base64,PHNjcmlwdD4=">a</a></p>', '<p><a>a</a></p>'];
        yield 'internal link with a scheme' => ['<p><internal-link href="javascript:alert(1)" provider="page">a</internal-link></p>', '<p><internal-link provider="page">a</internal-link></p>'];
        yield 'foreign style' => ['<p style="color: red">a</p>', '<p>a</p>'];
        yield 'style smuggled behind alignment' => ['<p style="text-align: center; background: url(javascript:alert(1))">a</p>', '<p>a</p>'];
        yield 'unknown alignment' => ['<p style="text-align: start">a</p>', '<p>a</p>'];
        yield 'style outside blocks' => ['<p><strong style="text-align: center">a</strong></p>', '<p><strong>a</strong></p>'];
        yield 'alignment normalized' => ['<p style="TEXT-ALIGN:Center">a</p>', '<p style="text-align: center;">a</p>'];
        yield 'classes and ids' => ['<p class="x" id="y">a</p>', '<p>a</p>'];
        yield 'figure class forced' => ['<figure class="evil"><table><tbody><tr><td>x</td></tr></tbody></table></figure>', '<figure class="table"><table><tbody><tr><td>x</td></tr></tbody></table></figure>'];
        yield 'unknown tags' => ['<p>a</p><iframe src="https://evil.example"></iframe><div>b</div><img src="x" onerror="alert(1)"><marquee>c</marquee>', '<p>a</p>'];
        yield 'svg' => ['<p>a<svg><script>alert(1)</script></svg></p>', '<p>a</p>'];
        yield 'foreign custom element' => ['<p><sulu-link href="1" provider="page">a</sulu-link></p>', '<p></p>'];
        yield 'comments' => ['<p>a<!-- <script>alert(1)</script> --></p>', '<p>a</p>'];
    }

    #[DataProvider('hostileMarkup')]
    public function testStripsEverythingElse(string $html, string $expected): void
    {
        self::assertSame($expected, $this->sanitize($html));
    }

    public function testRenamesInternalLinks(): void
    {
        $sanitizer = new HtmlSanitizer(PrimavistaSanitizerConfig::create('sulu-link', 'sulu-validation-state'));
        $html = '<p><sulu-link href="42#sec" provider="media" target="_self" title="Brochure" sulu-validation-state="removed">b</sulu-link></p>';

        self::assertSame($html, $sanitizer->sanitize($html));
        self::assertSame('<p></p>', $sanitizer->sanitize('<p><internal-link href="1" provider="page">a</internal-link></p>'));
    }

    public function testDoesNotTruncateLongContent(): void
    {
        $html = str_repeat('<p>'.str_repeat('x', 1000).'</p>', 100);

        self::assertSame($html, $this->sanitize($html));
    }

    private function sanitize(string $html): string
    {
        return (new HtmlSanitizer(PrimavistaSanitizerConfig::create()))->sanitize($html);
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
