<?php

declare(strict_types=1);

namespace App\Model;

use Symfony\Component\Validator\Constraints as Assert;

final class Article
{
    #[Assert\NotBlank(message: 'Please write something.')]
    public ?string $body = null;
}
