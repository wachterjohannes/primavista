import { mergeRegister } from '@lexical/utils';
import {
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  type LexicalNode,
  type RangeSelection,
} from 'lexical';
import { icons } from '../icons';
import { createInlineElementNode, type InlineElementNode } from '../nodes/inlineElementNode';
import { assertSpecificMatch } from '../nodes/match';
import type { PluginContext, PrimavistaPlugin, ToolbarApi, Translate } from '../types';

export interface InlineElementOptions {
  /** Unique name of the plugin, also the toolbar item id and the Lexical node type suffix. */
  name: string;
  /** The element, for example `mark` or `abbr`. */
  tag: string;
  /** Attributes kept when HTML is loaded or pasted and written back, for example `['title']`. */
  attributes?: ReadonlyArray<string>;
  /** Class written on every element. Loaded and pasted elements need it too, so `span` and `mark.yellow` stay apart from other content. */
  className?: string;
  /** Attributes a loaded or pasted element must have to count. */
  requires?: ReadonlyArray<string>;
  /** The toolbar button that wraps or unwraps the selection. `false` registers the element without a button. */
  toolbar?: { label: string; icon?: string; group?: string } | false;
}

/**
 * An inline element such as `<mark>`, `<abbr title>` or `<span class>` with a
 * toolbar button that wraps the selected text or removes the wrapper. The
 * Lexical node, import, export, paste handling and the schema entry for
 * sanitizers come with it, an extension needs no Lexical code for this.
 * With `attributes` the button opens a small form to enter their values, and
 * on a selection inside an existing element it edits or removes that element.
 */
export function inlineElement(options: InlineElementOptions): PrimavistaPlugin {
  const attributes = options.attributes ?? [];
  const match = { tag: options.tag, className: options.className, requires: options.requires };
  assertSpecificMatch('inlineElement', options.name, match);
  const { Node, $create, $is } = createInlineElementNode({
    name: options.name,
    tag: options.tag,
    attributes,
    fixed: options.className ? { class: options.className } : {},
    match,
  });

  const $ownerOf = (node: LexicalNode): InlineElementNode | null => {
    let current: LexicalNode | null = node;
    while (current !== null) {
      if ($is(current)) return current;
      const parent: LexicalNode | null = current.getParent();
      if (parent === null || ($isElementNode(parent) && !parent.isInline())) return null;
      current = parent;
    }
    return null;
  };

  const sameAttributes = (a: InlineElementNode, b: InlineElementNode): boolean =>
    JSON.stringify(a.getAttributes()) === JSON.stringify(b.getAttributes());

  const $mergeWithPrevious = (node: InlineElementNode): void => {
    const previous = node.getPreviousSibling();
    if (!$is(previous) || !sameAttributes(previous, node)) return;
    previous.append(...node.getChildren());
    node.remove();
  };

  const $unwrap = (node: InlineElementNode): void => {
    for (const child of node.getChildren()) node.insertBefore(child);
    node.remove();
  };

  /** Cuts the element so that `child` sits alone in it, the siblings move into elements of their own. */
  const $isolate = (node: InlineElementNode, child: LexicalNode): InlineElementNode => {
    const before = child.getPreviousSiblings();
    const after = child.getNextSiblings();
    if (before.length > 0) {
      const head = $create(node.getAttributes());
      node.insertBefore(head);
      head.append(...before);
    }
    if (after.length > 0) {
      const tail = $create(node.getAttributes());
      node.insertAfter(tail);
      tail.append(...after);
    }
    return node;
  };

  const $isActive = (): boolean => {
    const selection = $getSelection();
    return $isRangeSelection(selection) && $ownerOf(selection.anchor.getNode()) !== null;
  };

  const $toggle = (attributes: Record<string, string> = {}): void => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    if (selection.isCollapsed()) {
      const owner = $ownerOf(selection.anchor.getNode());
      if (owner) $unwrap(owner);
      return;
    }

    const textNodes = selection.extract().filter($isTextNode).filter((node) => node.getTextContent() !== '');
    const unwrapping = textNodes.length > 0 && textNodes.every((node) => $ownerOf(node) !== null);
    const touched: InlineElementNode[] = [];
    for (const textNode of textNodes) {
      const existing = $ownerOf(textNode);
      if (unwrapping && existing) {
        $unwrap($isolate(existing, textNode));
      } else if (!existing) {
        const created = $create(attributes);
        textNode.insertBefore(created);
        created.append(textNode);
        touched.push(created);
      }
    }
    for (const node of touched) {
      if (node.isAttached()) $mergeWithPrevious(node);
    }
    $reselect(selection, textNodes);
  };

  const toolbar = options.toolbar;
  let pluginContext: PluginContext | null = null;
  const plugin: PrimavistaPlugin = {
    name: options.name,
    nodes: [Node],
    schema: { elements: [{ tag: options.tag, attributes: [...attributes, ...(options.requires ?? [])], ...(options.className ? { className: options.className } : {}), ...(options.requires ? { requires: options.requires } : {}) }] },
    register: (context) => {
      pluginContext = context;
      return mergeRegister(
        context.editor.registerNodeTransform(Node, (node) => {
          if (node.getChildrenSize() === 0) {
            node.remove();
            return;
          }
          $mergeWithPrevious(node);
        }),
      );
    },
  };

  const openForm = (toolbar: ToolbarApi): void => {
    if (!pluginContext) return;
    const { editor, translate } = pluginContext;
    const state = editor.read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return null;
      const owner = $ownerOf(selection.anchor.getNode());
      if (!owner && selection.isCollapsed()) return null;
      return { values: owner ? { ...owner.getAttributes() } : {}, exists: owner !== null };
    });
    if (!state) return;

    const finish = (): void => {
      toolbar.closePanel();
      editor.focus();
    };
    const apply = (values: Record<string, string>): void => {
      const clean = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''));
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const owner = $ownerOf(selection.anchor.getNode());
        if (owner) {
          owner.setAttributes(clean);
          return;
        }
        // An element without any value says nothing, so nothing is wrapped.
        if (Object.keys(clean).length > 0) $toggle(clean);
      });
      finish();
    };
    const remove = (): void => {
      editor.update(() => {
        const selection = $getSelection();
        const owner = $isRangeSelection(selection) ? $ownerOf(selection.anchor.getNode()) : null;
        if (owner) $unwrap(owner);
      });
      finish();
    };
    toolbar.openPanel((panel) =>
      renderForm(panel, {
        fields: attributes,
        values: state.values,
        exists: state.exists,
        name: options.name,
        translate,
        apply,
        remove,
        cancel: finish,
      }),
    );
  };

  if (toolbar !== false) {
    plugin.toolbar = [
      {
        id: options.name,
        label: toolbar?.label ?? options.name,
        ...(toolbar?.icon ? { icon: toolbar.icon } : {}),
        ...(toolbar?.group ? { group: toolbar.group } : {}),
        isActive: $isActive,
        isDisabled: () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return true;
          return selection.isCollapsed() && !$isActive();
        },
        onClick: (editor, { toolbar: toolbarApi }) => {
          if (attributes.length > 0) {
            openForm(toolbarApi);
            return;
          }
          editor.update(() => $toggle());
          editor.focus();
        },
      },
    ];
  }
  return plugin;
}

interface FormState {
  fields: ReadonlyArray<string>;
  values: Record<string, string>;
  exists: boolean;
  name: string;
  translate: Translate;
  apply: (values: Record<string, string>) => void;
  remove: () => void;
  cancel: () => void;
}

/** One text field per attribute, the same panel the link plugins use. */
function renderForm(panel: HTMLElement, state: FormState): void {
  const form = document.createElement('form');
  form.className = 'pv-link-form';

  const inputs = state.fields.map((field) => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'pv-input';
    input.name = field;
    const label = state.translate(`inlineElement.${state.name}.${field}`, field);
    input.placeholder = label;
    input.setAttribute('aria-label', label);
    input.value = state.values[field] ?? '';
    form.appendChild(input);
    return input;
  });

  const button = (type: 'submit' | 'button', icon: string, title: string, primary = false): HTMLButtonElement => {
    const el = document.createElement('button');
    el.type = type;
    el.className = primary ? 'pv-button pv-button--primary' : 'pv-button';
    el.innerHTML = icon;
    el.title = title;
    el.setAttribute('aria-label', title);
    form.appendChild(el);
    return el;
  };
  button('submit', icons.check, state.translate('inlineElement.apply', state.exists ? 'Update' : 'Apply'), true);
  if (state.exists) {
    button('button', icons.unlink, state.translate('inlineElement.remove', 'Remove')).addEventListener('click', state.remove);
  }
  button('button', icons.close, state.translate('link.cancel', 'Cancel')).addEventListener('click', state.cancel);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    state.apply(Object.fromEntries(inputs.map((input) => [input.name, input.value.trim()])));
  });
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      state.cancel();
    }
  });

  panel.appendChild(form);
  inputs[0]?.focus();
  inputs[0]?.select();
}

function $reselect(selection: RangeSelection, nodes: LexicalNode[]): void {
  const attached = nodes.filter((node) => node.isAttached() && $isTextNode(node));
  const first = attached[0];
  const last = attached[attached.length - 1];
  if (!first || !last || !$isTextNode(first) || !$isTextNode(last)) return;
  selection.anchor.set(first.getKey(), 0, 'text');
  selection.focus.set(last.getKey(), last.getTextContentSize(), 'text');
}
