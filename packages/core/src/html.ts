import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import {
  $createParagraphNode,
  $getRoot,
  $isElementNode,
  $isParagraphNode,
  type DOMExportOutput,
  type DOMExportOutputMap,
  type LexicalEditor,
  type LexicalNode,
  TextNode,
} from 'lexical';
import { $isTableCellNode, $isTableNode, $isTableRowNode, TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { InternalLinkNode } from './nodes/InternalLinkNode';
import type { HtmlOptions } from './types';

/** Update tag used by `setHtml`, so listeners can tell programmatic loads from user edits. */
export const SET_HTML_TAG = 'primavista:set-html';

/**
 * Lexical's default export wraps every text node in a `<span style="white-space: pre-wrap">`
 * and puts inline styles on table cells. A CMS wants plain semantic HTML, so the
 * export of those nodes is replaced here.
 */
export function createExportMap(options: Required<HtmlOptions>): DOMExportOutputMap {
  const map: DOMExportOutputMap = new Map();
  map.set(TextNode, (_editor, node) => exportTextNode(node as TextNode));
  map.set(TableNode, (_editor, node) => exportTableNode(node, options));
  map.set(TableRowNode, (_editor, node) => exportTableRowNode(node));
  map.set(TableCellNode, (_editor, node) => exportTableCellNode(node));
  return map;
}

/** Text format to element, innermost first. The paste cleanup nests in the same order. */
export const FORMAT_TAGS:ReadonlyArray<readonly [format: Parameters<TextNode['hasFormat']>[0], tag: string]> = [
  ['code', 'code'],
  ['subscript', 'sub'],
  ['superscript', 'sup'],
  ['strikethrough', 's'],
  ['underline', 'u'],
  ['italic', 'em'],
  ['bold', 'strong'],
];

function exportTextNode(node: TextNode): DOMExportOutput {
  let element: HTMLElement | Text = document.createTextNode(node.getTextContent());
  for (const [format, tag] of FORMAT_TAGS) {
    if (node.hasFormat(format)) {
      const wrapper = document.createElement(tag);
      wrapper.appendChild(element);
      element = wrapper;
    }
  }
  return { element };
}

function exportTableNode(node: LexicalNode, options: Required<HtmlOptions>): DOMExportOutput {
  if (!$isTableNode(node)) return { element: null };
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  return {
    element: table,
    // Lexical hands over one fragment with every row already built.
    append: (rows) => {
      let inHead = options.tableHeadSection;
      let thead: HTMLTableSectionElement | null = null;
      const rowElements: Element[] = rows instanceof DocumentFragment ? Array.from(rows.children) : rows instanceof HTMLElement ? [rows] : [];
      for (const row of rowElements) {
        const isHeaderRow = row.children.length > 0 && Array.from(row.children).every((cell) => cell.tagName === 'TH');
        if (inHead && isHeaderRow) {
          if (!thead) {
            thead = document.createElement('thead');
            table.insertBefore(thead, tbody);
          }
          thead.appendChild(row);
          continue;
        }
        inHead = false;
        tbody.appendChild(row);
      }
      if (tbody.children.length === 0) tbody.remove();
    },
    // The table is already in its parent here, so the wrapper takes a copy
    // and Lexical swaps the original for it.
    after: (generated) => {
      if (options.tableWrapper !== 'figure' || !(generated instanceof HTMLElement)) return generated;
      const figure = document.createElement('figure');
      figure.className = 'table';
      figure.appendChild(generated.cloneNode(true));
      return figure;
    },
  };
}

function exportTableRowNode(node: LexicalNode): DOMExportOutput {
  if (!$isTableRowNode(node)) return { element: null };
  return { element: document.createElement('tr') };
}

function exportTableCellNode(node: LexicalNode): DOMExportOutput {
  if (!$isTableCellNode(node)) return { element: null };
  const cell = document.createElement(node.hasHeader() ? 'th' : 'td');
  if (node.getColSpan() > 1) cell.setAttribute('colspan', String(node.getColSpan()));
  if (node.getRowSpan() > 1) cell.setAttribute('rowspan', String(node.getRowSpan()));
  return {
    element: cell,
    // Lexical keeps a paragraph inside every cell. A cell with a single
    // unformatted paragraph is exported as plain cell content, the way
    // CKEditor does it. The paragraph's alignment moves onto the cell.
    after: (generated) => {
      if (!(generated instanceof HTMLElement)) return generated;
      const only = generated.children.length === 1 ? generated.children[0] : null;
      if (only instanceof HTMLElement && only.tagName === 'P' && only.childNodes.length === generated.childNodes.length) {
        if (only.style.textAlign) generated.style.textAlign = only.style.textAlign;
        if (only.innerHTML === '<br>') {
          generated.replaceChildren();
        } else {
          generated.replaceChildren(...Array.from(only.childNodes));
        }
      }
      return generated;
    },
  };
}

export interface SerializeOptions {
  /** Class names that belong to the editor theme and must not leak into the output. */
  themeClassNames: ReadonlySet<string>;
  html: Required<HtmlOptions>;
}

/** Must run inside `editor.read()` or `editor.update()`. */
export function $serializeToHtml(editor: LexicalEditor, options: SerializeOptions): string {
  if ($isDocumentEmpty()) return '';
  const container = document.createElement('div');
  container.innerHTML = $generateHtmlFromNodes(editor);
  cleanExportedDom(container, options.themeClassNames, options.html);
  return container.innerHTML;
}

function cleanExportedDom(container: HTMLElement, themeClassNames: ReadonlySet<string>, html: Required<HtmlOptions>): void {
  for (const element of Array.from(container.querySelectorAll('*'))) {
    if (html.emptyParagraph === 'nbsp' && element.tagName === 'P' && element.innerHTML === '<br>') {
      element.innerHTML = '&nbsp;';
    }
    if (element.getAttribute('dir') === 'ltr') element.removeAttribute('dir');
    if (element.tagName === 'LI') element.removeAttribute('value');
    if (element.hasAttribute('class')) {
      for (const name of Array.from(element.classList)) {
        if (themeClassNames.has(name)) element.classList.remove(name);
      }
      if (element.classList.length === 0) element.removeAttribute('class');
    }
    if (element.getAttribute('style') === '') element.removeAttribute('style');
  }
}

/** Must run inside `editor.update()`. Replaces the whole document. */
export function $loadHtml(editor: LexicalEditor, html: string): void {
  const root = $getRoot();
  root.clear();
  const trimmed = html.trim();
  if (trimmed !== '') {
    const dom = new DOMParser().parseFromString(trimmed, 'text/html');
    normalizeLegacyTags(dom);
    markCustomInlineElements(dom);
    liftCellAlignment(dom);
    const nodes = $generateNodesFromDOM(editor, dom);
    root.append(...wrapInlineNodesInParagraphs(nodes));
  }
  if (root.getChildrenSize() === 0) {
    root.append($createParagraphNode());
  }
}

const LEGACY_TAGS: Record<string, string> = { strike: 's' };

/** Lexical imports `<s>` but not `<strike>`; older content still contains such tags. */
function normalizeLegacyTags(dom: Document): void {
  for (const [legacy, modern] of Object.entries(LEGACY_TAGS)) {
    for (const element of Array.from(dom.body.querySelectorAll(legacy))) {
      const replacement = dom.createElement(modern);
      replacement.replaceChildren(...Array.from(element.childNodes));
      element.replaceWith(replacement);
    }
  }
}

/**
 * The importer treats unknown elements as blocks and drops the whitespace
 * around them. Custom link elements are inline, so they get an inline display
 * hint that the importer reads first.
 */
function markCustomInlineElements(dom: Document): void {
  for (const element of Array.from(dom.body.querySelectorAll<HTMLElement>(InternalLinkNode.tagName))) {
    element.style.display = 'inline';
  }
}

/**
 * Lexical ignores `text-align` on table cells. Cells with inline content get
 * a paragraph that carries the alignment, which the exporter folds back.
 */
function liftCellAlignment(dom: Document): void {
  for (const cell of Array.from(dom.body.querySelectorAll<HTMLElement>('td, th'))) {
    const align = cell.style.textAlign;
    if (!align) continue;
    const hasBlock = Array.from(cell.children).some((child) => /^(P|H[1-6]|UL|OL|TABLE|DIV|BLOCKQUOTE)$/.test(child.tagName));
    if (hasBlock) continue;
    const paragraph = dom.createElement('p');
    paragraph.style.textAlign = align;
    paragraph.replaceChildren(...Array.from(cell.childNodes));
    cell.replaceChildren(paragraph);
    cell.style.removeProperty('text-align');
  }
}

/**
 * `$generateNodesFromDOM` returns top-level text nodes for markup such as
 * `Hello <b>world</b>`. The root only accepts blocks, so runs of inline nodes
 * are wrapped in a paragraph.
 */
function wrapInlineNodesInParagraphs(nodes: LexicalNode[]): LexicalNode[] {
  const result: LexicalNode[] = [];
  let paragraph: ReturnType<typeof $createParagraphNode> | null = null;
  for (const node of nodes) {
    const isBlock = $isElementNode(node) && !node.isInline();
    if (isBlock) {
      paragraph = null;
      result.push(node);
      continue;
    }
    if (!paragraph) {
      paragraph = $createParagraphNode();
      result.push(paragraph);
    }
    paragraph.append(node);
  }
  return result;
}

/** Must run inside `editor.read()` or `editor.update()`. */
export function $isDocumentEmpty(): boolean {
  const root = $getRoot();
  const children = root.getChildren();
  if (children.length === 0) return true;
  if (children.length > 1) return false;
  const first = children[0];
  return $isParagraphNode(first) && first.getChildrenSize() === 0;
}

export { SET_HTML_TAG as PRIMAVISTA_SET_HTML_TAG };
