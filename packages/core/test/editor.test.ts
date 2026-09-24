import { $getRoot } from 'lexical';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, formatting, history, type PrimavistaEditor } from '../src';
import { button, mount, select, selectAll, typeText } from './helpers';

let active: { editor: PrimavistaEditor; container: HTMLElement } | null = null;

function setup(options: Parameters<typeof mount>[0] = {}): { editor: PrimavistaEditor; container: HTMLElement } {
  active = mount(options);
  return active;
}

afterEach(() => {
  active?.editor.destroy();
  active?.container.remove();
  active = null;
});

describe('createEditor', () => {
  it('mounts toolbar and contenteditable', () => {
    const { editor, container } = setup();
    expect(container.querySelector('.pv-editor')).toBe(editor.element);
    expect(editor.contentElement.getAttribute('contenteditable')).toBe('true');
    expect(editor.toolbar.element.getAttribute('role')).toBe('toolbar');
    const ids = Array.from(editor.toolbar.element.querySelectorAll('[data-pv-item]')).map((el) => el.getAttribute('data-pv-item'));
    expect(ids).toEqual([
      'undo',
      'redo',
      'bold',
      'italic',
      'underline',
      'strikethrough',
      'subscript',
      'superscript',
      'code',
      'block-type',
      'bullet-list',
      'numbered-list',
      'link',
      'align-left',
      'align-center',
      'align-right',
      'align-justify',
      'insert-table',
      'table-row-after',
      'table-column-after',
      'table-row-delete',
      'table-column-delete',
      'table-merge-cells',
      'table-split-cell',
      'table-delete',
    ]);
  });

  it('reports emptiness and shows the placeholder', () => {
    const { editor, container } = setup({ placeholder: 'Write…' });
    const placeholder = container.querySelector<HTMLElement>('.pv-placeholder');
    expect(editor.isEmpty()).toBe(true);
    expect(placeholder?.hidden).toBe(false);
    typeText(editor, 'Hi');
    expect(editor.isEmpty()).toBe(false);
    expect(placeholder?.hidden).toBe(true);
  });

  it('emits change for edits but not for setHtml', () => {
    const { editor } = setup();
    const onChange = vi.fn();
    editor.on('change', onChange);
    editor.setHtml('<p>Loaded</p>');
    expect(onChange).not.toHaveBeenCalled();
    typeText(editor, '!');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('<p>Loaded!</p>');
    expect(editor.getHtml()).toBe('<p>Loaded!</p>');
  });

  it('does not emit change for selection-only updates', () => {
    const { editor } = setup({ initialHtml: '<p>Text</p>' });
    const onChange = vi.fn();
    editor.on('change', onChange);
    selectAll(editor);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('toggles bold through the toolbar and reflects the state', () => {
    const { editor } = setup({ initialHtml: '<p>Text</p>' });
    selectAll(editor);
    const bold = button(editor, 'bold');
    expect(bold.getAttribute('aria-pressed')).toBe('false');
    bold.click();
    expect(editor.getHtml()).toBe('<p><strong>Text</strong></p>');
    expect(bold.getAttribute('aria-pressed')).toBe('true');
    bold.click();
    expect(editor.getHtml()).toBe('<p>Text</p>');
  });

  it('switches block types through the select', () => {
    const { editor } = setup({ initialHtml: '<p>Title</p>' });
    selectAll(editor);
    const blockType = select(editor, 'block-type');
    expect(blockType.value).toBe('paragraph');
    blockType.value = 'h2';
    blockType.dispatchEvent(new Event('change'));
    expect(editor.getHtml()).toBe('<h2>Title</h2>');
    expect(blockType.value).toBe('h2');
    blockType.value = 'paragraph';
    blockType.dispatchEvent(new Event('change'));
    expect(editor.getHtml()).toBe('<p>Title</p>');
  });

  it('toggles lists', () => {
    const { editor } = setup({ initialHtml: '<p>Item</p>' });
    selectAll(editor);
    const bullets = button(editor, 'bullet-list');
    bullets.click();
    expect(editor.getHtml()).toBe('<ul><li>Item</li></ul>');
    expect(bullets.getAttribute('aria-pressed')).toBe('true');
    button(editor, 'numbered-list').click();
    expect(editor.getHtml()).toBe('<ol><li>Item</li></ol>');
    button(editor, 'numbered-list').click();
    expect(editor.getHtml()).toBe('<p>Item</p>');
  });

  it('inserts a table with a header row and shows table actions only inside tables', () => {
    const { editor } = setup({ initialHtml: '<p>Before</p>' });
    expect(button(editor, 'table-row-after').hidden).toBe(true);
    selectAll(editor);
    button(editor, 'insert-table').click();
    const html = editor.getHtml();
    expect(html).toContain('<table><tbody><tr><th></th><th></th><th></th></tr>');
    expect((html.match(/<tr>/g) ?? []).length).toBe(3);
    expect(button(editor, 'table-row-after').hidden).toBe(false);
    button(editor, 'table-row-after').click();
    expect((editor.getHtml().match(/<tr>/g) ?? []).length).toBe(4);
    button(editor, 'table-column-after').click();
    expect((editor.getHtml().match(/<th>/g) ?? []).length).toBe(4);
    button(editor, 'table-delete').click();
    expect(editor.getHtml()).not.toContain('<table>');
    expect(button(editor, 'table-row-after').hidden).toBe(true);
  });

  it('adds links through the panel and removes them through the balloon', () => {
    const { editor } = setup({ initialHtml: '<p>Site</p>' });
    selectAll(editor);
    const link = button(editor, 'link');
    expect(link.disabled).toBe(false);
    link.click();
    const input = editor.element.querySelector<HTMLInputElement>('.pv-link-form input');
    expect(input).not.toBeNull();
    input!.value = 'https://sulu.io';
    input!.form!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(editor.getHtml()).toBe('<p><a href="https://sulu.io">Site</a></p>');
    expect(editor.element.querySelector('.pv-link-form')).toBeNull();

    selectAll(editor);
    expect(link.disabled).toBe(true);
    const balloon = editor.element.querySelector<HTMLElement>('.pv-balloon')!;
    expect(balloon.hidden).toBe(false);
    expect(balloon.querySelector('a.pv-balloon-preview')?.getAttribute('href')).toBe('https://sulu.io');
    balloon.querySelector<HTMLButtonElement>('[data-pv-balloon-action="unlink"]')!.click();
    expect(editor.getHtml()).toBe('<p>Site</p>');
    expect(balloon.hidden).toBe(true);
  });

  it('edits link target and title through the balloon', () => {
    const { editor } = setup({ initialHtml: '<p><a href="https://a.example">Site</a></p>' });
    selectAll(editor);
    const balloon = editor.element.querySelector<HTMLElement>('.pv-balloon')!;
    balloon.querySelector<HTMLButtonElement>('[data-pv-balloon-action="edit"]')!.click();
    const form = editor.element.querySelector<HTMLFormElement>('.pv-link-form')!;
    const url = form.querySelector<HTMLInputElement>('[aria-label="Link URL"]')!;
    expect(url.value).toBe('https://a.example');
    url.value = 'https://b.example';
    form.querySelector<HTMLSelectElement>('[aria-label="Link target"]')!.value = '_blank';
    form.querySelector<HTMLInputElement>('[aria-label="Link title"]')!.value = 'Bee';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(editor.getHtml()).toBe('<p><a href="https://b.example" target="_blank" title="Bee">Site</a></p>');
  });

  it('inserts the URL as text when nothing is selected', () => {
    const { editor } = setup({ initialHtml: '<p>Go</p>' });
    typeText(editor, ' ');
    button(editor, 'link').click();
    const input = editor.element.querySelector<HTMLInputElement>('.pv-link-form input')!;
    input.value = 'https://sulu.io';
    input.form!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(editor.getHtml()).toBe('<p>Go <a href="https://sulu.io">https://sulu.io</a></p>');
  });

  it('rejects javascript: urls', () => {
    const { editor } = setup({ initialHtml: '<p>Site</p>' });
    selectAll(editor);
    button(editor, 'link').click();
    const input = editor.element.querySelector<HTMLInputElement>('.pv-link-form input')!;
    input.value = 'javascript:alert(1)';
    input.form!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(editor.getHtml()).toBe('<p>Site</p>');
  });

  it('enables undo after an edit', () => {
    const { editor } = setup({ initialHtml: '<p>Text</p>' });
    const undo = button(editor, 'undo');
    expect(undo.disabled).toBe(true);
    typeText(editor, '!');
    expect(undo.disabled).toBe(false);
    undo.click();
    expect(editor.getHtml()).toBe('<p>Text</p>');
  });

  it('disables the toolbar when not editable', () => {
    const { editor } = setup({ initialHtml: '<p>Text</p>' });
    editor.setEditable(false);
    expect(button(editor, 'bold').disabled).toBe(true);
    expect(editor.element.classList.contains('pv-editor--readonly')).toBe(true);
    editor.setEditable(true);
    expect(editor.element.classList.contains('pv-editor--readonly')).toBe(false);
  });

  it('accepts a custom plugin set and rejects duplicate names', () => {
    const container = document.createElement('div');
    const editor = createEditor(container, { plugins: [formatting({ formats: ['bold'] })] });
    const ids = Array.from(editor.toolbar.element.querySelectorAll('[data-pv-item]')).map((el) => el.getAttribute('data-pv-item'));
    expect(ids).toEqual(['bold']);
    editor.destroy();
    expect(() => createEditor(container, { plugins: [history(), history()] })).toThrow(/registered twice/);
  });

  it('runs plugin registration and cleanup', () => {
    const cleanup = vi.fn();
    const register = vi.fn(() => cleanup);
    const container = document.createElement('div');
    const editor = createEditor(container, { plugins: [{ name: 'spy', register }] });
    expect(register).toHaveBeenCalledOnce();
    const context = register.mock.calls[0]![0];
    expect(context.editor).toBe(editor.lexical);
    expect(context.container).toBe(editor.element);
    editor.destroy();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(container.children.length).toBe(0);
  });

  it('translates toolbar labels through the hook', () => {
    const { editor } = setup({
      translate: (key, fallback) => (key === 'toolbar.bold' ? 'Fett' : key === 'toolbar.block-type.paragraph' ? 'Absatz' : fallback),
    });
    expect(button(editor, 'bold').getAttribute('aria-label')).toBe('Fett');
    expect(button(editor, 'italic').getAttribute('aria-label')).toBe('Italic');
    expect(select(editor, 'block-type').options[0]?.textContent).toBe('Absatz');
  });

  it('exposes the lexical editor for advanced use', () => {
    const { editor } = setup({ initialHtml: '<p>Text</p>' });
    const text = editor.lexical.read(() => $getRoot().getTextContent());
    expect(text).toBe('Text');
  });
});
