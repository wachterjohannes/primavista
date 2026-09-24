# @primavista/sulu

Everything Sulu-specific about the Primavista editor, kept out of `@primavista/core`: the `<sulu-link>` plugin, the plugin list of Sulu's `text_editor` field, the CKEditor-compatible output preset, the Sulu Admin theme and the `enter_mode` helpers. Sulu's adapter component itself lives in Sulu, see `docs/sulu-integration.md` in the repository.

```ts
import { Editor } from '@primavista/react';
import { htmlToSuluValue, suluPlugins, suluPreset, suluValueToHtml } from '@primavista/sulu';
import '@primavista/core/primavista.css';
import '@primavista/sulu/sulu.css';

const plugins = suluPlugins({
  providers: [{ key: 'page', label: 'Pages' }, { key: 'media', label: 'Media' }],
  formats: ['h2', 'h3'],                              // the template's `formats`, default h2 to h6
  openInternalLinkDialog: (state) => showLinkOverlay(state),
  openExternalLinkDialog: (state) => showExternalOverlay(state),
});

<Editor
  value={suluValueToHtml(value, enterMode)}
  onChange={(html) => onChange(htmlToSuluValue(html, enterMode))}
  plugins={plugins}
  {...suluPreset()}
/>
```

## What is in it

- `suluLinks({ providers, openDialog, describe })`: the core's `internalLinks` plugin writing `<sulu-link href="uuid?query#anchor" provider target title sulu-validation-state>`, with `_self` as the default target. The validation state survives the round trip and is styled red (`removed`) or with a marker (`unpublished`).
- `suluPlugins(options)`: history, the seven inline formats, headings, lists, external links, `suluLinks`, alignment and tables, in the order of Sulu's CKEditor toolbar.
- `suluPreset()`: `theme: 'sulu'` plus `html: { tableWrapper: 'figure', tableHeadSection: true, emptyParagraph: 'nbsp' }`, so stored content stays byte-compatible with CKEditor.
- `sulu.css`: the Sulu Admin look as CSS variables under `.pv-editor.pv-theme-sulu`.
- `stripParagraphs`, `wrapParagraphs`, `suluValueToHtml`, `htmlToSuluValue`: Sulu's `enter_mode: br` format and the empty value contract (`undefined` for an empty editor).
- `suluTranslationKey(key)`: maps the core's `toolbar.*` and `link.*` keys to `sulu_admin.primavista.*`.

The core stays free of Sulu: without this package internal links are stored as `<internal-link>` and the default theme applies.
