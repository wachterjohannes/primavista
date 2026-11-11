import { afterEach, describe, expect, it } from 'vitest';
import { blockElement, cleanPastedHtml, defaultPlugins, getSchema, inlineElement, voidElement, type PrimavistaEditor } from '../src';
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
        { tag: 'mark', kind: 'inline', attributes: [] },
        { tag: 'abbr', kind: 'inline', attributes: ['title'] },
      ],
    });
  });

  it('cleans pasted HTML with the elements option', () => {
    expect(cleanPastedHtml('<p><mark class="x">a</mark></p>', { elements: [{ tag: 'mark' }] })).toBe('<p><mark style="display: inline;">a</mark></p>');
  });

describe('matching', () => {
  it('refuses to claim a generic tag without a class or attribute', () => {
    expect(() => inlineElement({ name: 'x', tag: 'span' })).toThrow(/other content uses too/);
  });

  it('leaves other spans alone and keeps their lang', () => {
    const lead = inlineElement({ name: 'lead', tag: 'span', className: 'lead', toolbar: false });
    const editor = setup([...defaultPlugins(), lead]);
    editor.setHtml('<p><span class="lead">a</span> <span lang="fr">b</span> <span class="other">c</span></p>');
    expect(editor.getHtml()).toBe('<p><span class="lead">a</span> b c</p>');
  });

  it('tells two helpers with the same tag apart', () => {
    const yellow = inlineElement({ name: 'yellow', tag: 'mark', className: 'yellow', toolbar: false });
    const green = inlineElement({ name: 'green', tag: 'mark', className: 'green', toolbar: false });
    const editor = setup([...defaultPlugins(), yellow, green]);
    const html = '<p><mark class="yellow">a</mark> <mark class="green">b</mark></p>';
    editor.setHtml(html);
    expect(editor.getHtml()).toBe(html);
    paste(editor, { 'text/html': '<p><mark class="green">c</mark><mark class="yellow">d</mark></p>', 'text/plain': 'cd' });
    expect(editor.getHtml()).toBe('<p><mark class="yellow">a</mark> <mark class="green">bc</mark><mark class="yellow">d</mark></p>');
  });
});
});

describe('attribute form', () => {
  const abbrWithButton = inlineElement({ name: 'abbr', tag: 'abbr', attributes: ['title'], toolbar: { label: 'Abbreviation' } });

  const form = (editor: PrimavistaEditor): HTMLFormElement | null => editor.element.querySelector('form.pv-link-form');
  const submit = (editor: PrimavistaEditor, value: string): void => {
    const input = form(editor)?.querySelector('input');
    if (!input) throw new Error('no attribute form');
    input.value = value;
    form(editor)?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  };

  it('asks for the title and wraps the selection with it', () => {
    const editor = setup([...defaultPlugins(), abbrWithButton]);
    editor.setHtml('<p>HTML</p>');
    selectAll(editor);
    button(editor, 'abbr').click();
    submit(editor, 'Hypertext Markup Language');
    expect(editor.getHtml()).toBe('<p><abbr title="Hypertext Markup Language">HTML</abbr></p>');
    expect(form(editor)).toBeNull();
  });

  it('wraps nothing when the title stays empty', () => {
    const editor = setup([...defaultPlugins(), abbrWithButton]);
    editor.setHtml('<p>HTML</p>');
    selectAll(editor);
    button(editor, 'abbr').click();
    submit(editor, '  ');
    expect(editor.getHtml()).toBe('<p>HTML</p>');
  });

  it('edits and removes an existing element', () => {
    const editor = setup([...defaultPlugins(), abbrWithButton]);
    editor.setHtml('<p><abbr title="Old">HTML</abbr></p>');
    selectAll(editor);
    button(editor, 'abbr').click();
    expect(form(editor)?.querySelector('input')?.value).toBe('Old');
    submit(editor, 'New');
    expect(editor.getHtml()).toBe('<p><abbr title="New">HTML</abbr></p>');
    button(editor, 'abbr').click();
    form(editor)?.querySelector<HTMLButtonElement>('button[type="button"]')?.click();
    expect(editor.getHtml()).toBe('<p>HTML</p>');
  });

  it('keeps the one-click toggle for elements without attributes', () => {
    const editor = setup();
    editor.setHtml('<p>plain</p>');
    selectAll(editor);
    button(editor, 'mark').click();
    expect(form(editor)).toBeNull();
    expect(editor.getHtml()).toBe('<p><mark>plain</mark></p>');
  });

  it('refuses tags and attributes that never belong in content', () => {
    expect(() => inlineElement({ name: 'x', tag: 'script' })).toThrow(/cannot claim <script>/);
    expect(() => inlineElement({ name: 'x', tag: 'mark', attributes: ['onclick'] })).toThrow(/cannot keep the attribute/);
    expect(() => inlineElement({ name: 'x', tag: 'mark', attributes: ['style'] })).toThrow(/cannot keep the attribute/);
    expect(() => blockElement({ name: 'y', tag: 'iframe' })).toThrow(/cannot claim <iframe>/);
    expect(() => voidElement({ name: 'z', tag: 'embed' })).toThrow(/cannot claim <embed>/);
  });
});
