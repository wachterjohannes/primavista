import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  type ListType,
  REMOVE_LIST_COMMAND,
  registerList,
} from '@lexical/list';
import { $getNearestNodeOfType } from '@lexical/utils';
import { $getSelection, $isRangeSelection } from 'lexical';
import { icons } from '../icons';
import type { PrimavistaPlugin } from '../types';

/** Bullet and numbered lists. Nesting works with Tab and Shift+Tab. */
export function lists(): PrimavistaPlugin {
  return {
    name: 'lists',
    nodes: [ListNode, ListItemNode],
    register: ({ editor }) => registerList(editor),
    toolbar: [
      {
        id: 'bullet-list',
        label: 'Bullet list',
        icon: icons.bulletList,
        group: 'lists',
        isActive: () => $getSelectedListType() === 'bullet',
        onClick: (editor) => {
          const active = editor.read(() => $getSelectedListType() === 'bullet');
          editor.dispatchCommand(active ? REMOVE_LIST_COMMAND : INSERT_UNORDERED_LIST_COMMAND, undefined);
        },
      },
      {
        id: 'numbered-list',
        label: 'Numbered list',
        icon: icons.numberedList,
        group: 'lists',
        isActive: () => $getSelectedListType() === 'number',
        onClick: (editor) => {
          const active = editor.read(() => $getSelectedListType() === 'number');
          editor.dispatchCommand(active ? REMOVE_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND, undefined);
        },
      },
    ],
  };
}

function $getSelectedListType(): ListType | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const anchor = selection.anchor.getNode();
  const list = $getNearestNodeOfType(anchor, ListNode);
  return $isListNode(list) ? list.getListType() : null;
}
