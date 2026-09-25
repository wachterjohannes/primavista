import { $insertNodeToNearestRoot, mergeRegister } from '@lexical/utils';
import {
  $createNodeSelection,
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  $nodesOfType,
  $setSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
} from 'lexical';
import { icons } from '../icons';
import { $createHorizontalRuleNode, $isHorizontalRuleNode, HorizontalRuleNode } from '../nodes/HorizontalRuleNode';
import type { PrimavistaPlugin } from '../types';

/** A horizontal rule, `<hr>`. Click selects it, Backspace or Delete removes it. */
export function horizontalRule(): PrimavistaPlugin {
  return {
    name: 'horizontal-rule',
    nodes: [HorizontalRuleNode],
    register: ({ editor }) =>
      mergeRegister(
        editor.registerCommand(
          CLICK_COMMAND,
          (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement) || target.tagName !== 'HR') return false;
            const node = $getNearestNodeFromDOMNode(target);
            if (!$isHorizontalRuleNode(node)) return false;
            const selection = $createNodeSelection();
            selection.add(node.getKey());
            $setSelection(selection);
            return true;
          },
          COMMAND_PRIORITY_LOW,
        ),
        // Mirror the node selection on the element, the theme styles it.
        editor.registerUpdateListener(({ editorState }) => {
          editorState.read(() => {
            const selection = $getSelection();
            const selected = $isNodeSelection(selection) ? new Set(selection.getNodes().map((node) => node.getKey())) : null;
            const className = editor._config.theme.hrSelected;
            if (!className) return;
            for (const node of $nodesOfType(HorizontalRuleNode)) {
              editor.getElementByKey(node.getKey())?.classList.toggle(className, selected?.has(node.getKey()) ?? false);
            }
          });
        }),
      ),
    toolbar: [
      {
        id: 'horizontal-rule',
        label: 'Horizontal rule',
        icon: icons.horizontalRule,
        group: 'insert',
        onClick: (editor) => {
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            $insertNodeToNearestRoot($createHorizontalRuleNode());
          });
        },
      },
    ],
  };
}
