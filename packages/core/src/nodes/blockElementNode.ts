import { addClassNamesToElement } from '@lexical/utils';
import {
  $applyNodeReplacement,
  ElementNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type Klass,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from 'lexical';
import { elementMatches, type ElementMatch } from './match';

export type SerializedBlockElementNode = Spread<{ attributes: Record<string, string> }, SerializedElementNode>;

export interface BlockElementSpec {
  /** Unique name, becomes the Lexical node type `block:<name>`. */
  name: string;
  tag: string;
  attributes: ReadonlyArray<string>;
  fixed: Readonly<Record<string, string>>;
  /** Which elements of the tag this node claims. */
  match: ElementMatch;
}

export interface BlockElementNode extends ElementNode {
  getAttributes(): Record<string, string>;
}

export interface BlockElementNodeClass extends Klass<BlockElementNode> {
  new (attributes?: Record<string, string>, key?: NodeKey): BlockElementNode;
}

/** The Lexical node for an element that wraps whole blocks, such as `<aside>`. One class per call. */
export function createBlockElementNode(spec: BlockElementSpec): {
  Node: BlockElementNodeClass;
  $create: (attributes?: Record<string, string>) => BlockElementNode;
  $is: (node: LexicalNode | null | undefined) => node is BlockElementNode;
} {
  const apply = (element: HTMLElement, attributes: Record<string, string>): void => {
    for (const [name, value] of Object.entries(spec.fixed)) element.setAttribute(name, value);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  };

  class Node extends ElementNode implements BlockElementNode {
    __attributes: Record<string, string>;

    static override getType(): string {
      return `block:${spec.name}`;
    }

    static override clone(node: Node): Node {
      return new Node(node.__attributes, node.__key);
    }

    static override importJSON(serialized: SerializedBlockElementNode): Node {
      return $create(serialized.attributes).updateFromJSON(serialized) as Node;
    }

    static override importDOM(): DOMConversionMap | null {
      return { [spec.tag]: (element: HTMLElement) => (elementMatches(element, spec.match) ? { conversion: convert, priority: 1 } : null) };
    }

    constructor(attributes: Record<string, string> = {}, key?: NodeKey) {
      super(key);
      this.__attributes = attributes;
    }

    override afterCloneFrom(prevNode: this): void {
      super.afterCloneFrom(prevNode);
      this.__attributes = prevNode.__attributes;
    }

    override exportJSON(): SerializedBlockElementNode {
      return { ...super.exportJSON(), type: Node.getType(), attributes: this.getAttributes() };
    }

    override createDOM(config: EditorConfig): HTMLElement {
      const element = document.createElement(spec.tag);
      apply(element, this.__attributes);
      addClassNamesToElement(element, config.theme[`block-${spec.name}`]);
      return element;
    }

    override updateDOM(prevNode: this, element: HTMLElement): boolean {
      if (prevNode.__attributes !== this.__attributes) {
        for (const name of Object.keys(prevNode.__attributes)) element.removeAttribute(name);
        apply(element, this.__attributes);
      }
      return false;
    }

    override exportDOM(_editor: LexicalEditor): DOMExportOutput {
      const element = document.createElement(spec.tag);
      apply(element, this.__attributes);
      return { element };
    }

    getAttributes(): Record<string, string> {
      return this.getLatest().__attributes;
    }

    override isInline(): false {
      return false;
    }

    override canBeEmpty(): false {
      return false;
    }
  }

  function convert(element: HTMLElement): DOMConversionOutput {
    const attributes: Record<string, string> = {};
    for (const name of spec.attributes) {
      const value = element.getAttribute(name);
      if (value !== null && value !== '') attributes[name] = value;
    }
    return { node: $create(attributes) };
  }

  function $create(attributes: Record<string, string> = {}): Node {
    return $applyNodeReplacement(new Node(attributes));
  }

  const $is = (node: LexicalNode | null | undefined): node is Node => node instanceof Node;

  return { Node, $create, $is };
}
