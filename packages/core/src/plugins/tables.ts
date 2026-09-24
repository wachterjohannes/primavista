import {
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $findTableNode,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  $isTableCellNode,
  $isTableSelection,
  $mergeCells,
  $unmergeCell,
  INSERT_TABLE_COMMAND,
  registerTablePlugin,
  registerTableSelectionObserver,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import { mergeRegister } from '@lexical/utils';
import { $getSelection, $isRangeSelection } from 'lexical';
import { $findMatchingParent } from '@lexical/utils';
import { icons } from '../icons';
import type { PrimavistaPlugin } from '../types';

export interface TablesOptions {
  rows?: number;
  columns?: number;
  /** First row becomes header cells (`<th>`). */
  headerRow?: boolean;
}

/** Tables with a header row, plus row and column operations while the caret is inside a table. */
export function tables(options: TablesOptions = {}): PrimavistaPlugin {
  const rows = options.rows ?? 3;
  const columns = options.columns ?? 3;
  const headerRow = options.headerRow ?? true;
  const insideTable = (): boolean => $isInsideTable();
  const outsideTable = (): boolean => !$isInsideTable();

  return {
    name: 'tables',
    nodes: [TableNode, TableRowNode, TableCellNode],
    register: ({ editor }) =>
      mergeRegister(
        registerTablePlugin(editor),
        registerTableSelectionObserver(editor),
      ),
    toolbar: [
      {
        id: 'insert-table',
        label: 'Insert table',
        icon: icons.table,
        group: 'tables',
        isDisabled: () => !$isRangeSelection($getSelection()) || $isInsideTable(),
        onClick: (editor) =>
          editor.dispatchCommand(INSERT_TABLE_COMMAND, {
            rows: String(rows),
            columns: String(columns),
            includeHeaders: headerRow ? { rows: true, columns: false } : false,
          }),
      },
      {
        id: 'table-row-after',
        label: 'Insert row below',
        icon: icons.rowAfter,
        group: 'tables',
        isHidden: outsideTable,
        onClick: (editor) =>
          editor.update(() => {
            $insertTableRowAtSelection(true);
          }),
      },
      {
        id: 'table-column-after',
        label: 'Insert column right',
        icon: icons.columnAfter,
        group: 'tables',
        isHidden: outsideTable,
        onClick: (editor) =>
          editor.update(() => {
            $insertTableColumnAtSelection(true);
          }),
      },
      {
        id: 'table-row-delete',
        label: 'Delete row',
        icon: icons.rowDelete,
        group: 'tables',
        isHidden: outsideTable,
        onClick: (editor) =>
          editor.update(() => {
            $deleteTableRowAtSelection();
          }),
      },
      {
        id: 'table-column-delete',
        label: 'Delete column',
        icon: icons.columnDelete,
        group: 'tables',
        isHidden: outsideTable,
        onClick: (editor) =>
          editor.update(() => {
            $deleteTableColumnAtSelection();
          }),
      },
      {
        id: 'table-merge-cells',
        label: 'Merge cells',
        icon: icons.mergeCells,
        group: 'tables',
        isHidden: outsideTable,
        isDisabled: () => $getSelectedCells().length < 2,
        onClick: (editor) =>
          editor.update(() => {
            const merged = $mergeCells($getSelectedCells());
            merged?.selectEnd();
          }),
      },
      {
        id: 'table-split-cell',
        label: 'Split cell',
        icon: icons.splitCell,
        group: 'tables',
        isHidden: outsideTable,
        isDisabled: () => {
          const cell = $getSelectedCell();
          return !cell || (cell.getColSpan() <= 1 && cell.getRowSpan() <= 1);
        },
        onClick: (editor) =>
          editor.update(() => {
            $unmergeCell();
          }),
      },
      {
        id: 'table-delete',
        label: 'Delete table',
        icon: icons.trash,
        group: 'tables',
        isHidden: outsideTable,
        isDisabled: () => !insideTable(),
        onClick: (editor) =>
          editor.update(() => {
            const table = $getSelectedTable();
            if (!table) return;
            const next = table.getNextSibling() ?? table.getPreviousSibling();
            table.remove();
            if (next && 'selectEnd' in next && typeof next.selectEnd === 'function') {
              next.selectEnd();
            }
          }),
      },
    ],
  };
}

function $getSelectedTable(): TableNode | null {
  const selection = $getSelection();
  if ($isTableSelection(selection)) {
    return selection.tableKey ? ($findTableNode(selection.anchor.getNode()) ?? null) : null;
  }
  if (!$isRangeSelection(selection)) return null;
  return $findTableNode(selection.anchor.getNode());
}

function $isInsideTable(): boolean {
  return $getSelectedTable() !== null;
}

/** Cells covered by a table selection (shift-click or drag across cells). */
function $getSelectedCells(): TableCellNode[] {
  const selection = $getSelection();
  if (!$isTableSelection(selection)) return [];
  return selection.getNodes().filter($isTableCellNode);
}

function $getSelectedCell(): TableCellNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) && !$isTableSelection(selection)) return null;
  return $findMatchingParent(selection.anchor.getNode(), $isTableCellNode);
}
