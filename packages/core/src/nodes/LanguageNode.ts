import { addClassNamesToElement } from '@lexical/utils';
import {
  $applyNodeReplacement,
  $isElementNode,
  ElementNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from 'lexical';

export type SerializedLanguageNode = Spread<{ lang: string }, SerializedElementNode>;

/**
 * A text part in another language than the surrounding text, stored as
 * `<span lang="fr">…</span>`. Screen readers switch pronunciation on the
 * attribute. Same markup as CKEditor's TextPartLanguage feature, minus the
 * `dir` attribute it adds.
 */
export class LanguageNode extends ElementNode {
  __lang: string;

  static override getType(): string {
    return 'language';
  }

  static override clone(node: LanguageNode): LanguageNode {
    return new LanguageNode(node.__lang, node.__key);
  }

  static override importJSON(serialized: SerializedLanguageNode): LanguageNode {
    return $createLanguageNode(serialized.lang).updateFromJSON(serialized);
  }

  static override importDOM(): DOMConversionMap | null {
    return {
      span: (element: HTMLElement) => {
        if (!element.getAttribute('lang')) return null;
        return { conversion: $convertLanguageElement, priority: 1 };
      },
    };
  }

  constructor(lang: string, key?: NodeKey) {
    super(key);
    this.__lang = lang;
  }

  override afterCloneFrom(prevNode: this): void {
    super.afterCloneFrom(prevNode);
    this.__lang = prevNode.__lang;
  }

  override exportJSON(): SerializedLanguageNode {
    return { ...super.exportJSON(), type: 'language', lang: this.getLang() };
  }

  override createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('span');
    element.setAttribute('lang', this.__lang);
    addClassNamesToElement(element, config.theme['language']);
    return element;
  }

  override updateDOM(prevNode: this, element: HTMLElement): boolean {
    if (prevNode.__lang !== this.__lang) element.setAttribute('lang', this.__lang);
    return false;
  }

  override exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const element = document.createElement('span');
    element.setAttribute('lang', this.__lang);
    return { element };
  }

  getLang(): string {
    return this.getLatest().__lang;
  }

  setLang(lang: string): this {
    const writable = this.getWritable();
    writable.__lang = lang;
    return writable;
  }

  override isInline(): true {
    return true;
  }

  override canBeEmpty(): false {
    return false;
  }

  override canInsertTextBefore(): true {
    return true;
  }

  override canInsertTextAfter(): true {
    return true;
  }
}

function $convertLanguageElement(element: HTMLElement): DOMConversionOutput {
  return { node: $createLanguageNode(element.getAttribute('lang') ?? '') };
}

export function $createLanguageNode(lang: string): LanguageNode {
  return $applyNodeReplacement(new LanguageNode(lang));
}

export function $isLanguageNode(node: LexicalNode | null | undefined): node is LanguageNode {
  return node instanceof LanguageNode;
}

/** Merges a language span into a preceding sibling with the same language. */
export function $mergeLanguageNodeWithPrevious(node: LanguageNode): LanguageNode {
  const previous = node.getPreviousSibling();
  if (!$isLanguageNode(previous) || previous.getLang() !== node.getLang()) return node;
  previous.append(...node.getChildren());
  node.remove();
  return previous;
}

/** Unwraps a language span, leaving its children in place. */
export function $unwrapLanguageNode(node: LanguageNode): LexicalNode[] {
  const children = node.getChildren();
  for (const child of children) node.insertBefore(child);
  node.remove();
  return children;
}

/**
 * Cuts a language span so that `child` sits alone in it, moving the siblings
 * before and after into spans of their own. Returns the span around `child`.
 */
export function $isolateInLanguageNode(node: LanguageNode, child: LexicalNode): LanguageNode {
  const before = child.getPreviousSiblings();
  const after = child.getNextSiblings();
  if (before.length > 0) {
    const head = $createLanguageNode(node.getLang());
    node.insertBefore(head);
    head.append(...before);
  }
  if (after.length > 0) {
    const tail = $createLanguageNode(node.getLang());
    node.insertAfter(tail);
    tail.append(...after);
  }
  return node;
}

export function $getLanguageNodeOf(node: LexicalNode): LanguageNode | null {
  let current: LexicalNode | null = node;
  while (current !== null) {
    if ($isLanguageNode(current)) return current;
    const parent: LexicalNode | null = current.getParent();
    if (parent === null || ($isElementNode(parent) && !parent.isInline())) return null;
    current = parent;
  }
  return null;
}
