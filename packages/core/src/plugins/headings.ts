import { $createHeadingNode, $isHeadingNode, HeadingNode, type HeadingTagType } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { $findMatchingParent } from '@lexical/utils';
import { $createParagraphNode, $getSelection, $isElementNode, $isRangeSelection, $isRootOrShadowRoot } from 'lexical';
import type { PrimavistaPlugin } from '../types';

export interface HeadingsOptions {
  levels?: ReadonlyArray<HeadingTagType>;
  /**
   * Turn headings outside `levels` into paragraphs when content loads or is
   * pasted, the way CKEditor treats headings missing from its config.
   * Defaults to true.
   */
  demoteUnlisted?: boolean;
}

const DEFAULT_LEVELS: ReadonlyArray<HeadingTagType> = ['h1', 'h2', 'h3', 'h4'];

/** Block type select: paragraph and headings. */
export function headings(options: HeadingsOptions = {}): PrimavistaPlugin {
  const levels = options.levels ?? DEFAULT_LEVELS;
  const demote = options.demoteUnlisted ?? true;
  return {
    name: 'headings',
    nodes: [HeadingNode],
    allows: { headings: levels },
    register: ({ editor }) =>
      demote
        ? editor.registerNodeTransform(HeadingNode, (node) => {
            if (levels.includes(node.getTag())) return;
            const paragraph = $createParagraphNode();
            paragraph.setFormat(node.getFormatType());
            paragraph.setIndent(node.getIndent());
            node.replace(paragraph, true);
          })
        : undefined,
    toolbar: [
      {
        type: 'select',
        id: 'block-type',
        label: 'Block type',
        group: 'block',
        options: [
          { value: 'paragraph', label: 'Paragraph' },
          ...levels.map((level) => ({ value: level, label: `Heading ${level.slice(1)}` })),
        ],
        getValue: () => {
          const heading = $getSelectedHeading();
          const tag = heading?.getTag();
          return tag && levels.includes(tag) ? tag : 'paragraph';
        },
        onChange: (value, editor) => {
          editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            if (value === 'paragraph') {
              $setBlocksType(selection, () => $createParagraphNode());
            } else {
              $setBlocksType(selection, () => $createHeadingNode(value as HeadingTagType));
            }
          });
        },
      },
    ],
  };
}

function $getSelectedHeading(): HeadingNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const anchor = selection.anchor.getNode();
  const block = $findMatchingParent(anchor, (node) => $isElementNode(node) && !node.isInline() && !$isRootOrShadowRoot(node));
  return $isHeadingNode(block) ? block : null;
}
