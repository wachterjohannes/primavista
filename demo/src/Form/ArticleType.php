<?php

declare(strict_types=1);

namespace App\Form;

use App\Model\Article;
use Primavista\UxBundle\Form\PrimavistaType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

final class ArticleType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder->add('body', PrimavistaType::class, [
            'label' => 'Body',
            'placeholder' => 'Start writing…',
        ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults(['data_class' => Article::class]);
    }
}
