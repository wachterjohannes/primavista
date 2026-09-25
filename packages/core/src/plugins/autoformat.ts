import { ListItemNode, ListNode } from '@lexical/list';
import {
  BOLD_ITALIC_STAR,
  BOLD_STAR,
  type ElementTransformer,
  HEADING,
  INLINE_CODE,
  ITALIC_STAR,
  ORDERED_LIST,
  registerMarkdownShortcuts,
  STRIKETHROUGH,
  type TextFormatTransformer,
  type Transformer,
  UNORDERED_LIST,
} from '@lexical/markdown';
import { HeadingNode, type HeadingTagType } from '@lexical/rich-text';
import type { LexicalEditor } from 'lexical';
import type { PluginAllows, PrimavistaPlugin } from '../types';
import type { InlineFormat } from './formatting';

export interface AutoformatOptions {
  /** `# ` to `###### ` for headings, `- ` or `* ` and `1. ` for lists. Defaults to true. */
  blocks?: boolean;
  /** `**bold**`, `*italic*`, `***both***`, `~~strikethrough~~` and `` `code` ``. Defaults to true. */
  inline?: boolean;
}

/** Lexical's order: longer tags first, so `**` wins over `*`. */
const INLINE: ReadonlyArray<{ transformer: TextFormatTransformer; needs: ReadonlyArray<InlineFormat> }> = [
  { transformer: INLINE_CODE, needs: ['code'] },
  { transformer: BOLD_ITALIC_STAR, needs: ['bold', 'italic'] },
  { transformer: BOLD_STAR, needs: ['bold'] },
  { transformer: ITALIC_STAR, needs: ['italic'] },
  { transformer: STRIKETHROUGH, needs: ['strikethrough'] },
];

/**
 * Markdown-style shortcuts while typing: `## ` at the start of a paragraph
 * makes a heading, `- ` a bullet list, `**bold**` bold text. Only what the
 * other plugins declare in `allows` is converted, so the shortcuts follow
 * `headings`, `lists` and `formatting` and their options. It changes the
 * document the way a toolbar button would and never touches HTML import or
 * export.
 */
export function autoformat(options: AutoformatOptions = {}): PrimavistaPlugin {
  return {
    name: 'autoformat',
    register: ({ editor, allowed }) => {
      const transformers = autoformatTransformers(editor, allowed, options);
      return transformers.length > 0 ? registerMarkdownShortcuts(editor, transformers) : undefined;
    },
  };
}

function autoformatTransformers(editor: LexicalEditor, allowed: PluginAllows, options: AutoformatOptions): Transformer[] {
  const transformers: Transformer[] = [];
  if (options.blocks ?? true) {
    if (editor.hasNodes([HeadingNode]) && allowed.headings?.length) {
      transformers.push(restrictHeadings(allowed.headings));
    }
    if (editor.hasNodes([ListNode, ListItemNode])) {
      const types = allowed.lists ?? [];
      if (types.includes('ul')) transformers.push(UNORDERED_LIST);
      if (types.includes('ol')) transformers.push(FIRST_ORDERED_LIST);
    }
  }
  if (options.inline ?? true) {
    const formats = allowed.formats ?? [];
    for (const { transformer, needs } of INLINE) {
      if (needs.every((format) => formats.includes(format))) transformers.push(transformer);
    }
  }
  return transformers;
}

/**
 * Lexical's numbered list shortcut, limited to `1. `. Lexical would keep the
 * typed number as the list start, but the toolbar offers no `<ol start>`, and
 * a date like `3. Oktober` at the start of a paragraph is not a list.
 */
const FIRST_ORDERED_LIST: ElementTransformer = {
  ...ORDERED_LIST,
  replace: (parentNode, children, match, isImport) => {
    if (match[2] !== '1') return false;
    return ORDERED_LIST.replace(parentNode, children, match, isImport);
  },
};

/** Lexical's heading shortcut, limited to the levels the headings plugin offers. `#### ` stays text otherwise. */
function restrictHeadings(levels: ReadonlyArray<HeadingTagType>): ElementTransformer {
  return {
    ...HEADING,
    replace: (parentNode, children, match, isImport) => {
      const tag = `h${match[1]?.length ?? 0}` as HeadingTagType;
      if (!levels.includes(tag)) return false;
      return HEADING.replace(parentNode, children, match, isImport);
    },
  };
}
