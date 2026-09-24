<?php

declare(strict_types=1);

namespace Primavista\SuluBundle\Tests;

use PHPUnit\Framework\TestCase;
use Primavista\SuluBundle\PrimavistaSuluBundle;

final class BundleTest extends TestCase
{
    public function testPathPointsAtTheBundleRoot(): void
    {
        $bundle = new PrimavistaSuluBundle();

        self::assertSame(\dirname(__DIR__), $bundle->getPath());
        self::assertFileExists($bundle->getPath().'/translations/admin.en.json');
        self::assertFileExists($bundle->getPath().'/assets/admin/index.js');
    }

    public function testTranslationsCoverTheSameKeysInEveryLanguage(): void
    {
        $english = $this->translations('en');
        $german = $this->translations('de');

        self::assertSame(\array_keys($english), \array_keys($german));
        self::assertContains('sulu_admin.primavista.toolbar.bold', \array_keys($english));
        self::assertContains('sulu_admin.text_editor', \array_keys($english));
        foreach ($english as $key => $value) {
            self::assertStringStartsWith('sulu_admin.', $key);
            self::assertNotSame('', \trim($value), $key);
        }
    }

    /**
     * @return array<string, string>
     */
    private function translations(string $locale): array
    {
        $content = \file_get_contents(\dirname(__DIR__).'/translations/admin.'.$locale.'.json');
        self::assertNotFalse($content);

        /** @var array<string, string> $decoded */
        $decoded = \json_decode($content, true, 512, \JSON_THROW_ON_ERROR);

        return $decoded;
    }
}
