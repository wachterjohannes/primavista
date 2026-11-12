import { $getRoot, $isElementNode, $isTextNode, type LexicalNode } from 'lexical';
import { createEditor } from './editor';
import type { EditorOptions, PrimavistaEditor, PrimavistaPlugin } from './types';

/** Mounts an editor into a fresh element of `document.body`. Remove both after the test. */
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

/** jsdom has no clipboard or drag events. Lexical tells events apart by constructor name, so the stand-ins carry the real names. */
class DragEvent extends Event {}

class ClipboardEvent extends Event {
  readonly clipboardData: DataTransfer;
  constructor(clipboardData: DataTransfer) {
    super('paste', { bubbles: true, cancelable: true });
    this.clipboardData = clipboardData;
  }
}

/**
 * Pastes into the end of the document, the way a browser would. `data` maps
 * clipboard types to content, for example `{ 'text/html': '<b>x</b>', 'text/plain': 'x' }`.
 */
export function paste(editor: PrimavistaEditor, data: Record<string, string>): void {
  if (!('ClipboardEvent' in globalThis)) Object.assign(globalThis, { ClipboardEvent });
  if (!('DragEvent' in globalThis)) Object.assign(globalThis, { DragEvent });
  editor.lexical.update(() => $getRoot().selectEnd(), { discrete: true });
  const transfer = {
    types: Object.keys(data),
    files: [],
    getData: (type: string) => data[type] ?? '',
  } as unknown as DataTransfer;
  editor.contentElement.dispatchEvent(new ClipboardEvent(transfer));
}

/**
 * Loads `html` into an editor with `plugins`, serializes it again and throws
 * when the result differs from `expected`, which defaults to `html`.
 */
export function expectRoundTrip(plugins: ReadonlyArray<PrimavistaPlugin>, html: string, expected: string = html): void {
  const { editor, container } = mount({ plugins });
  try {
    editor.setHtml(html);
    const actual = editor.getHtml();
    if (actual !== expected) {
      throw new Error(`Round trip changed the HTML.\nexpected: ${expected}\nactual:   ${actual}`);
    }
  } finally {
    editor.destroy();
    container.remove();
  }
}
