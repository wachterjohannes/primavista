<?php

declare(strict_types=1);

namespace Primavista\UxBundle\Form;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\TextareaType;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Form\FormView;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\UX\StimulusBundle\Helper\StimulusHelper;

/**
 * A textarea that becomes a Primavista editor in the browser. The submitted
 * value is HTML. With FrameworkBundle's html_sanitizer enabled, the value is
 * sanitized on submit by the `primavista` sanitizer, which keeps exactly the
 * markup the editor emits. Pass `sanitize_html: false` to opt out or
 * `sanitizer` to use another one.
 */
final class PrimavistaType extends AbstractType
{
    public const CONTROLLER = '@primavista/ux-bundle/editor';

    /** Name of the sanitizer the bundle registers, see PrimavistaSanitizerConfig. */
    public const SANITIZER = 'primavista';

    public function __construct(
        private readonly StimulusHelper $stimulus,
    ) {
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'placeholder' => null,
            'theme' => null,
        ]);
        $resolver->setAllowedTypes('placeholder', ['null', 'string']);
        $resolver->setAllowedTypes('theme', ['null', 'string']);

        // The options come from FrameworkBundle's form extension and only
        // exist while framework.html_sanitizer is enabled.
        if ($resolver->isDefined('sanitize_html')) {
            $resolver->setDefaults([
                'sanitize_html' => true,
                'sanitizer' => self::SANITIZER,
            ]);
        }
    }

    public function buildView(FormView $view, FormInterface $form, array $options): void
    {
        $values = [];
        if (null !== $options['placeholder']) {
            $values['placeholder'] = $options['placeholder'];
        }
        if (null !== $options['theme']) {
            $values['theme'] = $options['theme'];
        }

        $attributes = $this->stimulus->createStimulusAttributes();
        $attributes->addController(self::CONTROLLER, $values);
        $stimulusAttr = $attributes->toArray();

        $attr = $view->vars['attr'];
        if (isset($attr['data-controller']) && \is_string($attr['data-controller']) && '' !== $attr['data-controller']) {
            $stimulusAttr['data-controller'] = $attr['data-controller'].' '.$stimulusAttr['data-controller'];
        }

        $view->vars['attr'] = array_merge($attr, $stimulusAttr);
    }

    public function getParent(): string
    {
        return TextareaType::class;
    }

    public function getBlockPrefix(): string
    {
        return 'primavista';
    }
}
