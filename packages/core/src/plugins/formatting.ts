import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, type TextFormatType } from 'lexical';
import { icons } from '../icons';
import type { PrimavistaPlugin, ToolbarButton } from '../types';

export type InlineFormat = Extract<
  TextFormatType,
  'bold' | 'italic' | 'underline' | 'strikethrough' | 'subscript' | 'superscript' | 'code'
>;

export interface FormattingOptions {
  formats?: ReadonlyArray<InlineFormat>;
}

export const DEFAULT_FORMATS: ReadonlyArray<InlineFormat> = ['bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', 'code'];

const LABELS: Record<InlineFormat, { label: string; shortcut?: string; icon: string }> = {
  bold: { label: 'Bold', shortcut: 'Ctrl+B', icon: icons.bold },
  italic: { label: 'Italic', shortcut: 'Ctrl+I', icon: icons.italic },
  underline: { label: 'Underline', shortcut: 'Ctrl+U', icon: icons.underline },
  strikethrough: { label: 'Strikethrough', icon: icons.strikethrough },
  subscript: { label: 'Subscript', icon: icons.subscript },
  superscript: { label: 'Superscript', icon: icons.superscript },
  code: { label: 'Inline code', icon: icons.code },
};

/** Inline text formats. Keyboard shortcuts come with Lexical's rich text setup. */
export function formatting(options: FormattingOptions = {}): PrimavistaPlugin {
  const formats = options.formats ?? DEFAULT_FORMATS;
  return {
    name: 'formatting',
    toolbar: formats.map((format): ToolbarButton => {
      const meta = LABELS[format];
      return {
        id: format,
        label: meta.label,
        icon: meta.icon,
        group: 'formatting',
        ...(meta.shortcut ? { shortcut: meta.shortcut } : {}),
        isActive: () => {
          const selection = $getSelection();
          return $isRangeSelection(selection) && selection.hasFormat(format);
        },
        onClick: (editor) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format),
      };
    }),
  };
}
