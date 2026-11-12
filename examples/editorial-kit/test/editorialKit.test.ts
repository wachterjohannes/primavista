import { defaultPlugins, type PrimavistaEditor } from '@primavista/core';
import { button, expectRoundTrip, mount, paste, selectAll } from '@primavista/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { editorialKit } from '../src';

let active: ReturnType<typeof mount> | null = null;

function setup(html = ''): PrimavistaEditor {
  active = mount({ plugins: [...defaultPlugins(), ...editorialKit()], initialHtml: html });
  return active.editor;
}

afterEach(() => {
  active?.editor.destroy();
  active?.container.remove();
  active = null;
});

const menuEntry = (editor: PrimavistaEditor, label: string): HTMLButtonElement => {
  const entry = Array.from(editor.toolbar.element.querySelectorAll<HTMLButtonElement>('.pv-menu-item')).find((el) => el.textContent === label);
  if (!entry) throw new Error(`menu entry ${label} not found`);
  return entry;
};

describe('editorial kit', () => {
  it('keeps all its markup through a round trip', () => {
    expectRoundTrip(
      [...defaultPlugins(), ...editorialKit()],
      '<p><mark class="yellow">a</mark> <mark class="green">b</mark> <abbr title="Hypertext">HTML</abbr> <kbd>Esc</kbd></p>' +
        '<aside class="note"><p>Read this</p></aside><div data-widget="newsletter"></div>',
    );
  });

  it('leaves other marks, asides and divs alone', () => {
    expectRoundTrip(
      [...defaultPlugins(), ...editorialKit()],
      '<p>a <mark>b</mark></p><aside><p>c</p></aside><div><p>d</p></div>',
      '<p>a b</p><p>c</p><p>d</p>',
    );
  });

  it('keeps its markup when pasted', () => {
    const editor = setup('<p>x</p>');
    paste(editor, { 'text/html': '<p><mark class="green" style="color:red">y</mark><kbd onclick="z()">k</kbd></p>', 'text/plain': 'yk' });
    expect(editor.getHtml()).toContain('<mark class="green">y</mark><kbd>k</kbd>');
  });

  it('wraps a selection in the green highlight', () => {
    const editor = setup('<p>text</p>');
    selectAll(editor);
    button(editor, 'highlight-green').click();
    expect(editor.getHtml()).toBe('<p><mark class="green">text</mark></p>');
  });

  it('inserts a snippet through the menu', () => {
    const editor = setup('<p>Price</p>');
    selectAll(editor);
    button(editor, 'snippets').click();
    menuEntry(editor, 'Disclaimer').click();
    expect(editor.getHtml()).toContain('<em>Prices include VAT.</em>');
  });

  it('inserts a special character and replaces the selection', () => {
    const editor = setup('<p>Section</p>');
    selectAll(editor);
    button(editor, 'special-characters').click();
    menuEntry(editor, '§').click();
    expect(editor.getHtml()).toBe('<p>§</p>');
  });

  it('changes the case of the selection and is disabled without one', () => {
    const editor = setup('<p>hello world</p>');
    expect(button(editor, 'text-case').disabled).toBe(true);
    selectAll(editor);
    editor.toolbar.refresh();
    expect(button(editor, 'text-case').disabled).toBe(false);
    button(editor, 'text-case').click();
    menuEntry(editor, 'Title Case').click();
    expect(editor.getHtml()).toBe('<p>Hello World</p>');
  });

  it('shows the title of an abbreviation in a balloon', () => {
    const editor = setup('<p><abbr title="Hypertext Markup Language">HTML</abbr></p>');
    const abbr = editor.contentElement.querySelector('abbr');
    abbr?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(editor.balloon.isOpen()).toBe(true);
    abbr?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    expect(editor.balloon.isOpen()).toBe(false);
  });

  it('keeps a reading time line up to date and removes it on destroy', () => {
    const editor = setup('<p>one two three</p>');
    const line = (): string | undefined => editor.element.querySelector('.reading-time')?.textContent ?? undefined;
    expect(line()).toBe('1 min read');
    editor.setHtml(`<p>${'word '.repeat(450)}</p>`);
    editor.insertText(' more');
    expect(line()).toBe('3 min read');
    editor.destroy();
    expect(editor.element.querySelector('.reading-time')).toBeNull();
  });
});
