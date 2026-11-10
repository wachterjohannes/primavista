import { mergeRegister } from '@lexical/utils';
import {
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  type LexicalNode,
  type RangeSelection,
} from 'lexical';
import {
  createInlineElementNode,
  type InlineElementNode,
} from '../nodes/inlineElementNode';
import type { PrimavistaPlugin } from '../types';

export interface InlineElementOptions {
  /** Unique name of the plugin, also the toolbar item id and the Lexical node type suffix. */
  name: string;
  /** The element, for example `mark` or `abbr`. */
  tag: string;
  /** Attributes kept when HTML is loaded or pasted and written back, for example `['title']`. */
  attributes?: ReadonlyArray<string>;
  /** Class written on every element. Paste cleanup does not need it, the element is matched by tag. */
  className?: string;
  /** The toolbar button that wraps or unwraps the selection. `false` registers the element without a button. */
  toolbar?: { label: string; icon?: string; group?: string } | false;
}

/**
 * An inline element such as `<mark>`, `<abbr title>` or `<span class>` with a
 * toolbar button that wraps the selected text or removes the wrapper. The
 * Lexical node, import, export, paste handling and the schema entry for
 * sanitizers come with it, an extension needs no Lexical code for this.
 */
export function inlineElement(options: InlineElementOptions): PrimavistaPlugin {
  const attributes = options.attributes ?? [];
  const { Node, $create, $is } = createInlineElementNode({
    name: options.name,
    tag: options.tag,
    attributes,
    fixed: options.className ? { class: options.className } : {},
  });

  const $ownerOf = (node: LexicalNode): InlineElementNode | null => {
    let current: LexicalNode | null = node;
    while (current !== null) {
      if ($is(current)) return current;
      const parent: LexicalNode | null = current.getParent();
      if (parent === null || ($isElementNode(parent) && !parent.isInline())) return null;
      current = parent;
    }
    return null;
  };

  const sameAttributes = (a: InlineElementNode, b: InlineElementNode): boolean =>
    JSON.stringify(a.getAttributes()) === JSON.stringify(b.getAttributes());

  const $mergeWithPrevious = (node: InlineElementNode): void => {
    const previous = node.getPreviousSibling();
    if (!$is(previous) || !sameAttributes(previous, node)) return;
    previous.append(...node.getChildren());
    node.remove();
  };

  const $unwrap = (node: InlineElementNode): void => {
    for (const child of node.getChildren()) node.insertBefore(child);
    node.remove();
  };

  /** Cuts the element so that `child` sits alone in it, the siblings move into elements of their own. */
  const $isolate = (node: InlineElementNode, child: LexicalNode): InlineElementNode => {
    const before = child.getPreviousSiblings();
    const after = child.getNextSiblings();
    if (before.length > 0) {
      const head = $create(node.getAttributes());
      node.insertBefore(head);
      head.append(...before);
    }
    if (after.length > 0) {
      const tail = $create(node.getAttributes());
      node.insertAfter(tail);
      tail.append(...after);
    }
    return node;
  };

  const $isActive = (): boolean => {
    const selection = $getSelection();
    return $isRangeSelection(selection) && $ownerOf(selection.anchor.getNode()) !== null;
  };

  const $toggle = (): void => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    if (selection.isCollapsed()) {
      const owner = $ownerOf(selection.anchor.getNode());
      if (owner) $unwrap(owner);
      return;
    }

    const textNodes = selection.extract().filter($isTextNode).filter((node) => node.getTextContent() !== '');
    const unwrapping = textNodes.length > 0 && textNodes.every((node) => $ownerOf(node) !== null);
    const touched: InlineElementNode[] = [];
    for (const textNode of textNodes) {
      const existing = $ownerOf(textNode);
      if (unwrapping && existing) {
        $unwrap($isolate(existing, textNode));
      } else if (!existing) {
        const created = $create();
        textNode.insertBefore(created);
        created.append(textNode);
        touched.push(created);
      }
    }
    for (const node of touched) {
      if (node.isAttached()) $mergeWithPrevious(node);
    }
    $reselect(selection, textNodes);
  };

  const toolbar = options.toolbar;
  const plugin: PrimavistaPlugin = {
    name: options.name,
    nodes: [Node],
    schema: { elements: [{ tag: options.tag, attributes }] },
    register: ({ editor }) =>
      mergeRegister(
        editor.registerNodeTransform(Node, (node) => {
          if (node.getChildrenSize() === 0) {
            node.remove();
            return;
          }
          $mergeWithPrevious(node);
        }),
      ),
  };
  if (toolbar !== false) {
    plugin.toolbar = [
      {
        id: options.name,
        label: toolbar?.label ?? options.name,
        ...(toolbar?.icon ? { icon: toolbar.icon } : {}),
        ...(toolbar?.group ? { group: toolbar.group } : {}),
        isActive: $isActive,
        isDisabled: () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return true;
          return selection.isCollapsed() && !$isActive();
        },
        onClick: (editor) => {
          editor.update($toggle);
          editor.focus();
        },
      },
    ];
  }
  return plugin;
}

function $reselect(selection: RangeSelection, nodes: LexicalNode[]): void {
  const attached = nodes.filter((node) => node.isAttached() && $isTextNode(node));
  const first = attached[0];
  const last = attached[attached.length - 1];
  if (!first || !last || !$isTextNode(first) || !$isTextNode(last)) return;
  selection.anchor.set(first.getKey(), 0, 'text');
  selection.focus.set(last.getKey(), last.getTextContentSize(), 'text');
}
