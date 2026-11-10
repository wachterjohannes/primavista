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

export type SerializedInlineElementNode = Spread<{ attributes: Record<string, string> }, SerializedElementNode>;

export interface InlineElementSpec {
  /** Unique name, becomes the Lexical node type `inline:<name>`. */
  name: string;
  tag: string;
  /** Attributes read from loaded HTML and written back. Anything else is dropped. */
  attributes: ReadonlyArray<string>;
  /** Attributes written on every element, for example `class`. */
  fixed: Readonly<Record<string, string>>;
}

export interface InlineElementNode extends ElementNode {
  __attributes: Record<string, string>;
  getAttributes(): Record<string, string>;
}

export interface InlineElementNodeClass extends Klass<InlineElementNode> {
  new (attributes?: Record<string, string>, key?: NodeKey): InlineElementNode;
}

/**
 * Builds the Lexical node for one inline element, for example `<mark>` or
 * `<abbr title>`. One class per call, so two editors with different specs do
 * not share static state.
 */
export function createInlineElementNode(spec: InlineElementSpec): {
  Node: InlineElementNodeClass;
  $create: (attributes?: Record<string, string>) => InlineElementNode;
  $is: (node: LexicalNode | null | undefined) => node is InlineElementNode;
} {
  const apply = (element: HTMLElement, attributes: Record<string, string>): void => {
    for (const [name, value] of Object.entries(spec.fixed)) element.setAttribute(name, value);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  };

  class Node extends ElementNode implements InlineElementNode {
    __attributes: Record<string, string>;

    static override getType(): string {
      return `inline:${spec.name}`;
    }

    static override clone(node: Node): Node {
      return new Node(node.__attributes, node.__key);
    }

    static override importJSON(serialized: SerializedInlineElementNode): Node {
      return $create(serialized.attributes).updateFromJSON(serialized) as Node;
    }

    static override importDOM(): DOMConversionMap | null {
      return {
        [spec.tag]: () => ({ conversion: convert, priority: 1 }),
      };
    }

    constructor(attributes: Record<string, string> = {}, key?: NodeKey) {
      super(key);
      this.__attributes = attributes;
    }

    override afterCloneFrom(prevNode: this): void {
      super.afterCloneFrom(prevNode);
      this.__attributes = prevNode.__attributes;
    }

    override exportJSON(): SerializedInlineElementNode {
      return { ...super.exportJSON(), type: Node.getType(), attributes: this.getAttributes() };
    }

    override createDOM(config: EditorConfig): HTMLElement {
      const element = document.createElement(spec.tag);
      apply(element, this.__attributes);
      addClassNamesToElement(element, config.theme[`inline-${spec.name}`]);
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
