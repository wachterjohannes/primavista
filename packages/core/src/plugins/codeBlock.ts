import { $createCodeNode, $isCodeNode, CodeNode } from '@lexical/code-core';
import { $setBlocksType } from '@lexical/selection';
import { $findMatchingParent } from '@lexical/utils';
import { $createParagraphNode, $getSelection, $isRangeSelection } from 'lexical';
import { icons } from '../icons';
import type { PrimavistaPlugin } from '../types';

/**
 * Preformatted code blocks, stored as `<pre><code>…</code></pre>` like
 * CKEditor's code block. Plain text without highlighting: Lexical's
 * highlighter needs Prism, and the stored HTML carries no language anyway.
 * Enter adds a line, Enter on two empty lines leaves the block.
 */
export function codeBlock(): PrimavistaPlugin {
  return {
    name: 'code-block',
    nodes: [CodeNode],
    toolbar: [
      {
        id: 'code-block',
        label: 'Code block',
        icon: icons.codeBlock,
        group: 'block',
        isActive: () => $getSelectedCode() !== null,
        onClick: (editor) => {
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            if ($getSelectedCode()) {
              $setBlocksType(selection, () => $createParagraphNode());
            } else {
              $setBlocksType(selection, () => $createCodeNode());
            }
          });
        },
      },
    ],
  };
}

function $getSelectedCode(): CodeNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const code = $findMatchingParent(selection.anchor.getNode(), $isCodeNode);
  return $isCodeNode(code) ? code : null;
}
