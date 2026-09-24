<?php

declare(strict_types=1);

namespace App\Controller;

use App\Form\ArticleType;
use App\Model\Article;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final class DemoController extends AbstractController
{
    private const INITIAL_HTML = '<h2>Primavista</h2><p>Same core, <strong>two bindings</strong>. Edit me.</p><ul><li>Symfony UX above</li><li>React below</li></ul><p>Internal link: <sulu-link href="uuid-about" provider="page" target="_self" title="About us">About us</sulu-link></p>';

    #[Route('/', name: 'demo', methods: ['GET', 'POST'])]
    public function index(Request $request): Response
    {
        $article = new Article();
        $article->body = self::INITIAL_HTML;

        $form = $this->createForm(ArticleType::class, $article);
        $form->handleRequest($request);

        $submitted = null;
        if ($form->isSubmitted() && $form->isValid()) {
            $submitted = $article->body;
        }

        return $this->render('demo/index.html.twig', [
            'form' => $form,
            'submitted' => $submitted,
            'react_initial_html' => self::INITIAL_HTML,
        ]);
    }
}
