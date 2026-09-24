import { createEmptyHistoryState, registerHistory } from '@lexical/history';
import { CAN_REDO_COMMAND, CAN_UNDO_COMMAND, COMMAND_PRIORITY_LOW, REDO_COMMAND, UNDO_COMMAND } from 'lexical';
import { mergeRegister } from '@lexical/utils';
import { icons } from '../icons';
import type { PrimavistaPlugin } from '../types';

export interface HistoryOptions {
  /** Milliseconds within which consecutive edits merge into one undo step. */
  delay?: number;
}

export function history(options: HistoryOptions = {}): PrimavistaPlugin {
  let canUndo = false;
  let canRedo = false;
  return {
    name: 'history',
    register({ editor, toolbar }) {
      return mergeRegister(
        registerHistory(editor, createEmptyHistoryState(), options.delay ?? 300),
        editor.registerCommand(
          CAN_UNDO_COMMAND,
          (payload) => {
            canUndo = payload;
            toolbar.refresh();
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          CAN_REDO_COMMAND,
          (payload) => {
            canRedo = payload;
            toolbar.refresh();
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
      );
    },
    toolbar: [
      {
        id: 'undo',
        label: 'Undo',
        shortcut: 'Ctrl+Z',
        icon: icons.undo,
        group: 'history',
        isDisabled: () => !canUndo,
        onClick: (editor) => editor.dispatchCommand(UNDO_COMMAND, undefined),
      },
      {
        id: 'redo',
        label: 'Redo',
        shortcut: 'Ctrl+Shift+Z',
        icon: icons.redo,
        group: 'history',
        isDisabled: () => !canRedo,
        onClick: (editor) => editor.dispatchCommand(REDO_COMMAND, undefined),
      },
    ],
  };
}
