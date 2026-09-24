import { $findMatchingParent } from '@lexical/utils';
import {
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  type ElementFormatType,
  FORMAT_ELEMENT_COMMAND,
} from 'lexical';
import { icons } from '../icons';
import type { PrimavistaPlugin, ToolbarButton } from '../types';

export type Alignment = Extract<ElementFormatType, 'left' | 'center' | 'right' | 'justify'>;

export interface AlignmentOptions {
  alignments?: ReadonlyArray<Alignment>;
}

const ALL: ReadonlyArray<Alignment> = ['left', 'center', 'right', 'justify'];

const META: Record<Alignment, { label: string; icon: string }> = {
  left: { label: 'Align left', icon: icons.alignLeft },
  center: { label: 'Align center', icon: icons.alignCenter },
  right: { label: 'Align right', icon: icons.alignRight },
  justify: { label: 'Justify', icon: icons.alignJustify },
};

/** Block alignment, exported as `style="text-align: …"` like CKEditor does. Clicking the active alignment resets it. */
export function alignment(options: AlignmentOptions = {}): PrimavistaPlugin {
  const alignments = options.alignments ?? ALL;
  return {
    name: 'alignment',
    toolbar: alignments.map(
      (value): ToolbarButton => ({
        id: `align-${value}`,
        label: META[value].label,
        icon: META[value].icon,
        group: 'alignment',
        isActive: () => $getSelectedAlignment() === value,
        onClick: (editor) => {
          const active = editor.read(() => $getSelectedAlignment() === value);
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, active ? '' : value);
        },
      }),
    ),
  };
}

function $getSelectedAlignment(): ElementFormatType {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return '';
  const node = selection.anchor.getNode();
  const block = $isElementNode(node) && !node.isInline() && !$isRootOrShadowRoot(node)
    ? node
    : $findMatchingParent(node, (parent) => $isElementNode(parent) && !parent.isInline() && !$isRootOrShadowRoot(parent));
  return $isElementNode(block) ? block.getFormatType() : '';
}
