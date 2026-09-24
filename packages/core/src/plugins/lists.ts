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
import type { PrimavistaPlugin, ToolbarButton } from '../types';

export type ListTag = 'ul' | 'ol';

export interface ListsOptions {
  /** Which list types the toolbar offers. Both by default. */
  types?: ReadonlyArray<ListTag>;
}

/** Bullet and numbered lists. Nesting works with Tab and Shift+Tab. */
export function lists(options: ListsOptions = {}): PrimavistaPlugin {
  const types = options.types ?? ['ul', 'ol'];
  const buttons: Record<ListTag, ToolbarButton> = {
    ul: {
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
    ol: {
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
  };
  return {
    name: 'lists',
    nodes: [ListNode, ListItemNode],
    register: ({ editor }) => registerList(editor),
    toolbar: types.map((type) => buttons[type]),
  };
}

function $getSelectedListType(): ListType | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const anchor = selection.anchor.getNode();
  const list = $getNearestNodeOfType(anchor, ListNode);
  return $isListNode(list) ? list.getListType() : null;
}
