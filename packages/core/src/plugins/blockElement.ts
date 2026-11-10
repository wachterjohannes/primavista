import { $findMatchingParent, mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  INSERT_PARAGRAPH_COMMAND,
  type ElementNode,
  type LexicalNode,
} from 'lexical';
import { createBlockElementNode, type BlockElementNode } from '../nodes/blockElementNode';
import type { PrimavistaPlugin } from '../types';

export interface BlockElementOptions {
  /** Unique name of the plugin, also the toolbar item id and the Lexical node type suffix. */
  name: string;
  /** The element, for example `aside`. */
  tag: string;
  /** Attributes kept when HTML is loaded or pasted and written back. */
  attributes?: ReadonlyArray<string>;
  /** Class written on every element. */
  className?: string;
  /** The toolbar button that wraps the selected blocks or unwraps them. `false` registers the element without a button. */
  toolbar?: { label: string; icon?: string; group?: string } | false;
}

/**
 * An element around whole blocks, for example `<aside><p>…</p></aside>`, with
 * a toolbar button that wraps the selected blocks or unwraps them. Behaves
 * like `blockquote()`: loose inline content inside becomes a paragraph, Enter
 * on an empty last paragraph leaves the element. The extension needs no
 * Lexical code.
 */
export function blockElement(options: BlockElementOptions): PrimavistaPlugin {
  const attributes = options.attributes ?? [];
  const { Node, $create, $is } = createBlockElementNode({
    name: options.name,
    tag: options.tag,
    attributes,
    fixed: options.className ? { class: options.className } : {},
  });

  const isBlock = (node: LexicalNode): boolean => $isElementNode(node) && !node.isInline();

  const $selected = (): BlockElementNode | null => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return null;
    const match = $findMatchingParent(selection.anchor.getNode(), $is);
    return $is(match) ? match : null;
  };

  const toolbar = options.toolbar;
  const plugin: PrimavistaPlugin = {
    name: options.name,
    nodes: [Node],
    schema: { elements: [{ tag: options.tag, attributes, kind: 'block' }] },
    register: ({ editor }) =>
      mergeRegister(
        editor.registerNodeTransform(Node, (node) => {
          const children = node.getChildren();
          if (children.every(isBlock)) return;
          let paragraph: ElementNode | null = null;
          for (const child of children) {
            if (isBlock(child)) {
              paragraph = null;
              continue;
            }
            if (!paragraph) {
              paragraph = $createParagraphNode();
              child.insertBefore(paragraph);
            }
            paragraph.append(child);
          }
        }),
        editor.registerCommand(
          INSERT_PARAGRAPH_COMMAND,
          () => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
            const anchor = selection.anchor.getNode();
            const block = $isParagraphNode(anchor) ? anchor : $findMatchingParent(anchor, $isParagraphNode);
            if (!$isParagraphNode(block) || !block.isEmpty()) return false;
            const wrapper = block.getParent();
            if (!$is(wrapper) || wrapper.getLastChild() !== block) return false;
            wrapper.insertAfter(block);
            if (wrapper.isEmpty()) wrapper.remove();
            block.selectStart();
            return true;
          },
          COMMAND_PRIORITY_HIGH,
        ),
      ),
  };
  if (toolbar !== false) {
    plugin.toolbar = [
      {
        id: options.name,
        label: toolbar?.label ?? options.name,
        ...(toolbar?.icon ? { icon: toolbar.icon } : {}),
        group: toolbar?.group ?? 'block',
        isActive: () => $selected() !== null,
        onClick: (editor) => {
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            const existing = $selected();
            if (existing) {
              for (const child of existing.getChildren()) existing.insertBefore(child);
              existing.remove();
              return;
            }
            const blocks: LexicalNode[] = [];
            for (const node of selection.getNodes()) {
              const top = node.getTopLevelElement();
              if (top && !$is(top) && !blocks.includes(top)) blocks.push(top);
            }
            const first = blocks[0];
            if (!first) return;
            const created = $create();
            first.insertBefore(created);
            for (const block of blocks) created.append(block);
          });
          editor.focus();
        },
      },
    ];
  }
  return plugin;
}
