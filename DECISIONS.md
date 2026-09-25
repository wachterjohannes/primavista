# Decisions

Decisions from the kickoff interview on 2026-09-24. See `RESEARCH.md` for the background and `docs/interviews/2026-09-24-kickoff.md` for the conversation.

## Decided

1. **Trigger and goal.** The main trigger is the CKEditor 5 license, which gets stricter with every release and keeps breaking Sulu. Bundle size is the second pain. The goal is a prototype that shows whether a replacement is feasible.
2. **Core: Lexical.** Smaller than ProseMirror (about 20 KB core vs. about 100 KB), MIT, official table package. Collaboration is not needed, so ProseMirror's main advantage does not count. The core stays encapsulated so the base can be swapped if Lexical falls short.
3. **Storage: HTML in, HTML out.** Sulu stores HTML strings and that stays. Lexical's JSON is an internal detail and is never persisted.
4. **No frontend style fidelity.** The editor does not need to look like the website. The Sulu preview covers that. Theming stays on the CKEditor level: CSS variables, nothing more.
5. **Prototype scope.** Bold, italic, headings, lists, tables, and a plugin system through which Sulu hooks in its own link and media plugins. The plugin system is the key deliverable, not the feature list.
6. **License: MIT.** Fully open, no license key, no open core.
7. **Order.** Symfony UX bundle first, the React binding in parallel. Demo target: one Symfony app that renders the Stimulus variant and the React component (as used in Sulu Admin) on the same page, one below the other.

## Implementation decisions (2026-09-24, first prototype)

8. **Repo layout.** pnpm monorepo: `packages/core`, `packages/react`, `bundles/ux-bundle` (Composer, Symfony UX conventions), `demo` (Symfony app), `e2e` (Playwright). `packages/sulu` came later (see 30), the `fieldRegistry.add()` call still belongs into Sulu.
9. **Core owns the UI.** The toolbar is vanilla DOM inside the core. React is a mount wrapper with `value`, `onChange`, `onBlur`. No `@lexical/react`, so there is exactly one UI layer for both bindings.
10. **Plugin interface.** `{ name, nodes?, theme?, register?(context), toolbar? }`. Bold, lists, headings, links and tables are plugins themselves. Toolbar state callbacks run inside `editor.read()`.
11. **Self-contained Stimulus controller.** `bundles/ux-bundle/assets/dist/controller.js` bundles core and Lexical, only Stimulus stays external, and the file is committed. Zero build steps with AssetMapper and no dependency on published npm packages.
12. **Lexical re-exports.** The core re-exports `lexical`, `@lexical/link` and `@lexical/utils` as namespaces and the controller passes the module in `primavista:pre-connect` as `detail.core`. Custom plugins in the UX path need the same Lexical instance. Cost: 335 KB to 383 KB minified (128 KB gzip). Re-exporting every Lexical package (419 KB) was rejected, as was no re-export at all, which would make plugins impossible without a bundler.
13. **Clean HTML export.** Own exporters for text nodes and tables: no wrapper spans, no inline styles, no editor classes, no `dir="ltr"`, no `value` on `li`. A table cell with one paragraph exports as bare cell content. Empty document exports as `""`. Links get no implicit `rel="noreferrer"`.
14. **Merged cells stay merged.** `registerTableCellUnmergeTransform` is not registered, otherwise `colspan` and `rowspan` are lost on import.
15. **Hidden textarea loses `required`.** Browsers refuse to validate hidden controls. Server-side constraints keep working.

## Sulu parity (2026-09-24, second iteration)

16. **Internal links as a `LinkNode` subclass.** `InternalLinkNode` extends Lexical's `LinkNode` and adds `provider` and `validationState`. That reuses `$toggleLink` for wrapping, splitting and unwrapping, and only the export differs: `<internal-link href provider target title validation-state>` by default, `<sulu-link … sulu-validation-state>` through `@primavista/sulu`. Tag and attribute names are static fields, so any CMS can rename them.
17. **Dialogs belong to the host.** Both link plugins expose `openDialog(state)` with `apply`, `remove` and `cancel`. Sulu renders its own `LinkTypeOverlay` and `ExternalLinkTypeOverlay`, the Symfony UX demo uses the built-in toolbar form. The editor never ships a resource picker.
18. **Balloon instead of toolbar editing.** Like Sulu's `LinkBalloonView`: a floating panel under the link with preview (external only), edit and unlink. The toolbar link buttons are disabled while the selection touches a link, so create and edit never collide.
19. **Alignment as inline style.** Exported as `style="text-align: …"`, the format Sulu content already contains from CKEditor.
20. **Toolbar menus.** A third toolbar item type for the provider dropdown. Buttons and selects stay as they were.
21. **`enter_mode: br` as helper functions.** `stripParagraphs` and `wrapParagraphs` copy Sulu's algorithm verbatim so stored content stays byte-compatible. They live in `@primavista/sulu` and the adapter applies them, the core never sees them.
22. **The Sulu adapter lives in `docs/sulu`.** A reference file written against Sulu 3.0's `TextEditorProps`, `linkTypeRegistry` and overlays. It goes into Sulu's repository, not into an npm package, because it imports Sulu internals.
23. **Translation through a hook, not through label options.** `translate(key, fallback)` on the editor options with stable keys (`toolbar.bold`, `link.url`). One hook covers every plugin and the adapter maps it to Sulu's `translate()`. Per-plugin label objects were rejected because every host would repeat them.
24. **Custom elements are marked inline on import.** Lexical's HTML importer treats unknown tags as blocks and drops the whitespace before them. `$loadHtml` sets `display: inline` on `<sulu-link>` before parsing.

## Repository and Sulu verification (2026-09-24, third iteration)

25. **Themes are CSS variables scoped by a class.** `theme: 'sulu'` adds `pv-theme-sulu`, `@primavista/sulu/sulu.css` overrides the `--pv-*` variables. No JavaScript theme objects beyond Lexical's class map, which moved to `themeClasses`.
26. **CKEditor markup is opt-in.** `html: { tableWrapper, tableHeadSection, emptyParagraph }` reproduces `figure.table`, `thead` and `&nbsp;`. `suluPreset()` from `@primavista/sulu` bundles them with the theme. The default output stays plain.
27. **Headings outside `levels` are demoted.** A node transform turns them into paragraphs, matching CKEditor's schema behaviour. Off with `demoteUnlisted: false`.
28. **CommonJS next to ESM.** Sulu's Jest cannot load ESM without a transform, so both packages ship `index.cjs`. React 17 is supported because Sulu Admin runs on it.
29. **The adapter is verified inside Sulu.** The reference adapter and its test were run in a local Sulu 3.0 checkout: Jest, `flow focus-check`, ESLint. Sulu needs three config changes for that (Jest transform list, Flow `[untyped]`, package dependencies), documented in `docs/sulu-integration.md`.

## Package split (2026-09-24, fourth iteration)

30. **Sulu specifics live in `@primavista/sulu`.** The core knows nothing about Sulu: `internalLinks` writes `<internal-link>` with a `validation-state` attribute, the themes folder holds only `dark.css`, there is no preset and no `enter_mode` code. `@primavista/sulu` configures the same plugin as `suluLinks()` for `<sulu-link>`, adds `suluPlugins()` (Sulu's toolbar in Sulu's order), `suluPreset()`, `sulu.css`, the `enter_mode` helpers, the empty value mapping and `suluTranslationKey()`. The adapter inside Sulu imports from `@primavista/react` and `@primavista/sulu`. Rejected: keeping Sulu defaults in the core (every host would inherit Sulu's element names), and moving `internalLinks` entirely into the Sulu package (Symfony UX apps need CMS links too, the Symfony demo uses the generic form).

## Sulu bundle and language (2026-09-24, fifth iteration)

31. **A bundle instead of a pull request against Sulu.** `bundles/sulu-bundle` (`primavista/sulu-bundle`) registers the adapter in `textEditorRegistry` and replaces the `text_editor` entry of `fieldRegistry` with a copy of Sulu's field that names the `primavista` adapter. Sulu's field hard-codes `ckeditor5` and the registries refuse duplicate keys, so this one internal write is unavoidable until Sulu offers an adapter setting. The PHP side only ships translations. Both bundles live under `bundles/`.
32. **The plugin list follows Sulu's text editor config.** `suluPlugins({ config })` takes `{ tags, attributes, enterMode }` as sulu/sulu#9091 defines it for 3.1 and switches plugins on per tag and attribute. On Sulu 3.0 the adapter derives the config from the deprecated `formats` and `enter_mode` params with the same rules as Sulu's `resolveTextEditorConfig`. One code path for both versions.
33. **Language as an inline node.** `language()` wraps text in `LanguageNode`, exported as `<span lang="…">`, the markup CKEditor's TextPartLanguage writes (minus `dir`). Sulu 3.1 enables it with `attributes: {lang: true}`, the adapter feeds the system's localizations into the menu. Text formats could not carry the attribute, so it is an element node like the link.

## Bundle size (2026-09-24, sixth iteration)

34. **The controller stays one file, terser runs after esbuild.** Measured with an esbuild metafile: the controller was already minified and already picked Lexical's production builds (`process.env.NODE_ENV` defined, `production` export condition), there are no duplicated packages and no dev code left. esbuild's output is 618 KB unminified. A second pass with terser (`compress.passes: 2`) brings it from 405.1 KB to 403.6 KB minified and from 130.9 KB to 125.6 KB gzip (109.5 KB to 103.9 KB brotli). `@primavista/react` declares `sideEffects: false`, core and sulu already did. What the 404 KB contain, minified: `lexical` 197 KB, `@lexical/table` 62 KB, own code 42 KB, `@lexical/link`, `@lexical/list` and `@lexical/html` 19 KB each, `@lexical/rich-text` 15 KB, `@lexical/utils` 12 KB, `@lexical/extension` with its signals 13 KB, the rest under 9 KB each. The re-exports of decision 12 cost 48 KB minified and 18 KB gzip (`lexical` 15 KB, `lexicalLink` and `lexicalUtils` 34 KB, because they keep all of `@lexical/html` and `@lexical/utils`). They stay, they are the only way to write plugins for the UX bundle. Bundler builds do not pay for them, the React island tree-shakes them away. `pnpm size` checks the built files against budgets about 10 % above these sizes and runs in CI. The 80 KB from the kickoff are out of reach without dropping features: rejected were lazy-loading the table plugin (a second file breaks the single self-contained file of decision 11), trimming the re-exports (breaks plugin authors), building Lexical from its TypeScript sources (430 KB, the error messages come back) and a minified stylesheet (9 KB, the readable file documents the `--pv-*` variables).
## Sanitizing (2026-09-24, seventh iteration)

35. **The server is the trust boundary.** A browser sanitizer protects nothing, because anyone can post to the form without the editor. The editor exports a closed set of tags and attributes and no client-side sanitizer ships. `primavista/ux-bundle` requires `symfony/html-sanitizer` and registers the sanitizer `primavista`, built by `PrimavistaSanitizerConfig::create()`, that allows exactly that markup and blocks the rest: blocks, text formats, lists with `start`, links with `href target title rel`, `<internal-link>` with its attributes, `<span lang>`, tables with `colspan` and `rowspan`, `figure.table` and `dir`. `style` survives only as one `text-align` declaration with a value the alignment plugin writes. `PrimavistaType` defaults to `sanitize_html: true` with that sanitizer whenever FrameworkBundle's `html_sanitizer` is enabled. The helper takes the internal link's tag and validation attribute, so the same rules cover `<sulu-link>`. The sanitizer serializes on its own (`<br />`, entity-encoded attribute characters), the stored markup is equivalent but not byte-identical to the editor's. Rejected: a suggested dependency, which would leave a field that accepts HTML unsanitized because a package was missing, and prepending the rules into `framework.html_sanitizer`, which cannot express the `text-align` rule without a separate service and would duplicate the PHP helper.

## Rejected

- **ProseMirror or Tiptap as the base.** Larger bundle, and Tiptap adds a commercial layer Primavista wants to avoid.
- **Own document model.** Not realistic for a prototype, contenteditable edge cases cost years.
- **JSON as source of truth with a PHP renderer.** More power, more work, and Sulu does not need it.
- **iframe or Shadow DOM isolation for true WYSIWYG.** Explicitly unimportant for Sulu.
- **Collaboration.** Not needed.
- **`@lexical/react` for the React binding.** Would duplicate the toolbar and state handling.
- **Web Component as the core.** Shadow DOM would isolate host CSS, which Sulu does not want, and complicates form integration.
- **A standalone `InternalLinkNode` element class.** Would need its own wrap, split and unwrap logic. Subclassing `LinkNode` gets that from Lexical.
- **Editing links from the toolbar button.** Sulu users know the balloon, and a button that both creates and edits hides which one it does.
- **A client-side sanitizer such as DOMPurify.** More bundle size for a check an attacker skips by posting directly. See 34.

## Open

- GitHub organization and final name. The `primavista` GitHub account is taken, npm and Packagist are free. Name may still change. Not a concern while the project runs locally.
- Media upload and mention hooks: own event system or existing conventions.
- A manual click-through inside a running Sulu Admin. The automated Sulu checks passed, the browser session inside Sulu is still to do.
- Publishing to npm and Packagist.
- Server-side sanitizing inside Sulu. Sulu saves content through its own API, not through Symfony forms, and `primavista/sulu-bundle` cannot reuse `PrimavistaSanitizerConfig` without depending on the UX bundle.
- Publishing: npm scope `@primavista` and Packagist vendor `primavista` are free, the GitHub account is not.
