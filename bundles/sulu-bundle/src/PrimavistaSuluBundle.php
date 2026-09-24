<?php

declare(strict_types=1);

namespace Primavista\SuluBundle;

use Symfony\Component\HttpKernel\Bundle\AbstractBundle;

/**
 * Registers the translations of the editor's toolbar and link forms with
 * Symfony's translator, from which Sulu Admin loads its "admin" domain.
 * The JavaScript side lives in assets/admin and is imported by the
 * project's admin build, see README.md.
 */
final class PrimavistaSuluBundle extends AbstractBundle
{
    public function getPath(): string
    {
        return \dirname(__DIR__);
    }
}
