import { afterEach, describe, expect, it } from 'vitest';
import { defaultPlugins, inlineElement, type PrimavistaEditor, type SelectionInfo } from '../src';
import { mount, selectAll } from '../src/testing';

const mark = inlineElement({ name: 'mark', tag: 'mark', toolbar: { label: 'Mark' } });
let active: ReturnType<typeof mount> | null = null;

function setup(html: string): PrimavistaEditor {
  active = mount({ plugins: [...defaultPlugins(), mark], initialHtml: html });
  return active.editor;
}

afterEach(() => {
  active?.editor.destroy();
  active?.container.remove();
  active = null;
});

describe('getSelection', () => {
  it('describes the selection in HTML terms', () => {
    const editor = setup('<h2>Title <strong><mark>key</mark></strong></h2>');
    selectAll(editor);
    const selection = editor.getSelection();
    expect(selection?.collapsed).toBe(false);
    expect(selection?.text).toBe('Title key');
    expect(selection?.block).toBe('h2');
    selectAll(editor);
  });

  it('lists helper elements around the anchor and the formats', () => {
    const editor = setup('<p><strong><mark>key</mark></strong></p>');
    selectAll(editor);
    const selection = editor.getSelection();
    expect(selection?.ancestors.map((ancestor) => ancestor.tag)).toEqual(['mark', 'p']);
    expect(selection?.formats).toContain('bold');
    expect(selection?.block).toBe('p');
  });

  it('is null without a selection and works inside a read', () => {
    const editor = setup('<p>a</p>');
    editor.lexical.update(() => undefined, { discrete: true });
    expect(editor.lexical.read(() => editor.getSelection())).toBeNull();
  });
});

describe('selectionchange', () => {
  it('fires when the selection changes and not when it stays the same', () => {
    const editor = setup('<p>one two</p>');
    const seen: Array<SelectionInfo | null> = [];
    const off = editor.on('selectionchange', (selection) => seen.push(selection));
    selectAll(editor);
    expect(seen.at(-1)?.text).toBe('one two');
    const count = seen.length;
    selectAll(editor);
    expect(seen.length).toBe(count);
    off();
    editor.setHtml('<p>x</p>');
    selectAll(editor);
    expect(seen.length).toBe(count);
  });
});
