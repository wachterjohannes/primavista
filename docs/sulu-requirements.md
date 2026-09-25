# What Sulu uses from CKEditor 5

Read from the Sulu 3.0 source on 2026-09-24 (`src/Sulu/Bundle/AdminBundle/Resources/js/containers/CKEditor5`, `containers/TextEditor`, `src/Sulu/Bundle/MarkupBundle`). This is the bar Primavista has to clear before it can replace CKEditor in Sulu Admin.

## Editor configuration

Toolbar, verbatim from `CKEditor5.js`:

```
heading, bold, italic, underline, strikethrough, subscript, superscript,
bulletedlist, numberedlist, externalLink, internalLink, alignment, insertTable, code
```

Plugins: Alignment, Bold, Code, Essentials (undo, clipboard, enter, typing), Heading, Italic, List, Paragraph, Strikethrough, Subscript, Superscript, Table, TableToolbar, Underline, plus the two Sulu plugins ExternalLinkPlugin and InternalLinkPlugin. Table content toolbar: `tableColumn`, `tableRow`, `mergeTableCells`.

Not used by Sulu: Autoformat, PasteFromOffice, RemoveFormat, SourceEditing, WordCount, images inside the text, block quotes, horizontal rules.

## Field type options

`text_editor` is a Sulu form field backed by `textEditorRegistry` (`index.js` registers `ckeditor5` as the only adapter). Options from the XML template reach the adapter as `formats` and `options`:

- `formats`: which headings the heading select offers. Default `h2` to `h6`, `h1` opt-in.
- `enter_mode`: `p` (default) or `br`. With `br`, `utils.js` rewrites `<p>a</p><p>b</p>` to `<!--p-->a<!--/p--><br></br><!--p-->b<!--/p-->` on the way out and back on the way in. Single paragraphs are unwrapped.
- `locale`: an observable. The editor passes it to the internal link overlays and re-reads it on language switches.

Tables and alignment are always on. There is no XML switch for them.

## The link system

Two separate plugins, two separate toolbar buttons.

**External links** (`plugins/ExternalLinkPlugin`) render `<a href target title rel>`. The overlay has URL, target (default `_self`), title and rel. `mailto:` URLs are split into address, subject and body fields and reassembled. A balloon under the link offers edit, unlink and a preview link.

**Internal links** (`plugins/InternalLinkPlugin`) render a custom element:

```html
<sulu-link href="uuid?query#anchor" provider="page" target="_self" title="…" sulu-validation-state="unpublished">text</sulu-link>
```

The toolbar button is a dropdown over every registered link type. Types come from `linkTypeRegistry` (`index.js` line 324, fed by the admin config): pages, media, articles, contacts, and anything a project registers. Each type brings an overlay with a list adapter, resource key, display properties and allowed targets. The overlay collects href (a UUID), anchor, query, target and title.

Both plugins disable their buttons while the caret is in a link. Editing goes through the balloon.

**Server side.** `MarkupBundle` never touches the stored HTML. `MarkupListener` rewrites `<sulu-link>` to `<a>` on the response, after `LinkTag` has resolved UUIDs through the `sulu.link.provider` services (page, article, media, external). `LinkTag::validateAll` adds `sulu-validation-state="unpublished|removed"` when content loads into the admin. The editor styles those states (red strikethrough for removed, marker for unpublished). `remove-if-not-exists` drops the tag when the target is gone.

## Runtime behaviour

- Props are `value`, `onChange`, `onBlur`, `onFocus`, `disabled`, `formats`, `locale`, `options`.
- An empty editor reports `onChange(undefined)`, not `""`. An incoming `""` on an empty editor does not call `setData`.
- `onChange` fires only on model changes, not on selection.
- `disabled` toggles CKEditor's read-only mode and a `.disabled` class.
- Many editors live on one page (blocks), each mounted and unmounted with the block.
- No client-side sanitizing. `sanitize-html` is a dependency but unused in this path.
- Extension points: `pluginRegistry.add(Plugin)` and `configRegistry.add(config => config)`. Project code uses them to add CKEditor plugins and merge toolbar entries.

## Status

Closed on 2026-09-24, second iteration: internal links with providers, dialog seam and validation state (1, 4), external link target, title, rel (2), balloon (3), alignment (5), subscript, superscript and code in the default toolbar (6), merge and split cells (7), `enter_mode: br` helpers (8), `formats` mapping and empty value contract in the reference adapter (9, 10, 12), locale passed through by the adapter (11). The reference adapter is `sulu/PrimavistaTextEditor.js`, the wiring is described in `sulu-integration.md`. Still open: toolbar translations and a run inside a real Sulu build.

## Gap list for Primavista (first prototype, kept for the record)

Prototype at that time: bold, italic, underline, strikethrough, heading select h1 to h4, ul, ol, link with URL panel, table with header row and row and column operations, undo and redo, plugin API, `value`/`onChange`/`onBlur` React contract.

Missing, in order of pain:

1. **Internal links** as `<sulu-link>` with provider, UUID, query, anchor, target, title and validation state. Needs a custom Lexical node with import and export rules, a dropdown per link type, and a way for Sulu to plug its overlays in. The `openDialog` hook on the links plugin is the seam, but the node type does not exist yet.
2. **External link fields**: target, title, rel, `mailto:` composer. The prototype only asks for a URL.
3. **Link balloon**: edit, unlink and preview under the link instead of a toolbar panel. Buttons disabled inside a link.
4. **Validation state styling** for `sulu-validation-state="unpublished|removed"`. Attribute must survive the round trip.
5. **Alignment** (left, center, right, justify) on blocks. CKEditor writes `style="text-align:…"`. Sulu projects depend on that.
6. **Subscript, superscript, inline code**: the core supports the formats, the default toolbar hides them. Configuration only.
7. **Merge and split table cells**. Row and column tools exist. Merge exists in Lexical, the toolbar item does not.
8. **`enter_mode: br`** conversion, or a decision to drop it in 3.0.
9. **`formats` option** driving the heading select. The plugin has `levels`, the adapter has to map it.
10. **Empty value contract**: `undefined` instead of `""`, and no reload on `""`.
11. **Locale observable** passed to link overlays, not needed by the core.
12. **Heading `h1` opt-in** and default `h2` to `h6`. Prototype defaults to `h1` to `h4`.

Nice to have, not used by Sulu today: paste from Word cleanup, autoformat shortcuts, word count. All three exist now: `pasteCleanup` is part of `suluPlugins()`, autoformat and word count are opt-in (`suluPlugins({ autoformat: true })`, `wordCount()`), see decisions 37 and 39 in `DECISIONS.md`.
