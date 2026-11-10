<?php

declare(strict_types=1);

namespace Primavista\SuluBundle;

use Primavista\SuluBundle\Admin\PrimavistaAdmin;
use Primavista\SuluBundle\Content\TextEditorSanitizingDataMapper;
use Primavista\SuluBundle\HtmlSanitizer\TextEditorSanitizers;
use Primavista\SuluBundle\HtmlSanitizer\TextEditorSanitizersInterface;
use Sulu\Bundle\AdminBundle\Admin\Admin;
use Sulu\Content\Application\ContentDataMapper\DataMapper\DataMapperInterface;
use Symfony\Component\Config\Definition\Configurator\DefinitionConfigurator;
use Symfony\Component\DependencyInjection\Compiler\CompilerPassInterface;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\HttpKernel\Bundle\AbstractBundle;

use function Symfony\Component\DependencyInjection\Loader\Configurator\service;

/**
 * Registers the translations of the editor's toolbar and link forms with
 * Symfony's translator, from which Sulu Admin loads its "admin" domain.
 * The JavaScript side lives in assets/admin and is imported by the
 * project's admin build, see README.md.
 *
 * With Sulu's content packages installed it also sanitizes every
 * `text_editor` value on save, see `TextEditorSanitizingDataMapper`.
 */
final class PrimavistaSuluBundle extends AbstractBundle
{
    /** Where Sulu 3.1 puts the resolved text editor configs (sulu/sulu#9091). */
    public const TEXT_EDITOR_CONFIGS_PARAMETER = 'sulu_admin.text_editor_configs';

    public function getPath(): string
    {
        return \dirname(__DIR__);
    }

    public function configure(DefinitionConfigurator $definition): void
    {
        $definition->rootNode()
            ->children()
                ->booleanNode('sanitize')
                    ->defaultTrue()
                    ->info('Sanitize text_editor values on save with the property\'s text editor config.')
                ->end()
                ->arrayNode('elements')
                    ->info('Inline elements the editor offers as a toolbar button, for example mark or abbr. The sanitizer allows them with the listed attributes and the admin builds the plugin, no JavaScript needed.')
                    ->arrayPrototype()
                        ->validate()
                            ->always(static function (array $element): array {
                                /** @var array{tag: string, class: string|null, attributes: list<string>, label: string|null} $element */
                                return self::validateElement($element);
                            })
                        ->end()
                        ->children()
                            ->scalarNode('tag')
                                ->isRequired()
                                ->cannotBeEmpty()
                                ->info('The element, for example mark. Common tags such as span or a need a class.')
                            ->end()
                            ->scalarNode('class')
                                ->defaultNull()
                                ->info('Class written on every element and required when content loads, so other elements of the tag stay untouched.')
                            ->end()
                            ->arrayNode('attributes')
                                ->info('Attributes the element may carry, for example title. They are kept, the toolbar button does not set them yet.')
                                ->scalarPrototype()->end()
                            ->end()
                            ->scalarNode('label')
                                ->defaultNull()
                                ->info('Toolbar label. Translate it with the key sulu_admin.primavista.toolbar.<tag> or <tag>-<class>. Defaults to the tag.')
                            ->end()
                        ->end()
                    ->end()
                ->end()
                ->arrayNode('tags')
                    ->info('Tags every text editor config allows on top, for plugins the admin JavaScript adds through primavistaPluginRegistry: blockquote, pre, hr.')
                    ->scalarPrototype()->end()
                ->end()
            ->end();
    }

    /**
     * @param array{sanitize: bool, tags: list<string>, elements: list<array{tag: string, class: string|null, attributes: list<string>, label: string|null}>} $config
     */
    public function loadExtension(array $config, ContainerConfigurator $container, ContainerBuilder $builder): void
    {
        $container->services()
            ->set('primavista_sulu.text_editor_sanitizers', TextEditorSanitizers::class)
                ->args([[], $config['tags'], $config['elements']])
            ->alias(TextEditorSanitizers::class, 'primavista_sulu.text_editor_sanitizers')
            ->alias(TextEditorSanitizersInterface::class, 'primavista_sulu.text_editor_sanitizers');

        if ($config['elements'] !== [] && class_exists(Admin::class)) {
            $container->services()
                ->set('primavista_sulu.admin', PrimavistaAdmin::class)
                    ->args([$config['elements']])
                    ->tag('sulu.admin');
        }

        if (!$config['sanitize'] || !interface_exists(DataMapperInterface::class)) {
            return;
        }

        $container->services()
            ->set('primavista_sulu.text_editor_sanitizing_data_mapper', TextEditorSanitizingDataMapper::class)
                ->args([
                    service('sulu_admin.metadata_provider_registry'),
                    service('primavista_sulu.text_editor_sanitizers'),
                ])
                ->tag('sulu_content.data_mapper', ['priority' => TextEditorSanitizingDataMapper::PRIORITY]);
    }

    /** Elements that never belong in editor content. The sanitizer would not save a project from allowing them. */
    private const FORBIDDEN_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'button', 'textarea', 'select', 'svg', 'math', 'template'];

    /** Elements that stand for other content, a class tells the project's elements apart. */
    private const GENERIC_TAGS = ['span', 'div', 'p', 'a', 'li', 'ul', 'ol', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'blockquote', 'pre', 'code', 'hr', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'font'];

    /**
     * @param array{tag: string, class: string|null, attributes: list<string>, label: string|null} $element
     *
     * @return array{tag: string, class: string|null, attributes: list<string>, label: string|null}
     */
    private static function validateElement(array $element): array
    {
        $tag = $element['tag'];
        if (1 !== preg_match('/^[a-z][a-z0-9-]*$/', $tag)) {
            throw new \InvalidArgumentException(\sprintf('primavista_sulu.elements: "%s" is not a valid element name.', $tag));
        }
        if (\in_array($tag, self::FORBIDDEN_TAGS, true)) {
            throw new \InvalidArgumentException(\sprintf('primavista_sulu.elements: <%s> cannot be allowed in editor content.', $tag));
        }
        if (null === $element['class'] && \in_array($tag, self::GENERIC_TAGS, true)) {
            throw new \InvalidArgumentException(\sprintf('primavista_sulu.elements: <%s> is used by other content too, set a class so only your elements match.', $tag));
        }
        if (null !== $element['class'] && 1 !== preg_match('/^[A-Za-z_][\w-]*$/', $element['class'])) {
            throw new \InvalidArgumentException(\sprintf('primavista_sulu.elements: "%s" is not a valid class name.', $element['class']));
        }
        foreach ($element['attributes'] as $attribute) {
            if (1 !== preg_match('/^[a-z][a-z0-9-]*$/', $attribute) || str_starts_with($attribute, 'on') || \in_array($attribute, ['style', 'class', 'srcdoc'], true)) {
                throw new \InvalidArgumentException(\sprintf('primavista_sulu.elements: attribute "%s" of <%s> is not allowed. Event handlers, style and class are never kept.', $attribute, $tag));
            }
        }

        return $element;
    }

    public function build(ContainerBuilder $container): void
    {
        // Sulu's admin extension may load after this one, so the configs
        // are read once every extension has set its parameters.
        $container->addCompilerPass(new class implements CompilerPassInterface {
            public function process(ContainerBuilder $container): void
            {
                if ($container->hasParameter(PrimavistaSuluBundle::TEXT_EDITOR_CONFIGS_PARAMETER)) {
                    $container->getDefinition('primavista_sulu.text_editor_sanitizers')
                        ->setArgument(0, '%'.PrimavistaSuluBundle::TEXT_EDITOR_CONFIGS_PARAMETER.'%');
                }
            }
        });
    }
}
