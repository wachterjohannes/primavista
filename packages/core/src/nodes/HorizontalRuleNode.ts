import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
} from 'lexical';

export type SerializedHorizontalRuleNode = SerializedLexicalNode;

/**
 * A thematic break, `<hr>`. A decorator node without a decoration: the
 * element from `createDOM` is the whole rendering, so no host framework is
 * needed. It is keyboard selectable, so Backspace and Delete remove it.
 */
export class HorizontalRuleNode extends DecoratorNode<null> {
  static override getType(): string {
    return 'horizontal-rule';
  }

  static override clone(node: HorizontalRuleNode): HorizontalRuleNode {
    return new HorizontalRuleNode(node.__key);
  }

  static override importJSON(serialized: SerializedHorizontalRuleNode): HorizontalRuleNode {
    return $createHorizontalRuleNode().updateFromJSON(serialized);
  }

  static override importDOM(): DOMConversionMap | null {
    return {
      hr: () => ({ conversion: () => ({ node: $createHorizontalRuleNode() }), priority: 0 }),
    };
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  override exportDOM(): DOMExportOutput {
    return { element: document.createElement('hr') };
  }

  override createDOM(config: EditorConfig): HTMLElement {
    const element = document.createElement('hr');
    const className = config.theme.hr;
    if (className) element.className = className;
    return element;
  }

  override updateDOM(): boolean {
    return false;
  }

  override getTextContent(): string {
    return '\n';
  }

  override isInline(): boolean {
    return false;
  }

  override isKeyboardSelectable(): boolean {
    return true;
  }

  override decorate(): null {
    return null;
  }
}

export function $createHorizontalRuleNode(): HorizontalRuleNode {
  return $applyNodeReplacement(new HorizontalRuleNode());
}

export function $isHorizontalRuleNode(node: LexicalNode | null | undefined): node is HorizontalRuleNode {
  return node instanceof HorizontalRuleNode;
}
