<?php

/*
 * Router for PHP's built-in web server, used by the Playwright suite:
 *   php -S 127.0.0.1:8765 -t public public/router.php
 * Static files are served directly, everything else goes to Symfony.
 */

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if ('/' !== $path && is_file(__DIR__.$path)) {
    return false;
}

$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['SCRIPT_FILENAME'] = __DIR__.'/index.php';

require __DIR__.'/index.php';
