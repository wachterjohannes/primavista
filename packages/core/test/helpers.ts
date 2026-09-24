import { $getRoot, $isElementNode, $isTextNode, type LexicalNode } from 'lexical';
import { createEditor, type EditorOptions, type PrimavistaEditor } from '../src';

export function mount(options: EditorOptions = {}): { editor: PrimavistaEditor; container: HTMLElement } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const editor = createEditor(container, options);
  return { editor, container };
}

/** Selects every text node of the document, so toolbar commands have something to work on. */
export function selectAll(editor: PrimavistaEditor): void {
  editor.lexical.update(
    () => {
      const texts: LexicalNode[] = [];
      const walk = (node: LexicalNode): void => {
        if ($isTextNode(node)) texts.push(node);
        if ($isElementNode(node)) node.getChildren().forEach(walk);
      };
      walk($getRoot());
      const first = texts[0];
      const last = texts[texts.length - 1];
      if (first && last && $isTextNode(first) && $isTextNode(last)) {
        first.select(0, 0);
        const selection = first.select(0, 0);
        selection.focus.set(last.getKey(), last.getTextContentSize(), 'text');
      } else {
        $getRoot().selectEnd();
      }
    },
    { discrete: true },
  );
}

export function button(editor: PrimavistaEditor, id: string): HTMLButtonElement {
  const el = editor.toolbar.element.querySelector<HTMLButtonElement>(`[data-pv-item="${id}"]`);
  if (!el) throw new Error(`toolbar item ${id} not found`);
  return el;
}

export function select(editor: PrimavistaEditor, id: string): HTMLSelectElement {
  const el = editor.toolbar.element.querySelector<HTMLSelectElement>(`select[data-pv-item="${id}"]`);
  if (!el) throw new Error(`toolbar select ${id} not found`);
  return el;
}

export function typeText(editor: PrimavistaEditor, text: string): void {
  editor.lexical.update(
    () => {
      $getRoot().selectEnd().insertText(text);
    },
    { discrete: true },
  );
}
