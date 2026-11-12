import type { PrimavistaPlugin } from '@primavista/core';
import { $getSelection, $isRangeSelection } from '@primavista/core/lexical';

/**
 * A toolbar button that inserts a section sign at the cursor. It uses raw
 * Lexical (`$getSelection`, `insertText`), so it is the kind of extension a
 * Lexical update can affect. Read UPGRADE.md of Primavista before a bump.
 */
export const sectionSign: PrimavistaPlugin = {
  name: 'section-sign',
  toolbar: [
    {
      id: 'section-sign',
      label: 'Section sign',
      icon: '<span>§</span>',
      onClick: (editor) => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) selection.insertText('§');
        });
      },
    },
  ],
};
