import { $createLinkNode, $isLinkNode, LinkNode, type SerializedLinkNode } from '@lexical/link';
import { addClassNamesToElement } from '@lexical/utils';
import {
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type Spread,
} from 'lexical';

export interface InternalLinkAttributes {
  provider: string;
  target?: string | null;
  title?: string | null;
  validationState?: string | null;
}

export type SerializedInternalLinkNode = Spread<
  {
    provider: string;
    validationState: string | null;
  },
  SerializedLinkNode
>;

const ATTRIBUTE_HREF = 'href';
const ATTRIBUTE_PROVIDER = 'provider';
const ATTRIBUTE_TARGET = 'target';
const ATTRIBUTE_TITLE = 'title';

/**
 * A link to a resource of the host system, stored as a custom element that
 * the host resolves when it renders the page:
 *
 * `<internal-link href="id?query#anchor" provider="page" target="_self" title="…" validation-state="…">text</internal-link>`
 *
 * The href holds the resource id plus optional query and anchor. The tag name
 * and the validation attribute are static fields, which the plugin sets
 * before the editor is created. `@primavista/sulu` sets them to Sulu's
 * `<sulu-link>` format.
 */
export class InternalLinkNode extends LinkNode {
  /** Custom element name in the exported HTML. */
  static tagName = 'internal-link';
  /** Attribute the host uses to flag unpublished or removed targets. */
  static validationAttribute = 'validation-state';

  __provider: string;
  __validationState: null | string;

  static override getType(): string {
    return 'internal-link';
  }

  static override clone(node: InternalLinkNode): InternalLinkNode {
    return new InternalLinkNode(
      node.__url,
      {
        provider: node.__provider,
        target: node.__target,
        title: node.__title,
        validationState: node.__validationState,
      },
      node.__key,
    );
  }

  static override importJSON(serialized: SerializedInternalLinkNode): InternalLinkNode {
    return $createInternalLinkNode(serialized.url, {
      provider: serialized.provider,
      target: serialized.target ?? null,
      title: serialized.title ?? null,
      validationState: serialized.validationState ?? null,
    }).updateFromJSON(serialized);
  }

  static override importDOM(): DOMConversionMap | null {
    return {
      [InternalLinkNode.tagName]: () => ({
        conversion: $convertInternalLinkElement,
        priority: 2,
      }),
    };
  }

  constructor(url: string, attributes: InternalLinkAttributes, key?: NodeKey) {
    super(url, { target: attributes.target ?? null, title: attributes.title ?? null, rel: null }, key);
    this.__provider = attributes.provider;
    this.__validationState = attributes.validationState ?? null;
  }

  override afterCloneFrom(prevNode: this): void {
    super.afterCloneFrom(prevNode);
    this.__provider = prevNode.__provider;
    this.__validationState = prevNode.__validationState;
  }

  override exportJSON(): SerializedInternalLinkNode {
    return {
      ...super.exportJSON(),
      type: 'internal-link',
      provider: this.getProvider(),
      validationState: this.getValidationState(),
    };
  }

  override createDOM(config: EditorConfig): HTMLAnchorElement {
    const element = document.createElement('a');
    this.updateInternalLinkDOM(null, element);
    addClassNamesToElement(element, config.theme['link'], config.theme['internalLink']);
    return element;
  }

  override updateDOM(prevNode: this, element: HTMLAnchorElement): boolean {
    this.updateInternalLinkDOM(prevNode, element);
    return false;
  }

  private updateInternalLinkDOM(prevNode: this | null, element: HTMLAnchorElement): void {
    if (!prevNode || prevNode.__url !== this.__url) element.dataset['href'] = this.__url;
    if (!prevNode || prevNode.__provider !== this.__provider) element.dataset['provider'] = this.__provider;
    if (!prevNode || prevNode.__validationState !== this.__validationState) {
      if (this.__validationState) {
        element.dataset['validationState'] = this.__validationState;
      } else {
        delete element.dataset['validationState'];
      }
    }
    if (!prevNode || prevNode.__title !== this.__title) {
      if (this.__title) {
        element.title = this.__title;
      } else {
        element.removeAttribute('title');
      }
    }
  }

  override exportDOM(_editor: LexicalEditor): DOMExportOutput {
    const element = document.createElement(InternalLinkNode.tagName);
    element.setAttribute(ATTRIBUTE_HREF, this.__url);
    element.setAttribute(ATTRIBUTE_PROVIDER, this.__provider);
    if (this.__target) element.setAttribute(ATTRIBUTE_TARGET, this.__target);
    if (this.__title) element.setAttribute(ATTRIBUTE_TITLE, this.__title);
    if (this.__validationState) element.setAttribute(InternalLinkNode.validationAttribute, this.__validationState);
    return { element };
  }

  getProvider(): string {
    return this.getLatest().__provider;
  }

  setProvider(provider: string): this {
    const writable = this.getWritable();
    writable.__provider = provider;
    return writable;
  }

  getValidationState(): null | string {
    return this.getLatest().__validationState;
  }

  setValidationState(state: null | string): this {
    const writable = this.getWritable();
    writable.__validationState = state;
    return writable;
  }

  override shouldMergeAdjacentLink(otherLink: LinkNode): boolean {
    return (
      $isInternalLinkNode(otherLink) &&
      otherLink.getProvider() === this.getProvider() &&
      otherLink.getValidationState() === this.getValidationState() &&
      super.shouldMergeAdjacentLink(otherLink)
    );
  }

  override isEmailURI(): boolean {
    return false;
  }

  override isWebSiteURI(): boolean {
    return false;
  }
}

function $convertInternalLinkElement(element: HTMLElement): DOMConversionOutput {
  const href = element.getAttribute(ATTRIBUTE_HREF);
  if (!href) return { node: null };
  const node = $createInternalLinkNode(href, {
    provider: element.getAttribute(ATTRIBUTE_PROVIDER) ?? '',
    target: element.getAttribute(ATTRIBUTE_TARGET),
    title: element.getAttribute(ATTRIBUTE_TITLE),
    validationState: element.getAttribute(InternalLinkNode.validationAttribute),
  });
  return { node };
}

export function $createInternalLinkNode(href: string, attributes: InternalLinkAttributes): InternalLinkNode {
  return new InternalLinkNode(href, attributes);
}

export function $isInternalLinkNode(node: LexicalNode | null | undefined): node is InternalLinkNode {
  return node instanceof InternalLinkNode;
}

/** A plain external link, never an internal one. */
export function $isExternalLinkNode(node: LexicalNode | null | undefined): node is LinkNode {
  return $isLinkNode(node) && !$isInternalLinkNode(node);
}

export { $createLinkNode };
