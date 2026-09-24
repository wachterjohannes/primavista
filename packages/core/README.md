# @primavista/core

Framework-free WYSIWYG editor core on top of Lexical. HTML in, HTML out. Ships its own toolbar, so a binding only has to mount it.

```ts
import { createEditor, alignment, formatting, headings, internalLinks, links, lists, tables, history } from '@primavista/core';
import '@primavista/core/primavista.css';

const editor = createEditor(host, {
  plugins: [
    history(),
    formatting({ formats: ['bold', 'italic'] }),
    headings({ levels: ['h2', 'h3'] }),
    lists(),
    links({ defaultTarget: '_self' }),
    internalLinks({ providers: [{ key: 'page', label: 'Page' }] }),
    alignment(),
    tables(),
  ],
  initialHtml: '<p>Hello</p>',
  placeholder: 'Write…',
  editable: true,
});

editor.on('change', (html) => save(html));
editor.getHtml();
editor.setHtml(html);      // replaces the document, no change event, not undoable
editor.isEmpty();
editor.setEditable(false);
editor.destroy();
```

## Plugin API

```ts
interface PrimavistaPlugin {
  name: string;
  nodes?: Klass<LexicalNode>[];
  theme?: EditorThemeClasses;
  register?(context: PluginContext): (() => void) | void;
  toolbar?: ToolbarItem[];
}
```

Toolbar items are buttons, native selects or menus. Their state callbacks run inside `editor.read()`. See the repository README for a full example and for the link dialog contract.

## Storage helpers

`internalLinks` stores links to host resources as `<internal-link href="id?query#anchor" provider="page">`. The tag and the validation attribute are options, `@primavista/sulu` sets them to Sulu's `<sulu-link>` format and adds the Sulu preset, theme and `enter_mode` helpers. `InternalLinkNode`, `$isInternalLinkNode`, `$getLinkAtSelection` and `registerLinkBalloon` are exported for plugin authors.

## Theming

All colors and spacings are CSS custom properties on `.pv-editor` (`--pv-accent`, `--pv-border`, `--pv-toolbar-bg`, …). Override them on a parent element.
