import { afterEach, describe, expect, it } from 'vitest';
import { blockElement, defaultPlugins, getSchema, voidElement, type PrimavistaEditor } from '../src';
import { button, mount, paste, selectAll } from '../src/testing';

const aside = blockElement({ name: 'aside', tag: 'aside', attributes: ['data-tone'], toolbar: { label: 'Aside' } });
const newsletter = voidElement({
  name: 'newsletter',
  tag: 'div',
  attributes: ['data-widget'],
  defaults: { 'data-widget': 'newsletter' },
  toolbar: { label: 'Newsletter' },
});

let active: ReturnType<typeof mount> | null = null;

function setup(plugins = [...defaultPlugins(), aside, newsletter]): PrimavistaEditor {
  active = mount({ plugins });
  return active.editor;
}

afterEach(() => {
  active?.editor.destroy();
  active?.container.remove();
  active = null;
});

describe('blockElement', () => {
  it('loads and writes the element around blocks with its attributes', () => {
    const editor = setup();
    editor.setHtml('<aside data-tone="info" class="x"><p>One</p><p>Two</p></aside>');
    expect(editor.getHtml()).toBe('<aside data-tone="info"><p>One</p><p>Two</p></aside>');
  });

  it('wraps the selected blocks and unwraps them with a second click', () => {
    const editor = setup();
    editor.setHtml('<p>One</p><p>Two</p>');
    selectAll(editor);
    button(editor, 'aside').click();
    expect(editor.getHtml()).toBe('<aside><p>One</p><p>Two</p></aside>');
    button(editor, 'aside').click();
    expect(editor.getHtml()).toBe('<p>One</p><p>Two</p>');
  });

  it('keeps the element when pasting', () => {
    const editor = setup();
    paste(editor, { 'text/html': '<aside data-tone="warn" style="color:red"><p>Note</p></aside>', 'text/plain': 'Note' });
    expect(editor.getHtml()).toContain('<aside data-tone="warn"><p>Note</p></aside>');
  });
});

describe('voidElement', () => {
  it('loads and writes the placeholder with its attributes', () => {
    const editor = setup();
    editor.setHtml('<p>Before</p><div data-widget="newsletter" class="x"></div><p>After</p>');
    expect(editor.getHtml()).toBe('<p>Before</p><div data-widget="newsletter"></div><p>After</p>');
  });

  it('inserts the placeholder with the default attributes', () => {
    const editor = setup();
    editor.setHtml('<p>Text</p>');
    selectAll(editor);
    button(editor, 'newsletter').click();
    expect(editor.getHtml()).toContain('<div data-widget="newsletter"></div>');
  });

  it('fills the element in the editor with render', () => {
    const preview = voidElement({
      name: 'preview',
      tag: 'div',
      requires: ['data-id'],
      render: (element, attributes) => {
        element.textContent = `Preview ${attributes['data-id']}`;
      },
      toolbar: false,
    });
    const editor = setup([...defaultPlugins(), preview]);
    editor.setHtml('<div data-id="7"></div>');
    expect(editor.contentElement.textContent).toContain('Preview 7');
    expect(editor.getHtml()).toBe('<div data-id="7"></div>');
  });

  it('keeps the placeholder when pasting', () => {
    const editor = setup();
    paste(editor, { 'text/html': '<p>a</p><div data-widget="newsletter" onclick="x()"></div>', 'text/plain': 'a' });
    expect(editor.getHtml()).toContain('<div data-widget="newsletter"></div>');
    expect(editor.getHtml()).not.toContain('onclick');
  });
});

describe('matching', () => {
  it('keeps the text of a div that is not a placeholder', () => {
    const editor = setup();
    editor.setHtml('<div><p>important text</p></div><div data-widget="newsletter"></div>');
    expect(editor.getHtml()).toBe('<p>important text</p><div data-widget="newsletter"></div>');
    paste(editor, { 'text/html': '<div><p>pasted text</p></div>', 'text/plain': 'pasted text' });
    expect(editor.getHtml()).toContain('pasted text');
  });

  it('refuses to claim a generic block tag without a class or attribute', () => {
    expect(() => blockElement({ name: 'x', tag: 'div' })).toThrow(/other content uses too/);
    expect(() => voidElement({ name: 'y', tag: 'div' })).toThrow(/other content uses too/);
  });

  it('tells block helpers with the same tag apart by class', () => {
    const info = blockElement({ name: 'info', tag: 'aside', className: 'info', toolbar: false });
    const warn = blockElement({ name: 'warn', tag: 'aside', className: 'warn', toolbar: false });
    const editor = setup([...defaultPlugins(), info, warn]);
    const html = '<aside class="info"><p>a</p></aside><aside class="warn"><p>b</p></aside>';
    editor.setHtml(html);
    expect(editor.getHtml()).toBe(html);
  });
});

describe('schema kinds', () => {
  it('reports the kind of every element', () => {
    expect(getSchema([aside, newsletter]).elements).toEqual([
      { tag: 'aside', kind: 'block', attributes: ['data-tone'] },
      { tag: 'div', kind: 'void', attributes: ['data-widget'], requires: ['data-widget'] },
    ]);
  });
});

describe('editor commands', () => {
  it('inserts text, HTML and reads the selection', () => {
    const editor = setup();
    editor.setHtml('<p>Hello</p>');
    selectAll(editor);
    expect(editor.getSelectedText()).toBe('Hello');
    editor.insertText('Bye ');
    expect(editor.getHtml()).toBe('<p>Bye </p>');
    editor.insertHtml('<strong>now</strong>');
    expect(editor.getHtml()).toBe('<p>Bye <strong>now</strong></p>');
  });

  it('inserts text at the end without a selection', () => {
    const editor = setup();
    editor.setHtml('<p>Hello</p>');
    editor.insertText(' there');
    expect(editor.getHtml()).toBe('<p>Hello there</p>');
  });

  it('toggles a format on the selection', () => {
    const editor = setup();
    editor.setHtml('<p>Hello</p>');
    selectAll(editor);
    editor.toggleFormat('bold');
    expect(editor.getHtml()).toBe('<p><strong>Hello</strong></p>');
  });
});
