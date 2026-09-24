# Primavista: Research (as of 2026-09-24)

## Part 1: Editor landscape

### Name availability

- npm: `@primavista/core` is free.
- Packagist: `primavista/*` is free.
- GitHub: the account `primavista` is taken (inactive user account, no repos). Alternatives: `primavista-oss`, `getprimavista`.
- Unrelated products with the same name: Primavista (financial reporting, Proseduuri Oy, Finland) and Primavista SAS (photo services, France, two registered trademarks). A trademark check before launch makes sense.

### Comparison

| Name | Base | License | Bindings | Strength | Weakness |
|---|---|---|---|---|---|
| ProseMirror | standalone | MIT | none official | robust immutable document model, strict schema, de-facto standard | very low-level, no UI, steep learning curve |
| Tiptap v3 | ProseMirror | MIT core, Pro extensions and cloud commercial | React, Vue, Svelte, headless | large ecosystem, good DX | free plan gone since June 2025, collab and comments commercial only |
| Lexical (Meta) | own | MIT | `@lexical/react`, core is agnostic | core about 22 KB, production-proven, command-based | smaller plugin ecosystem, gaps in docs |
| Slate | own | MIT | React hard-wired | once flexible | repo archived on 2026-02-04 |
| Plate | Slate | MIT core, Plate Plus commercial | React only | 50+ plugins | inherits the Slate risk |
| CKEditor 5 | own | GPL 2+ or commercial with license key | React, Vue, Angular | feature-rich, high WYSIWYG fidelity | GPL shows a badge, expensive, bundle about 500 KB |
| Quill 2 | own (Parchment) | BSD | vanilla, community React | about 45 KB | collab and blocks limited |
| Editor.js | own, block-based | Apache 2.0 | wrapper per framework | clean JSON output | 2018 architecture, every feature built by hand |
| Trix | own, contenteditable as I/O | MIT | custom element | stable since 2014 | hardly extensible |
| Milkdown | ProseMirror + Remark | MIT | React, Vue, Solid, vanilla | Markdown-native | niche |
| BlockNote | ProseMirror + Tiptap | MPL-2.0, XL packages GPL-3.0 | React only | Notion-like blocks | React only, check copyleft |
| Remirror | ProseMirror | MIT | React only | many extensions | maintenance mode, maintainers point to ProseKit |
| Novel | Tiptap | Apache 2.0 | React, Next.js | AI autocomplete showcase | more demo than product |

### Patterns

Almost every modern "own" editor (Tiptap, BlockNote, Milkdown, Remirror) builds on ProseMirror. Its schema and transaction model guarantee correctness for nested documents, and Yjs collaboration already exists. Lexical is the only serious alternative with comparable maturity. Building from scratch (the Trix way) only pays off with a deliberately narrow scope.

Bindings: the established solutions separate a framework-free core (state, schema, commands) from thin adapters per framework (`@tiptap/core` + `@tiptap/react`, `lexical` + `@lexical/react`). Web Components are the alternative for true neutrality, but they pay with Shadow DOM styling friction. That collides with the USP "the editor looks like the website".

Market gap named by users: missing style fidelity to the production frontend, license costs and cloud lock-in for collab and comments, bundle size (200 to 500 KB), React-only lock-in of the block editors, block editor vs. rich text as either/or.

### Open decisions

1. Core base: ProseMirror vs. Lexical vs. own model.
2. License and monetization: fully MIT vs. open core vs. dual license.
3. Bindings architecture: headless core + adapters vs. Web Component as the core.
4. Rich text vs. block editor.
5. Style fidelity to the frontend: how is the production CSS guaranteed inside the editor?
6. Collaboration from day one or in v2.
7. Naming: GitHub org and trademark check.

### Sources, part 1

- https://tiptap.dev/pro-license
- https://prosemirror.net/docs/guide/
- https://lexical.dev/docs/intro
- https://ckeditor.com/legal/ckeditor-licensing-options/
- https://www.blocknotejs.org/pricing
- https://github.com/ianstormtaylor/slate
- https://github.com/udecode/plate
- https://quilljs.com/docs/upgrading-to-2-0
- https://editorjs.io/
- https://github.com/basecamp/trix
- https://github.com/Milkdown/milkdown
- https://github.com/remirror/remirror
- https://github.com/steven-tey/novel
- https://eddyter.com/blogs/rich-text-editor-bundle-size-comparison-2026 (SEO blog, verify numbers before deciding)
- https://registry.npmjs.org/@primavista%2Fcore
- https://packagist.org/search.json?q=primavista
- https://api.github.com/users/primavista

## Part 2: Symfony, Sulu and ecosystem fit

### Building a Symfony UX package

The official guide is "Create a UX bundle" (https://symfony.com/doc/current/frontend/create_ux_bundle.html). Assets live under `assets/` with their own `package.json`, which carries a `symfony` block (`controllers` with `fetch: eager|lazy`, `autoimport`) and an `importmap` block that must match `peerDependencies`. The Composer package needs the keyword `symfony-ux` so Flex recognizes it. AssetMapper support is prepended via `prependExtensionConfig('framework', ['asset_mapper' => ...])`. Controller names follow `vendor/package/name` in Twig. `symfony/stimulus-bundle` is at v3.5.1 (PHP >= 8.4, Symfony ^7.4|^8.0). Live Components: an editor that writes a field programmatically must dispatch a `change` event by hand. `symfony/ux-autocomplete` is the reference for form integration (FormTypeExtension plus attributes). `symfony/ux-typed` was deprecated, so Symfony does retire small UX packages.

### Existing WYSIWYG integrations

- FOSCKEditorBundle only wraps CKEditor 4 (EOL since June 2023), a port to CKEditor 5 is considered too costly (https://github.com/FriendsOfSymfony/FOSCKEditorBundle/issues/254).
- EasyAdmin `TextEditorField` still uses Trix.
- Community: `ux-quill` (https://github.com/Ehyiah/ux-quill) and an Editor.js bundle. Pattern: own FormType, HTML string storage, AssetMapper and Encore in parallel, EasyAdmin hookup.
- No official Symfony UX WYSIWYG package exists. `symfony/ux` issue #1 asked for a light TinyMCE alternative (https://github.com/symfony/ux/issues/1).

### Storage: HTML vs. JSON

Sulu and most CKEditor integrations store an HTML string. Ibexa uses DocBook XML with XSLT. Statamic Bard stores ProseMirror JSON, which allows inline sets inside prose and makes content queryable (https://statamic.dev/fieldtypes/bard). Payload's Lexical editor separates structured blocks from prose. ProseMirror JSON is roughly 150 to 250 percent larger than the equivalent HTML but safer against XSS and easier to transform. Community advice: JSON as source of truth, cached HTML for fast rendering (https://github.com/ueberdosis/tiptap/discussions/148). Twig rendering from JSON needs a PHP renderer such as `tiptap-php`, otherwise server-side rendering without Node is hard.

### True WYSIWYG: isolation

Gutenberg renders the editor canvas fully inside an iframe so admin styles cannot leak into the content. Since July 2026 this is the only mode (https://make.wordpress.org/core/2025/11/12/preparing-the-post-editor-for-full-iframe-integration/). Plugins must listen on `element.ownerDocument` instead of `document`. CKEditor 5 does theming through CSS variables and the Decoupled Editor, not through isolation (https://ckeditor.com/docs/ckeditor5/latest/framework/deep-dive/ui/theme-customization.html). Shadow DOM did not show up as a production-proven approach for editors in any source.

### Community expectations

License is the pain point. CKEditor 5 requires an explicit `licenseKey` since v44, and since v47.7.0 LTS (2026-04-16) the LTS builds block the GPL key even for self-hosting (https://github.com/sulu/sulu/issues/8811). Sulu only uses CKEditor 5 under an individual "free for open source" license from CKSource (https://ckeditor.com/case-studies/sulu/). Zero-build via AssetMapper is a hard requirement. Sanitizing is first-class in Symfony via `sanitize_html` on FormTypes and `symfony/html-sanitizer` (https://symfony.com/doc/current/html_sanitizer.html).

### Sulu as primary consumer

Sulu Admin is a React SPA. Custom field types register via `fieldRegistry.add('name', Component)` from `sulu-admin-bundle/containers` (https://docs.sulu.io/en/2.6/book/extend-admin.html). The `text_editor` type wraps a CKEditor5 React component with the props `value`, `onChange`, `onBlur`, content is an HTML string. Extension happens through `PluginRegistry.add(PluginClass)` and `ConfigRegistry` (shallow-merged config, e.g. toolbar buttons) (https://github.com/sulu/sulu/blob/2.0.0/src/Sulu/Bundle/AdminBundle/Resources/js/containers/CKEditor5/README.md). Sulu pinned CKEditor to `^47.0.0` and a minor release still broke GPL usage.

For `@primavista/react` to be a drop-in field type in Sulu Admin it needs: a React component with the exact `value`/`onChange`/`onBlur` contract, HTML string as input and output (or JSON with an HTML fallback), registration via `fieldRegistry.add`, and plugin/config registries in the same spirit so Sulu projects can add buttons. The Symfony UX path is different in kind: Stimulus controller, `stimulus_controller()` in Twig, classic FormType, Flex recipe. Primavista therefore needs two integration layers on one shared core.

### Open questions, part 2

1. Storage format: HTML string (compatible, lossy) or JSON with a PHP renderer (powerful, more work).
2. Core license: MIT/Apache or GPL/dual with the CKEditor 5 risk profile.
3. Style isolation: CSS variables like CKEditor 5 or iframe like Gutenberg.
4. Form integration: own FormType or extension pattern like `ux-autocomplete`.
5. Sulu compatibility: build the React field type in parallel or establish the UX path first.
6. Sanitizing: browser, server via `symfony/html-sanitizer`, or both.
7. Media upload and mentions hooks: own event system or existing conventions (VichUploader, Sulu Media).
