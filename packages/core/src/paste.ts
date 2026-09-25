import { FORMAT_TAGS } from './html';
import type { Alignment } from './plugins/alignment';
import { DEFAULT_FORMATS, type InlineFormat } from './plugins/formatting';
import type { ListTag } from './plugins/lists';

/**
 * What survives `cleanPastedHtml`. The defaults match `defaultPlugins()`:
 * every inline format, headings, lists, links, tables and alignment, but no
 * language spans, because `language()` is opt-in.
 */
export interface CleanPastedHtmlOptions {
  /** Inline formats written as `strong`, `em`, `u`, `s`, `sub`, `sup` and `code`. */
  formats?: ReadonlyArray<InlineFormat>;
  /** Keep `h1` to `h6`. Otherwise headings become paragraphs. */
  headings?: boolean;
  /**
   * Keep `ul`, `ol` and Word's list paragraphs as lists. A list of types keeps
   * only those, a list of the other type is retyped. Otherwise items become
   * paragraphs.
   */
  lists?: boolean | ReadonlyArray<ListTag>;
  /** Keep `a href`. Otherwise the link text stays without the link. */
  links?: boolean;
  /**
   * Keep the editor's internal link element with `href`, `provider`, `target`,
   * `title` and the validation attribute. `InternalLinkNode.tagName` and
   * `InternalLinkNode.validationAttribute` in the editor.
   */
  internalLink?: { tag: string; validationAttribute: string };
  /** Keep tables. Otherwise every cell becomes a paragraph. */
  tables?: boolean;
  /** Keep `text-align` on paragraphs, headings and cells, all values or only the listed ones. */
  alignment?: boolean | ReadonlyArray<Alignment>;
  /** Keep text parts in another language than the pasted document as `<span lang>`. */
  language?: boolean;
}

interface Schema {
  formats: ReadonlySet<string>;
  headings: boolean;
  lists: ReadonlySet<ListTag>;
  links: boolean;
  internalLink: { tag: string; validationAttribute: string } | null;
  tables: boolean;
  alignment: ReadonlySet<string>;
  language: boolean;
}

interface Context {
  doc: Document;
  schema: Schema;
  /** Language of the pasted document, from `<html lang>` or Word's `<body lang>`. */
  defaultLang: string | null;
}

/** Inherited while walking down the pasted DOM, applied to every text node. */
interface State {
  formats: ReadonlySet<InlineFormat>;
  lang: string | null;
  align: string | null;
  inLink: boolean;
  pre: boolean;
}

/**
 * Where output goes. `flow` takes blocks and inline content, `item` and
 * `text` only inline content, `list`, `table` and `row` only their
 * structural children. With `wrapInline` a flow collects loose inline content
 * in `paragraph`: a table cell, so the cell's alignment can sit on it, and a
 * `div` that mixes text and blocks. The top level keeps inline content as it
 * is, so pasting a few words lands inside the current paragraph.
 */
interface Frame {
  kind: 'flow' | 'item' | 'text' | 'list' | 'table' | 'row';
  element: HTMLElement;
  paragraph: HTMLElement | null;
  wrapInline: boolean;
  inTable: boolean;
}

function frameFor(kind: Frame['kind'], element: HTMLElement, parent: Frame | null, wrapInline = false): Frame {
  return { kind, element, paragraph: null, wrapInline, inTable: parent?.inTable ?? false };
}

/** Removed together with their content. */
const DROPPED_TAGS = new Set([
  'audio', 'base', 'button', 'canvas', 'col', 'colgroup', 'embed', 'frame', 'head', 'hr', 'iframe', 'img', 'input',
  'link', 'map', 'math', 'meta', 'noscript', 'object', 'option', 'picture', 'script', 'select', 'source', 'style',
  'svg', 'template', 'textarea', 'title', 'track', 'video', 'xml',
]);

/** Block-level wrappers without a meaning of their own. With only inline content inside they become a paragraph. */
const CONTAINER_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'caption', 'center', 'dd', 'details', 'dialog', 'div', 'dl', 'dt',
  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'header', 'hgroup', 'main', 'nav', 'section', 'summary',
]);

const BLOCK_TAGS = new Set([
  ...CONTAINER_TAGS,
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'ol', 'p', 'pre', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul',
]);

const TAG_FORMATS: Readonly<Record<string, InlineFormat>> = {
  b: 'bold',
  strong: 'bold',
  i: 'italic',
  em: 'italic',
  u: 'underline',
  ins: 'underline',
  s: 'strikethrough',
  strike: 'strikethrough',
  del: 'strikethrough',
  sub: 'subscript',
  sup: 'superscript',
  code: 'code',
  kbd: 'code',
  samp: 'code',
  tt: 'code',
};

const MERGEABLE_TAGS = new Set(['strong', 'em', 'u', 's', 'sub', 'sup', 'code', 'span', 'ul', 'ol']);

const ALIGNMENTS = new Set(['center', 'right', 'justify']);

const WORD_LIST = /\bl(\d+)\s+level(\d+)\s+lfo(\d+)/;

/**
 * Reduces pasted HTML from Word, Google Docs, LibreOffice or a web page to
 * the markup the editor produces itself: paragraphs, headings, lists, tables,
 * links, `br` and the inline format elements. Classes, ids, inline styles,
 * `<font>`, `<o:p>`, comments and wrapper spans are dropped. Formatting that
 * the source expressed as inline style (`font-weight: 700`,
 * `font-style: italic`, `text-decoration`, `vertical-align`) becomes the
 * matching element, Word's list paragraphs become real lists and empty
 * paragraphs disappear. Needs a DOM (`DOMParser`), otherwise pure.
 */
export function cleanPastedHtml(html: string, options: CleanPastedHtmlOptions = {}): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const ctx: Context = {
    doc,
    schema: {
      formats: new Set(options.formats ?? DEFAULT_FORMATS),
      headings: options.headings ?? true,
      lists: setOf(options.lists ?? true, ['ul', 'ol']),
      links: options.links ?? true,
      internalLink: options.internalLink ?? null,
      tables: options.tables ?? true,
      alignment: setOf(options.alignment ?? true, [...ALIGNMENTS] as Alignment[]),
      language: options.language ?? false,
    },
    defaultLang: normalizeLang(doc.documentElement.getAttribute('lang')) ?? normalizeLang(doc.body.getAttribute('lang')),
  };
  convertWordLists(doc.body);
  const output = doc.createElement('div');
  const state: State = { formats: new Set(), lang: null, align: null, inLink: false, pre: false };
  walkChildren(ctx, doc.body, frameFor('flow', output, null), state);
  tidy(output);
  return output.innerHTML;
}

function setOf<T>(value: boolean | ReadonlyArray<T>, all: ReadonlyArray<T>): ReadonlySet<T> {
  if (value === true) return new Set(all);
  if (value === false) return new Set();
  return new Set(value);
}

function walkChildren(ctx: Context, parent: Node, frame: Frame, state: State): void {
  for (const child of Array.from(parent.childNodes)) walk(ctx, child, frame, state);
}

function walk(ctx: Context, node: Node, frame: Frame, state: State): void {
  if (node.nodeType === Node.TEXT_NODE) {
    emitText(ctx, node as Text, frame, state);
    return;
  }
  // Comments, including Word's conditional comments, carry nothing worth keeping.
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const element = node as HTMLElement;
  const tag = element.localName.toLowerCase();
  const style = parseStyle(element);
  if (isDropped(element, tag, style)) return;
  const next = nextState(ctx, element, tag, style, state);

  if (tag === 'br') emitLineBreak(ctx, element, frame, next);
  else if (/^h[1-6]$/.test(tag)) block(ctx, element, ctx.schema.headings ? tag : 'p', frame, next);
  else if (tag === 'p') block(ctx, element, 'p', frame, next);
  else if (tag === 'pre') block(ctx, element, 'p', frame, { ...next, pre: true });
  else if (tag === 'ul' || tag === 'ol') list(ctx, element, tag, frame, next);
  else if (tag === 'li') listItem(ctx, element, frame, next);
  else if (tag === 'table') table(ctx, element, frame, next);
  else if (tag === 'tr') row(ctx, element, frame, next);
  else if (tag === 'td' || tag === 'th') cell(ctx, element, tag, frame, next);
  else if (tag === 'a') link(ctx, element, frame, next);
  else if (ctx.schema.internalLink && tag === ctx.schema.internalLink.tag) internalLink(ctx, element, frame, next);
  else if (CONTAINER_TAGS.has(tag)) container(ctx, element, frame, next);
  // Everything else is a wrapper: span, font, b, i, o:p, tbody and unknown elements.
  else walkChildren(ctx, element, frame, next);
}

function isDropped(element: HTMLElement, tag: string, style: Record<string, string>): boolean {
  if (DROPPED_TAGS.has(tag)) return true;
  // Word's VML shapes and drawings.
  if (tag.startsWith('v:')) return true;
  // Word's `<o:p>&nbsp;</o:p>` marks an empty paragraph.
  if (tag === 'o:p' && isBlank(element.textContent)) return true;
  if (element.hidden || style['display'] === 'none') return true;
  // The bullet or number Word writes in front of a list paragraph.
  if (style['mso-list'] === 'ignore') return true;
  // Chrome and Safari append it to copied content.
  if (element.classList.contains('Apple-interchange-newline')) return true;
  return false;
}

function nextState(ctx: Context, element: HTMLElement, tag: string, style: Record<string, string>, state: State): State {
  const formats = new Set(state.formats);
  const tagFormat = TAG_FORMATS[tag];
  if (tagFormat) formats.add(tagFormat);
  // Google Docs wraps the whole clipboard content in `<b id="docs-internal-guid-…">`, which is not bold.
  if (element.id.startsWith('docs-internal-guid')) formats.delete('bold');

  const weight = style['font-weight'];
  if (weight) {
    const numeric = Number.parseInt(weight, 10);
    if (weight === 'bold' || weight === 'bolder' || numeric >= 600) formats.add('bold');
    else if (weight === 'normal' || weight === 'lighter' || numeric < 600) formats.delete('bold');
  }

  const fontStyle = style['font-style'];
  if (fontStyle === 'italic' || fontStyle === 'oblique') formats.add('italic');
  else if (fontStyle === 'normal') formats.delete('italic');

  // Links are underlined by the browser. Google Docs and Word repeat that as
  // inline style, which must not become `<u>` inside every link.
  const inLink = state.inLink || tag === 'a' || tag === ctx.schema.internalLink?.tag;
  const decoration = style['text-decoration-line'] ?? style['text-decoration'];
  if (decoration === 'none') {
    formats.delete('strikethrough');
    if (!inLink) formats.delete('underline');
  } else if (decoration) {
    if (decoration.includes('line-through')) formats.add('strikethrough');
    if (decoration.includes('underline') && !inLink) formats.add('underline');
  }

  const verticalAlign = style['vertical-align'];
  if (verticalAlign === 'super') {
    formats.add('superscript');
    formats.delete('subscript');
  } else if (verticalAlign === 'sub') {
    formats.add('subscript');
    formats.delete('superscript');
  } else if (verticalAlign === 'baseline') {
    formats.delete('superscript');
    formats.delete('subscript');
  }

  const align = alignmentOf(ctx, element, tag, style);
  return {
    formats,
    lang: languageOf(ctx, element, state.lang),
    align: align === undefined ? state.align : align,
    inLink,
    pre: state.pre,
  };
}

/**
 * The alignment an element sets for its content: a value, null for an
 * explicit `left` or `start` (the default), undefined if it sets none.
 * `align` on a table positions the table, not its text.
 */
function alignmentOf(ctx: Context, element: HTMLElement, tag: string, style: Record<string, string>): string | null | undefined {
  if (ctx.schema.alignment.size === 0 || tag === 'table') return undefined;
  const value = style['text-align'] ?? element.getAttribute('align')?.toLowerCase();
  if (!value) return undefined;
  return ALIGNMENTS.has(value) && ctx.schema.alignment.has(value) ? value : null;
}

/**
 * The language of the text inside an element. Word and LibreOffice mark runs
 * whose language differs from the document with `lang`, the document language
 * itself is dropped. `lang="x-none"` and other invalid values are ignored.
 */
function languageOf(ctx: Context, element: HTMLElement, inherited: string | null): string | null {
  if (!element.hasAttribute('lang')) return inherited;
  const value = element.getAttribute('lang') ?? '';
  if (value.trim() === '') return null;
  const lang = normalizeLang(value);
  if (lang === null) return inherited;
  return ctx.defaultLang !== null && sameLanguage(lang, ctx.defaultLang) ? null : lang;
}

function emitText(ctx: Context, node: Text, frame: Frame, state: State): void {
  if (frame.kind === 'list' || frame.kind === 'table' || frame.kind === 'row') return;
  const raw = node.data;
  if (raw === '') return;
  if (!state.pre && /^[ \t\n\r\f]*$/.test(raw)) {
    // Source formatting between blocks, for example Word's line breaks between paragraphs.
    if (frame.kind !== 'text' && (isBlockBoundary(node, 'previousSibling') || isBlockBoundary(node, 'nextSibling'))) return;
    if (frame.kind === 'flow' && frame.wrapInline && !frame.paragraph) return;
  }
  const target = inlineTarget(ctx, frame, state);
  if (!target) return;
  if (!state.pre) {
    target.appendChild(wrap(ctx, ctx.doc.createTextNode(raw.replace(/[ \t\n\r\f]+/g, ' ')), state));
    return;
  }
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((line, index) => {
    if (index > 0) target.appendChild(ctx.doc.createElement('br'));
    if (line !== '') target.appendChild(wrap(ctx, ctx.doc.createTextNode(line), state));
  });
}

function emitLineBreak(ctx: Context, node: HTMLElement, frame: Frame, state: State): void {
  // Google Docs writes an empty paragraph as a `<br>` between blocks.
  if (frame.kind === 'flow' && (isBlockBoundary(node, 'previousSibling') || isBlockBoundary(node, 'nextSibling'))) return;
  inlineTarget(ctx, frame, state)?.appendChild(ctx.doc.createElement('br'));
}

/** Wraps a text node in its format elements, in the order the editor exports them, and in a language span. */
function wrap(ctx: Context, text: Text, state: State): Node {
  let node: Node = text;
  for (const [format, tag] of FORMAT_TAGS) {
    if (!state.formats.has(format as InlineFormat) || !ctx.schema.formats.has(format)) continue;
    const element = ctx.doc.createElement(tag);
    element.appendChild(node);
    node = element;
  }
  if (state.lang && ctx.schema.language) {
    const span = ctx.doc.createElement('span');
    span.setAttribute('lang', state.lang);
    span.appendChild(node);
    node = span;
  }
  return node;
}

function inlineTarget(ctx: Context, frame: Frame, state: State): HTMLElement | null {
  if (frame.kind === 'item' || frame.kind === 'text') return frame.element;
  if (frame.kind !== 'flow') return null;
  if (!frame.wrapInline) return frame.element;
  if (!frame.paragraph) {
    frame.paragraph = createBlock(ctx, 'p', state);
    frame.element.appendChild(frame.paragraph);
  }
  return frame.paragraph;
}

function createBlock(ctx: Context, tag: string, state: State): HTMLElement {
  const element = ctx.doc.createElement(tag);
  if (state.align) element.style.textAlign = state.align;
  return element;
}

/** A paragraph or heading. Inside a list item or another block it only contributes its inline content. */
function block(ctx: Context, element: HTMLElement, tag: string, frame: Frame, state: State): void {
  switch (frame.kind) {
    case 'flow': {
      const created = createBlock(ctx, tag, state);
      frame.element.appendChild(created);
      frame.paragraph = null;
      walkChildren(ctx, element, frameFor('text', created, frame), state);
      return;
    }
    case 'list': {
      const item = ctx.doc.createElement('li');
      frame.element.appendChild(item);
      walkChildren(ctx, element, frameFor('item', item, frame), state);
      return;
    }
    case 'item':
      if ((frame.element.textContent ?? '').trim() !== '') frame.element.appendChild(ctx.doc.createElement('br'));
      walkChildren(ctx, element, frame, state);
      return;
    case 'text':
      walkChildren(ctx, element, frame, state);
      return;
    default:
      return;
  }
}

/** A `div` and friends: a paragraph if it only holds inline content, otherwise transparent. */
function container(ctx: Context, element: HTMLElement, frame: Frame, state: State): void {
  if (!hasBlockDescendant(element)) {
    block(ctx, element, 'p', frame, state);
    return;
  }
  if (frame.kind !== 'flow') {
    walkChildren(ctx, element, frame, state);
    return;
  }
  // Loose text next to the blocks inside becomes a paragraph of its own.
  walkChildren(ctx, element, frameFor('flow', frame.element, frame, true), state);
  frame.paragraph = null;
}

function list(ctx: Context, element: HTMLElement, tag: string, frame: Frame, state: State): void {
  const types = ctx.schema.lists;
  if (types.size === 0 || frame.kind === 'text') {
    walkChildren(ctx, element, frame, state);
    return;
  }
  // A list of a type the editor does not offer becomes the type it does.
  const type = tag === 'ol' && !types.has('ol') ? 'ul' : tag === 'ul' && !types.has('ul') ? 'ol' : tag;
  if (frame.kind === 'list') {
    // Google Docs writes a nested list as a sibling of its parent item.
    const parent = frame.element.lastElementChild ?? frame.element.appendChild(ctx.doc.createElement('li'));
    list(ctx, element, tag, frameFor('item', parent as HTMLElement, frame), state);
    return;
  }
  if (frame.kind !== 'flow' && frame.kind !== 'item') return;
  const created = ctx.doc.createElement(type);
  frame.element.appendChild(created);
  frame.paragraph = null;
  walkChildren(ctx, element, frameFor('list', created, frame), state);
}

function listItem(ctx: Context, element: HTMLElement, frame: Frame, state: State): void {
  if (frame.kind !== 'list') {
    container(ctx, element, frame, state);
    return;
  }
  const item = ctx.doc.createElement('li');
  frame.element.appendChild(item);
  walkChildren(ctx, element, frameFor('item', item, frame), state);
}

function table(ctx: Context, element: HTMLElement, frame: Frame, state: State): void {
  // The editor has no nested tables, an inner table is flattened into its cell.
  if (!ctx.schema.tables || frame.kind !== 'flow' || frame.inTable) {
    walkChildren(ctx, element, frame, state);
    return;
  }
  // The editor has no table captions, the caption becomes a paragraph above the table.
  const caption = Array.from(element.children).find((child) => child.localName === 'caption');
  if (caption instanceof HTMLElement) container(ctx, caption, frame, state);
  const created = ctx.doc.createElement('table');
  frame.element.appendChild(created);
  frame.paragraph = null;
  walkChildren(ctx, element, { ...frameFor('table', created, frame), inTable: true }, state);
}

function row(ctx: Context, element: HTMLElement, frame: Frame, state: State): void {
  if (frame.kind !== 'table') {
    walkChildren(ctx, element, frame, state);
    return;
  }
  // Word adds an invisible row of zero height that only carries column widths.
  if (element.getAttribute('height') === '0') return;
  const created = ctx.doc.createElement('tr');
  frame.element.appendChild(created);
  walkChildren(ctx, element, frameFor('row', created, frame), state);
}

function cell(ctx: Context, element: HTMLElement, tag: string, frame: Frame, state: State): void {
  if (frame.kind !== 'row') {
    container(ctx, element, frame, state);
    return;
  }
  const created = ctx.doc.createElement(tag);
  for (const name of ['colspan', 'rowspan']) {
    const span = Number.parseInt(element.getAttribute(name) ?? '', 10);
    if (span > 1) created.setAttribute(name, String(span));
  }
  frame.element.appendChild(created);
  walkChildren(ctx, element, frameFor('flow', created, frame, true), state);
}

function link(ctx: Context, element: HTMLElement, frame: Frame, state: State): void {
  const href = element.getAttribute('href')?.trim() ?? '';
  const unsafe = /^(javascript|vbscript|data):/i.test(href.replace(/[\s\u0000-\u001f]/g, ''));
  if (!ctx.schema.links || href === '' || unsafe) {
    walkChildren(ctx, element, frame, state);
    return;
  }
  const target = inlineTarget(ctx, frame, state);
  if (!target) return;
  const created = ctx.doc.createElement('a');
  created.setAttribute('href', href);
  for (const name of ['target', 'title', 'rel']) {
    const value = element.getAttribute(name)?.trim();
    if (value) created.setAttribute(name, value);
  }
  target.appendChild(created);
  walkChildren(ctx, element, frameFor('text', created, frame), state);
}

/**
 * The editor's internal link, copied from another Primavista field or a
 * rendered page. The href is a resource id and never carries a scheme, so
 * anything with one is not an internal link.
 */
function internalLink(ctx: Context, element: HTMLElement, frame: Frame, state: State): void {
  const spec = ctx.schema.internalLink;
  const href = element.getAttribute('href')?.trim() ?? '';
  if (!spec || href === '' || /^[a-z][a-z0-9+.-]*:/i.test(href.replace(/[\s\u0000-\u001f]/g, ''))) {
    walkChildren(ctx, element, frame, state);
    return;
  }
  const target = inlineTarget(ctx, frame, state);
  if (!target) return;
  const created = ctx.doc.createElement(spec.tag);
  created.setAttribute('href', href);
  // Lexical only knows the built-in inline elements and trims the spaces
  // around anything else, `$loadHtml` sets the same display for that reason.
  created.style.display = 'inline';
  for (const name of ['provider', 'target', 'title', spec.validationAttribute]) {
    const value = element.getAttribute(name)?.trim();
    if (value) created.setAttribute(name, value);
  }
  target.appendChild(created);
  walkChildren(ctx, element, frameFor('text', created, frame), state);
}

/**
 * Word writes list items as paragraphs with `mso-list: l0 level1 lfo1` and
 * the bullet as text inside a `mso-list: Ignore` span. Consecutive list
 * paragraphs become `ul` or `ol` with nested lists per level. The marker
 * decides the type: a number or letter followed by `.` or `)` is ordered,
 * anything else a bullet. The marker itself is dropped by the walk later.
 */
function convertWordLists(body: HTMLElement): void {
  const done = new Set<Element>();
  for (const paragraph of Array.from(body.getElementsByTagName('p'))) {
    if (done.has(paragraph) || !isWordListParagraph(paragraph)) continue;
    const run: HTMLElement[] = [];
    let current: Node | null = paragraph;
    while (current) {
      if (current instanceof HTMLElement && isWordListParagraph(current)) {
        run.push(current);
        done.add(current);
      } else if (!(current.nodeType === Node.COMMENT_NODE || (current.nodeType === Node.TEXT_NODE && isBlank(current.textContent)))) {
        break;
      }
      current = current.nextSibling;
    }
    buildWordList(body.ownerDocument, run);
  }
}

function buildWordList(doc: Document, paragraphs: HTMLElement[]): void {
  const stack: Array<{ level: number; id: string; list: HTMLElement }> = [];
  for (const paragraph of paragraphs) {
    const info = wordListInfo(paragraph);
    if (!info) continue;
    const tag = isOrderedMarker(wordListMarker(paragraph)) ? 'ol' : 'ul';
    while (stack.length > 0 && stack[stack.length - 1]!.level > info.level) stack.pop();
    let top = stack[stack.length - 1];
    if (top && top.level === info.level && (top.id !== info.id || top.list.localName !== tag)) {
      stack.pop();
      top = stack[stack.length - 1];
    }
    if (!top || top.level < info.level) {
      const created = doc.createElement(tag);
      if (top) {
        const parent = top.list.lastElementChild ?? top.list.appendChild(doc.createElement('li'));
        parent.appendChild(created);
      } else {
        paragraph.before(created);
      }
      top = { level: info.level, id: info.id, list: created };
      stack.push(top);
    }
    const item = doc.createElement('li');
    const lang = paragraph.getAttribute('lang');
    if (lang !== null) item.setAttribute('lang', lang);
    item.replaceChildren(...Array.from(paragraph.childNodes));
    top.list.appendChild(item);
    paragraph.remove();
  }
}

function isWordListParagraph(element: HTMLElement): boolean {
  return element.localName === 'p' && wordListInfo(element) !== null;
}

function wordListInfo(paragraph: HTMLElement): { id: string; level: number } | null {
  const match = WORD_LIST.exec(parseStyle(paragraph)['mso-list'] ?? '');
  if (!match) return null;
  return { id: `${match[1]}:${match[3]}`, level: Number(match[2]) };
}

function wordListMarker(paragraph: HTMLElement): string {
  for (const element of Array.from(paragraph.querySelectorAll<HTMLElement>('*'))) {
    if (parseStyle(element)['mso-list'] === 'ignore') return (element.textContent ?? '').replace(/[\s ]+/g, '');
  }
  return '';
}

function isOrderedMarker(marker: string): boolean {
  return /^\(?[0-9a-z]{1,4}[.)]$/i.test(marker) || /^\d+(\.\d+)+\.?$/.test(marker);
}

/** Cleans up after the walk: empty wrappers and blocks, trailing line breaks, split format elements. */
function tidy(output: HTMLElement): void {
  for (const element of Array.from(output.querySelectorAll('strong, em, u, s, sub, sup, code, span, a')).reverse()) {
    if (element.textContent === '' && !element.querySelector('br')) element.remove();
  }
  mergeAdjacent(output);
  output.normalize();
  for (const element of [output, ...Array.from(output.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4, h5, h6, li, td, th'))]) {
    removeTrailingLineBreaks(element);
  }
  for (const element of Array.from(output.querySelectorAll('p, h1, h2, h3, h4, h5, h6'))) {
    if (isBlank(element.textContent)) element.remove();
  }
  for (const element of Array.from(output.querySelectorAll('ul, ol, tr, table')).reverse()) {
    if (element.children.length === 0) element.remove();
  }
  for (const element of Array.from(output.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4, h5, h6, li, td, th'))) {
    trimEdges(element);
  }
}

/**
 * Joins `<strong>a</strong><strong>b</strong>` into one element. Also joins
 * adjacent lists, which Word Online writes as one list per item.
 */
function mergeAdjacent(parent: Element): void {
  let child = parent.firstElementChild;
  while (child) {
    const next = child.nextSibling;
    if (next instanceof Element && isSameWrapper(child, next)) {
      child.append(...Array.from(next.childNodes));
      next.remove();
      continue;
    }
    child = child.nextElementSibling;
  }
  for (const element of Array.from(parent.children)) mergeAdjacent(element);
}

function isSameWrapper(a: Element, b: Element): boolean {
  if (a.localName !== b.localName || !MERGEABLE_TAGS.has(a.localName)) return false;
  return a.getAttribute('lang') === b.getAttribute('lang');
}

function removeTrailingLineBreaks(element: HTMLElement): void {
  let last = element.lastChild;
  while (last && (isBlankText(last) || (last instanceof Element && last.localName === 'br'))) {
    const previous = last.previousSibling;
    if (last instanceof Element) last.remove();
    last = previous;
  }
}

/** Removes spaces at the start and the end of a block, which the source had for indentation. */
function trimEdges(element: HTMLElement): void {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  const first = texts[0];
  const last = texts[texts.length - 1];
  if (first) first.data = first.data.replace(/^ +/, '');
  if (last) last.data = last.data.replace(/ +$/, '');
}

/**
 * Matched by hand: jsdom's selector engine lets `p` match Word's `<o:p>`.
 */
function hasBlockDescendant(element: HTMLElement): boolean {
  return Array.from(element.getElementsByTagName('*')).some((child) => BLOCK_TAGS.has(child.localName.toLowerCase()));
}

/** Whether the next sibling that is not a comment or source whitespace is a block, or there is none. */
function isBlockBoundary(node: Node, direction: 'previousSibling' | 'nextSibling'): boolean {
  let sibling = node[direction];
  while (sibling && (sibling.nodeType === Node.COMMENT_NODE || isBlankText(sibling))) sibling = sibling[direction];
  return sibling === null || (sibling instanceof Element && BLOCK_TAGS.has(sibling.localName.toLowerCase()));
}

function isBlankText(node: Node): boolean {
  return node.nodeType === Node.TEXT_NODE && isBlank(node.textContent);
}

function isBlank(text: string | null): boolean {
  return (text ?? '').replace(/ /g, ' ').trim() === '';
}

/** Reads the style attribute by hand, the browser drops `mso-*` properties. Keys and values are lower case. */
function parseStyle(element: HTMLElement): Record<string, string> {
  const result: Record<string, string> = {};
  for (const declaration of (element.getAttribute('style') ?? '').split(';')) {
    const colon = declaration.indexOf(':');
    if (colon < 0) continue;
    const key = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim().toLowerCase().replace(/\s*!important$/, '');
    if (key) result[key] = value;
  }
  return result;
}

/** `EN-US` becomes `en-US`, `zh-hant-tw` becomes `zh-Hant-TW`. Returns null for values that are no language tag. */
function normalizeLang(value: string | null): string | null {
  if (!value || !/^[a-z]{2,3}(?:[-_][a-z0-9]{2,8})*$/i.test(value.trim())) return null;
  return value
    .trim()
    .split(/[-_]/)
    .map((part, index) => {
      if (index === 0) return part.toLowerCase();
      if (part.length === 2) return part.toUpperCase();
      if (part.length === 4) return part[0]!.toUpperCase() + part.slice(1).toLowerCase();
      return part.toLowerCase();
    })
    .join('-');
}

/** `de` and `de-AT` count as the same language, `en-GB` and `en-US` do not. */
function sameLanguage(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x === y || x.startsWith(`${y}-`) || y.startsWith(`${x}-`);
}
