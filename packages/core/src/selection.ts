import {
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
  type RangeSelection,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import type { SelectionInfo } from './types';

const FORMATS = ['bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', 'code'] as const;

/**
 * Describes the selection in terms of HTML, so a plugin needs no Lexical to
 * ask what is selected. Must run inside `editor.read()` or `editor.update()`.
 * The ancestors are the elements around the anchor as the editor would write
 * them, innermost first.
 */
export function $readSelection(editor: LexicalEditor): SelectionInfo | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;

  const ancestors: Array<{ tag: string; attributes: Record<string, string> }> = [];
  let node: LexicalNode | null = selection.anchor.getNode();
  while (node !== null && !$isRootNode(node)) {
    if ($isElementNode(node)) {
      const element = elementOf(node, editor);
      if (element) {
        ancestors.push({
          tag: element.localName,
          attributes: Object.fromEntries(element.getAttributeNames().map((name) => [name, element.getAttribute(name) ?? ''])),
        });
      }
    }
    node = node.getParent();
  }

  return {
    collapsed: selection.isCollapsed(),
    text: selection.getTextContent(),
    formats: formatsOf(selection),
    block: ancestors.at(-1)?.tag ?? null,
    ancestors,
  };
}

/** A format counts when every selected text has it. A caret has the format it would type with. */
function formatsOf(selection: RangeSelection): SelectionInfo['formats'] {
  const texts = selection.isCollapsed() ? [] : selection.getNodes().filter($isTextNode).filter((node) => node.getTextContentSize() > 0);
  if (texts.length === 0) return FORMATS.filter((format) => selection.hasFormat(format));
  return FORMATS.filter((format) => texts.every((node) => node.hasFormat(format)));
}

function elementOf(node: LexicalNode & { exportDOM(editor: LexicalEditor): { element?: unknown } }, editor: LexicalEditor): Element | null {
  try {
    const { element } = node.exportDOM(editor);
    return element instanceof Element ? element : null;
  } catch {
    return null;
  }
}

export function sameSelection(a: SelectionInfo | null, b: SelectionInfo | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
