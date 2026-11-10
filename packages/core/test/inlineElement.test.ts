import { afterEach, describe, expect, it } from 'vitest';
import { cleanPastedHtml, defaultPlugins, getSchema, inlineElement, type PrimavistaEditor } from '../src';
import { button, mount, paste, selectAll } from '../src/testing';

const mark = inlineElement({ name: 'mark', tag: 'mark', toolbar: { label: 'Highlight' } });
const abbr = inlineElement({ name: 'abbr', tag: 'abbr', attributes: ['title'], toolbar: false });

let active: ReturnType<typeof mount> | null = null;

function setup(plugins = [...defaultPlugins(), mark, abbr]): PrimavistaEditor {
  active = mount({ plugins });
  return active.editor;
}

afterEach(() => {
  active?.editor.destroy();
  active?.container.remove();
  active = null;
});

describe('inlineElement', () => {
  it('loads and writes the element with its declared attributes only', () => {
    const editor = setup();
    editor.setHtml('<p>An <abbr title="Hypertext" lang="en">HTML</abbr> and a <mark>marked</mark> word</p>');
    expect(editor.getHtml()).toBe('<p>An <abbr title="Hypertext">HTML</abbr> and a <mark>marked</mark> word</p>');
  });

  it('wraps the selection and unwraps it with a second click', () => {
    const editor = setup();
    editor.setHtml('<p>plain text</p>');
    selectAll(editor);
    button(editor, 'mark').click();
    expect(editor.getHtml()).toBe('<p><mark>plain text</mark></p>');
    selectAll(editor);
    button(editor, 'mark').click();
    expect(editor.getHtml()).toBe('<p>plain text</p>');
  });

  it('keeps the element when pasting', () => {
    const editor = setup();
    paste(editor, { 'text/html': '<p>a <mark style="color:red">b</mark> <abbr title="T" onclick="x()">c</abbr></p>', 'text/plain': 'a b c' });
    expect(editor.getHtml()).toBe('<p>a <mark>b</mark> <abbr title="T">c</abbr></p>');
  });

  it('drops the element when no plugin declares it', () => {
    const editor = setup(defaultPlugins());
    paste(editor, { 'text/html': '<p>a <mark>b</mark></p>', 'text/plain': 'a b' });
    expect(editor.getHtml()).toBe('<p>a b</p>');
  });

  it('reports its markup through getSchema', () => {
    expect(getSchema([mark, abbr])).toEqual({
      elements: [
        { tag: 'mark', attributes: [] },
        { tag: 'abbr', attributes: ['title'] },
      ],
    });
  });

  it('cleans pasted HTML with the elements option', () => {
    expect(cleanPastedHtml('<p><mark class="x">a</mark></p>', { elements: [{ tag: 'mark' }] })).toBe('<p><mark style="display: inline;">a</mark></p>');
  });
});
