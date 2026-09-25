import { $createQuoteNode, $isQuoteNode, QuoteNode } from '@lexical/rich-text';
import { $findMatchingParent } from '@lexical/utils';
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  type ElementNode,
  INSERT_PARAGRAPH_COMMAND,
  type LexicalNode,
} from 'lexical';
import { icons } from '../icons';
import type { PrimavistaPlugin } from '../types';

/**
 * Block quotes the way CKEditor writes them: `<blockquote>` around whole
 * blocks, `<blockquote><p>…</p></blockquote>`. Lexical's `QuoteNode` holds
 * inline content by default, a node transform wraps that in a paragraph, so
 * Enter adds a paragraph inside the quote and Enter on an empty last
 * paragraph leaves it. The toolbar button wraps the selected blocks or
 * unwraps the quote the selection sits in.
 */
export function blockquote(): PrimavistaPlugin {
  return {
    name: 'blockquote',
    nodes: [QuoteNode],
    register: ({ editor }) => {
      const unregisterTransform = editor.registerNodeTransform(QuoteNode, (quote) => {
        const children = quote.getChildren();
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
      });
      const unregisterEnter = editor.registerCommand(
        INSERT_PARAGRAPH_COMMAND,
        () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
          const paragraph = selection.anchor.getNode().getTopLevelElement() ?? selection.anchor.getNode();
          const block = $isParagraphNode(paragraph) ? paragraph : $findMatchingParent(selection.anchor.getNode(), $isParagraphNode);
          if (!$isParagraphNode(block) || !block.isEmpty()) return false;
          const quote = block.getParent();
          if (!$isQuoteNode(quote) || quote.getLastChild() !== block) return false;
          quote.insertAfter(block);
          if (quote.isEmpty()) quote.remove();
          block.selectStart();
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      );
      return () => {
        unregisterTransform();
        unregisterEnter();
      };
    },
    toolbar: [
      {
        id: 'blockquote',
        label: 'Block quote',
        icon: icons.quote,
        group: 'block',
        isActive: () => $getSelectedQuote() !== null,
        onClick: (editor) => {
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            const quote = $getSelectedQuote();
            if (quote) {
              for (const child of quote.getChildren()) quote.insertBefore(child);
              quote.remove();
              return;
            }
            const blocks: LexicalNode[] = [];
            for (const node of selection.getNodes()) {
              const top = node.getTopLevelElement();
              if (top && !$isQuoteNode(top) && !blocks.includes(top)) blocks.push(top);
            }
            const first = blocks[0];
            if (!first) return;
            const created = $createQuoteNode();
            first.insertBefore(created);
            for (const block of blocks) created.append(block);
          });
        },
      },
    ],
  };
}

function isBlock(node: LexicalNode): boolean {
  return $isElementNode(node) && !node.isInline();
}

function $getSelectedQuote(): QuoteNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const quote = $findMatchingParent(selection.anchor.getNode(), $isQuoteNode);
  return $isQuoteNode(quote) ? quote : null;
}
