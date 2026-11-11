import { $insertNodeToNearestRoot, mergeRegister } from '@lexical/utils';
import {
  $createNodeSelection,
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
} from 'lexical';
import { createVoidElementNode } from '../nodes/voidElementNode';
import { assertSafeAttributes, assertSpecificMatch } from '../nodes/match';
import type { PrimavistaPlugin } from '../types';

export interface VoidElementOptions {
  /** Unique name of the plugin, also the toolbar item id and the Lexical node type suffix. */
  name: string;
  /** The element, for example `div` or `hr`. */
  tag: string;
  /** Attributes kept when HTML is loaded or pasted and written back, for example `['data-id']`. */
  attributes?: ReadonlyArray<string>;
  /** Attribute values of an element the toolbar button inserts. */
  defaults?: Readonly<Record<string, string>>;
  /** Class written on every element and required when loading or pasting. */
  className?: string;
  /**
   * Attributes a loaded or pasted element must have to count. Defaults to the
   * keys of `defaults`, so a `div` with `data-widget` claims only widgets.
   */
  requires?: ReadonlyArray<string>;
  /** Fills the element in the editor, for example with a preview. The exported HTML stays `<tag attributes>`. */
  render?: (element: HTMLElement, attributes: Readonly<Record<string, string>>) => void;
  /** The toolbar button that inserts the element. `false` registers the element without a button. */
  toolbar?: { label: string; icon?: string; group?: string } | false;
}

/**
 * A block-level element without content: a placeholder, an embed or a divider
 * such as `<div data-widget="newsletter"></div>`. Click selects it, Backspace
 * and Delete remove it. A toolbar button inserts it at the cursor. The
 * extension needs no Lexical code.
 */
export function voidElement(options: VoidElementOptions): PrimavistaPlugin {
  const requires = options.requires ?? (options.className ? [] : Object.keys(options.defaults ?? {}));
  const attributes = [...new Set([...(options.attributes ?? Object.keys(options.defaults ?? {})), ...requires])];
  const match = { tag: options.tag, className: options.className, requires };
  assertSpecificMatch('voidElement', options.name, match);
  assertSafeAttributes('voidElement', options.name, options.tag, attributes);
  const { Node, $create, $is } = createVoidElementNode({
    name: options.name,
    tag: options.tag,
    attributes,
    fixed: options.className ? { class: options.className } : {},
    render: options.render,
    match,
  });

  const toolbar = options.toolbar;
  const plugin: PrimavistaPlugin = {
    name: options.name,
    nodes: [Node],
    schema: {
      elements: [
        {
          tag: options.tag,
          attributes,
          kind: 'void',
          ...(options.className ? { className: options.className } : {}),
          ...(requires.length > 0 ? { requires } : {}),
        },
      ],
    },
    register: ({ editor, contentElement }) =>
      mergeRegister(
        editor.registerCommand(
          CLICK_COMMAND,
          (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement) || !contentElement.contains(target)) return false;
            const node = $getNearestNodeFromDOMNode(target);
            if (!$is(node)) return false;
            const selection = $createNodeSelection();
            selection.add(node.getKey());
            $setSelection(selection);
            return true;
          },
          COMMAND_PRIORITY_LOW,
        ),
      ),
  };
  if (toolbar !== false) {
    plugin.toolbar = [
      {
        id: options.name,
        label: toolbar?.label ?? options.name,
        ...(toolbar?.icon ? { icon: toolbar.icon } : {}),
        group: toolbar?.group ?? 'insert',
        onClick: (editor) => {
          editor.update(() => {
            if (!$isRangeSelection($getSelection())) return;
            $insertNodeToNearestRoot($create({ ...(options.defaults ?? {}) }));
          });
          editor.focus();
        },
      },
    ];
  }
  return plugin;
}
