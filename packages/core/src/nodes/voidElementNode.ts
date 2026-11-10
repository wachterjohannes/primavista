import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  type Klass,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';

export type SerializedVoidElementNode = Spread<{ attributes: Record<string, string> }, SerializedLexicalNode>;

export interface VoidElementSpec {
  /** Unique name, becomes the Lexical node type `void:<name>`. */
  name: string;
  tag: string;
  attributes: ReadonlyArray<string>;
  fixed: Readonly<Record<string, string>>;
  /** Fills the element in the editor, for example a preview of an embed. The exported HTML stays `<tag attributes>`. */
  render?: ((element: HTMLElement, attributes: Readonly<Record<string, string>>) => void) | undefined;
}

export interface VoidElementNode extends DecoratorNode<null> {
  getAttributes(): Record<string, string>;
}

export interface VoidElementNodeClass extends Klass<VoidElementNode> {
  new (attributes?: Record<string, string>, key?: NodeKey): VoidElementNode;
}

/**
 * The Lexical node for a block-level element without content, such as a
 * placeholder, an embed or a divider. Like the horizontal rule it is a
 * decorator node whose element is its whole rendering, and it is keyboard
 * selectable so Backspace and Delete remove it.
 */
export function createVoidElementNode(spec: VoidElementSpec): {
  Node: VoidElementNodeClass;
  $create: (attributes?: Record<string, string>) => VoidElementNode;
  $is: (node: LexicalNode | null | undefined) => node is VoidElementNode;
} {
  const apply = (element: HTMLElement, attributes: Record<string, string>): void => {
    for (const [name, value] of Object.entries(spec.fixed)) element.setAttribute(name, value);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  };

  class Node extends DecoratorNode<null> implements VoidElementNode {
    __attributes: Record<string, string>;

    static override getType(): string {
      return `void:${spec.name}`;
    }

    static override clone(node: Node): Node {
      return new Node(node.__attributes, node.__key);
    }

    static override importJSON(serialized: SerializedVoidElementNode): Node {
      return $create(serialized.attributes).updateFromJSON(serialized) as Node;
    }

    static override importDOM(): DOMConversionMap | null {
      return { [spec.tag]: () => ({ conversion: convert, priority: 1 }) };
    }

    constructor(attributes: Record<string, string> = {}, key?: NodeKey) {
      super(key);
      this.__attributes = attributes;
    }

    override afterCloneFrom(prevNode: this): void {
      super.afterCloneFrom(prevNode);
      this.__attributes = prevNode.__attributes;
    }

    override exportJSON(): SerializedVoidElementNode {
      return { ...super.exportJSON(), type: Node.getType(), attributes: this.getAttributes() };
    }

    override exportDOM(): DOMExportOutput {
      const element = document.createElement(spec.tag);
      apply(element, this.__attributes);
      return { element };
    }

    override createDOM(config: EditorConfig): HTMLElement {
      const element = document.createElement(spec.tag);
      apply(element, this.__attributes);
      const className = config.theme[`void-${spec.name}`];
      if (className) element.className = [element.className, className].filter(Boolean).join(' ');
      spec.render?.(element, this.__attributes);
      return element;
    }

    override updateDOM(prevNode: this): boolean {
      return prevNode.__attributes !== this.__attributes;
    }

    getAttributes(): Record<string, string> {
      return this.getLatest().__attributes;
    }

    override getTextContent(): string {
      return '\n';
    }

    override isInline(): false {
      return false;
    }

    override isKeyboardSelectable(): true {
      return true;
    }

    override decorate(): null {
      return null;
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
