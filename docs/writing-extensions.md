# Writing an extension

An extension adds a plugin to the editor. There are three levels. The level decides what a Lexical update means for you.

| Level | You write | A Lexical update affects you |
| --- | --- | --- |
| 1. Configuration | YAML, for Sulu | No |
| 2. Helpers | JavaScript without Lexical | No, as long as Primavista's own API stays stable |
| 3. Raw Lexical | Lexical commands and nodes | Yes, read `UPGRADE.md` |

Start at the lowest level that does the job.

## Level 1: configuration (Sulu)

An inline element such as `<mark>` needs no JavaScript in a Sulu project:

```yaml
# config/packages/primavista_sulu.yaml
primavista_sulu:
    elements:
        - { tag: mark }
        - { tag: abbr, attributes: [title] }
        - { tag: span, class: lead }
```

The sanitizer allows the element and the admin gets a toolbar button. Common tags such as `span` need a class. With attributes the button opens a small form to enter their values. See the Sulu bundle page for the details.

## Package setup

An extension never installs Lexical and does not bundle the core. It names the core as a peer dependency, so the project decides the version and there is one copy:

```json
{
  "peerDependencies": {
    "@primavista/core": ">=0.1.0 <1.0.0"
  },
  "devDependencies": {
    "@primavista/core": "^0.1.0"
  }
}
```

Raise the lower bound to the first release that has the helpers you use. While Primavista is below 1.0 a caret range such as `^0.1.0` excludes `0.2.0`, which is why the range above spells out the upper bound. TypeScript projects need `moduleResolution` `bundler`, `node16` or `nodenext`, the same as Lexical itself. Until the packages are on npm, install them as tarballs, see the Sulu integration page. The examples in `examples/` follow this setup.

## Level 2: helpers

Three helpers cover the common cases. Each creates the Lexical node, the import and export, paste handling and the schema entry.

A helper claims its element by tag, plus `className` or `requires` (attributes the element must have). Common tags such as `span`, `div` or `a` need one of the two, otherwise the helper throws. Other elements of the tag, such as `<span lang>`, stay untouched. Two helpers may share a tag when their classes differ. Tags such as `script`, `iframe` or `svg` and the attributes `style`, `class`, `srcdoc` and `on*` are refused, the same rule as in the Sulu configuration.

```ts
import { blockElement, inlineElement, voidElement } from '@primavista/core';

export const highlight = inlineElement({ name: 'highlight', tag: 'mark', toolbar: { label: 'Highlight' } });
export const note = blockElement({ name: 'note', tag: 'aside', toolbar: { label: 'Note' } });
export const newsletter = voidElement({
  name: 'newsletter',
  tag: 'div', // claims only divs with data-widget, the keys of `defaults`
  defaults: { 'data-widget': 'newsletter' },
  toolbar: { label: 'Newsletter' },
});
```

For actions on the content the editor has `insertText`, `insertHtml`, `getSelectedText` and `toggleFormat`. A plugin gets the editor as `context.primavista` in `register`.

Test it with `@primavista/core/testing`:

```ts
import { expectRoundTrip, paste } from '@primavista/core/testing';

expectRoundTrip([...defaultPlugins(), highlight], '<p>a <mark>b</mark></p>');
```

`paste(editor, { 'text/html': '…' })` runs the paste cleanup, so you can check that your markup survives it. The repository has a complete extension for each level in `examples/`.

### How far level 2 goes

`examples/editorial-kit` is the largest extension that needs no Lexical. It has two colours of `<mark>`, `<abbr title>` with a form, `<kbd>`, a note box, a newsletter placeholder with a preview, a menu of snippets, a menu of special characters, a text case menu that rewrites the selection, a button with its own pressed state, a tooltip for abbreviations, a reading time line and a status line that follows the selection. All of it uses only these parts of the API:

| Part | What it gives you |
| --- | --- |
| `inlineElement`, `blockElement`, `voidElement` | elements with import, export, paste and toolbar button |
| toolbar `menu` and `button` items | your own actions, `onSelect` and `onClick` need no editor argument |
| `context.primavista` | `insertText`, `insertHtml`, `getSelectedText`, `toggleFormat`, `getSelection`, `on('change')`, `on('selectionchange')`, `getHtml` |
| `context.balloon`, `context.toolbar.openPanel` | floating panels and form rows |
| `context.contentElement`, `context.container` | plain DOM events and extra elements, removed in the cleanup |

What it cannot do, and what to reach for instead:

- **Format-preserving rewrites.** `getSelectedText` and `insertText` work on plain text, so a text case change drops bold and links inside the selection. Keeping them needs the nodes, level 3.
- **Anything the selection info does not carry.** `getSelection()` returns the collapsed state, the text, the inline formats, the top-level block and the elements around the start of the selection with their attributes. A toolbar item uses it in `isActive`, `isDisabled` and `getValue`, and `on('selectionchange')` follows it. Questions about the structure beyond that, such as the position inside a list or a table cell, need Lexical.
- **Your own element inside the text that is not one of the three shapes.** An inline element with attributes the user edits in place, a table-like block or a nested structure needs a node class, level 3.
- **A format that overlaps a built-in tag.** Claim a tag such as `kbd` with a helper and the helper wins, but formats inside it still apply.

## Level 3: raw Lexical

Use this when no helper fits. Import Lexical through the core:

```ts
import { $getSelection, $isRangeSelection } from '@primavista/core/lexical';
import { $findMatchingParent } from '@primavista/core/lexical/utils';
```

Do not add `lexical` to your `dependencies`. `@primavista/core/lexical` hands out the copy the editor uses. A second copy breaks `instanceof` checks and node registration. `createEditor` throws a clear error when a plugin brings node classes from another copy. It cannot see a plugin without nodes of its own, so a plugin that only imports `$getSelection` from a second copy of `lexical` fails later with Lexical's own, less clear error. Importing everything through `@primavista/core/lexical` avoids that.

`context.editor` and everything under `@primavista/core/lexical` follow Lexical, not Primavista. They have no stability promise. Declare the markup your plugin writes in `schema`, so paste cleanup and sanitizers know it.

The guard cannot see a plugin that has no nodes and only imports `$getSelection` from a second copy of Lexical. Two checks close that gap in your project:

```js
// eslint.config.js: Lexical comes from the core, never from its own package
{
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{ group: ['lexical', '@lexical/*'], message: 'Import from @primavista/core/lexical instead.' }],
    }],
  },
}
```

```json
{ "scripts": { "check:lexical": "primavista-check-lexical" } }
```

`primavista-check-lexical` ships with `@primavista/core`. It runs `npm ls lexical` and fails when more than one version is installed.

### Symfony UX projects

The Symfony UX controller has no bundler and ships its own copy of Lexical, so a project cannot import `@primavista/core/lexical`. A plugin gets the core in the `primavista:pre-connect` event as `detail.core`. It holds everything `@primavista/core` exports: the helpers (`inlineElement`, `blockElement`, `voidElement`), `createEditor` and the plugins.

Lexical is limited to three namespaces on `detail.core`: `lexical`, `lexicalLink` and `lexicalUtils`. The other `@lexical/*` packages, such as lists or tables, are not reachable. A level 3 extension in a UX project is therefore limited to those three. Use the helpers where you can, they work the same as in a bundler project.

In Jest, add `lexical|@lexical|@primavista` to `transformIgnorePatterns`, because Lexical ships ES modules and Jest does not transform `node_modules` by default.
