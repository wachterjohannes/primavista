import { $isLinkNode, $toggleLink, type LinkNode } from '@lexical/link';
import { $findMatchingParent } from '@lexical/utils';
import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  type LexicalEditor,
  type LexicalNode,
  type RangeSelection,
} from 'lexical';
import { $isInternalLinkNode, InternalLinkNode } from './nodes/InternalLinkNode';
import type { BalloonApi } from './types';

/** The link node that fully contains the selection, or null. */
export function $getLinkAtSelection(): LinkNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const anchorLink = $findMatchingParent(selection.anchor.getNode(), $isLinkNode);
  if (!anchorLink) return null;
  const focusLink = $findMatchingParent(selection.focus.getNode(), $isLinkNode);
  return focusLink === anchorLink ? anchorLink : null;
}

/** True when any node in the selection sits inside a link. */
export function $selectionTouchesLink(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return false;
  if ($getLinkAtSelection()) return true;
  return selection.getNodes().some((node) => $findMatchingParent(node, $isLinkNode) !== null);
}

export interface LinkSelectionState {
  link: LinkNode | null;
  selectedText: string;
  collapsed: boolean;
}

export function $readLinkSelection(): LinkSelectionState {
  const selection = $getSelection();
  const link = $getLinkAtSelection();
  return {
    link,
    selectedText: $isRangeSelection(selection) ? selection.getTextContent() : '',
    collapsed: $isRangeSelection(selection) ? selection.isCollapsed() : true,
  };
}

/**
 * Wraps the selection in a link. With a collapsed selection outside a link,
 * `text` is inserted first and becomes the link text. Returns the link nodes
 * that now carry the selection.
 */
export function $wrapSelectionInLink(
  attributes: { url: string; target?: string | null; title?: string | null; rel?: string | null },
  text: string,
): LinkNode[] {
  let selection = $getSelection();
  if (!$isRangeSelection(selection)) return [];
  if (selection.isCollapsed() && !$getLinkAtSelection()) {
    if (text === '') return [];
    const textNode = $createTextNode(text);
    selection.insertNodes([textNode]);
    selection = textNode.select(0, textNode.getTextContentSize());
  }
  // Lexical adds rel="noreferrer" unless rel is given explicitly.
  $toggleLink({
    url: attributes.url,
    target: attributes.target ?? null,
    title: attributes.title ?? null,
    rel: attributes.rel ?? null,
  });
  return $collectLinksInSelection();
}

export function $collectLinksInSelection(): LinkNode[] {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return [];
  const links = new Map<string, LinkNode>();
  const consider = (node: LexicalNode): void => {
    const link = $findMatchingParent(node, $isLinkNode);
    if (link) links.set(link.getKey(), link);
  };
  consider(selection.anchor.getNode());
  consider(selection.focus.getNode());
  selection.getNodes().forEach(consider);
  return Array.from(links.values());
}

export function $unlinkSelection(): void {
  $toggleLink(null);
}

/** Selects the whole link so the next edit or unlink applies to all of it. */
export function $selectLink(link: LinkNode): RangeSelection | null {
  const first = link.getFirstDescendant();
  const last = link.getLastDescendant();
  if (!first || !last) return null;
  const selection = first.selectStart();
  selection.focus.set(last.getKey(), last.getTextContentSize(), 'text');
  return selection;
}

export interface BalloonActions {
  label?: { text: string; href?: string };
  edit: () => void;
  remove: () => void;
  editLabel?: string;
  removeLabel?: string;
}

/**
 * Keeps a balloon under the current link while the selection stays inside
 * it. `resolve` runs inside `editor.read()` and returns the actions for the
 * link at the selection, or null to hide.
 */
export function registerLinkBalloon(
  editor: LexicalEditor,
  balloon: BalloonApi,
  container: HTMLElement,
  resolve: (link: LinkNode) => BalloonActions | null,
  icons: { edit: string; remove: string },
): () => void {
  let shownFor: string | null = null;

  const update = (): void => {
    if (!editor.isEditable()) {
      hide();
      return;
    }
    const result = editor.read(() => {
      const link = $getLinkAtSelection();
      if (!link) return null;
      const actions = resolve(link);
      return actions ? { key: link.getKey(), actions } : null;
    });
    if (!result) {
      hide();
      return;
    }
    const anchor = editor.getElementByKey(result.key);
    if (!anchor) {
      hide();
      return;
    }
    if (shownFor === result.key && balloon.isOpen()) {
      balloon.reposition();
      return;
    }
    shownFor = result.key;
    balloon.show(anchor, (panel) => {
      panel.classList.add('pv-link-balloon');
      const { actions } = result;
      if (actions.label) {
        if (actions.label.href) {
          const preview = document.createElement('a');
          preview.className = 'pv-balloon-label pv-balloon-preview';
          preview.href = actions.label.href;
          preview.target = '_blank';
          preview.rel = 'noopener noreferrer';
          preview.textContent = actions.label.text;
          preview.title = actions.label.text;
          panel.appendChild(preview);
        } else {
          const label = document.createElement('span');
          label.className = 'pv-balloon-label';
          label.textContent = actions.label.text;
          label.title = actions.label.text;
          panel.appendChild(label);
        }
      }
      panel.appendChild(balloonButton(icons.edit, actions.editLabel ?? 'Edit link', 'edit', actions.edit));
      panel.appendChild(balloonButton(icons.remove, actions.removeLabel ?? 'Remove link', 'unlink', actions.remove));
    });
  };

  const hide = (): void => {
    if (shownFor !== null) {
      shownFor = null;
      balloon.hide();
    }
  };

  const onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget;
    if (next instanceof Node && container.contains(next)) return;
    hide();
  };
  container.addEventListener('focusout', onFocusOut);

  const unregister = editor.registerUpdateListener(() => update());
  const unregisterEditable = editor.registerEditableListener(() => update());

  return () => {
    hide();
    unregister();
    unregisterEditable();
    container.removeEventListener('focusout', onFocusOut);
  };
}

function balloonButton(icon: string, label: string, action: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pv-button';
  button.innerHTML = icon;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.dataset['pvBalloonAction'] = action;
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', onClick);
  return button;
}

export { $isInternalLinkNode, InternalLinkNode };
