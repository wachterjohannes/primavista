import { $getRoot } from 'lexical';
import { $createTableSelection, $isTableNode } from '@lexical/table';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createEditor,
  formatting,
  history,
  internalLinks,
  links,
  type InternalLinkDialogState,
  type PrimavistaEditor,
} from '../src';
import { button, mount, selectAll, typeText } from './helpers';

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

const providers = [
  { key: 'page', label: 'Page' },
  { key: 'media', label: 'Media' },
];

function linkPlugins(openDialog?: (state: InternalLinkDialogState) => void) {
  const options = openDialog ? { providers, openDialog } : { providers };
  return [history(), formatting(), links(), internalLinks(options)];
}

describe('internal links', () => {
  it('round-trips internal-link markup', () => {
    const html =
      '<p>See <internal-link href="abc-123?x=1#top" provider="page" target="_self" title="Home" validation-state="unpublished">home</internal-link>.</p>';
    const { editor } = setup({ initialHtml: html, plugins: linkPlugins() });
    expect(editor.getHtml()).toBe(html);
    const anchor = editor.contentElement.querySelector('a.pv-internal-link')!;
    expect(anchor.getAttribute('data-provider')).toBe('page');
    expect(anchor.getAttribute('data-validation-state')).toBe('unpublished');
    expect(anchor.getAttribute('data-href')).toBe('abc-123?x=1#top');
  });

  it('offers one menu entry per provider and creates a link through the dialog', () => {
    const openDialog = vi.fn();
    const { editor } = setup({ initialHtml: '<p>Contact</p>', plugins: linkPlugins(openDialog) });
    selectAll(editor);
    const menu = button(editor, 'internal-link');
    expect(menu.disabled).toBe(false);
    menu.click();
    const entries = Array.from(editor.toolbar.element.querySelectorAll<HTMLButtonElement>('.pv-menu-item'));
    expect(entries.map((e) => e.textContent)).toEqual(['Page', 'Media']);
    entries[1]!.click();
    expect(openDialog).toHaveBeenCalledOnce();
    const state = openDialog.mock.calls[0]![0] as InternalLinkDialogState;
    expect(state.mode).toBe('create');
    expect(state.provider).toBe('media');
    expect(state.selectedText).toBe('Contact');
    state.apply({ href: 42, query: 'v=2', anchor: 'sec', target: '_blank', title: 'Brochure' });
    expect(editor.getHtml()).toBe(
      '<p><internal-link href="42?v=2#sec" provider="media" target="_blank" title="Brochure">Contact</internal-link></p>',
    );
    expect(menu.disabled).toBe(true);
  });

  it('inserts the resource text when nothing is selected', () => {
    const openDialog = vi.fn();
    const { editor } = setup({ initialHtml: '<p>Read</p>', plugins: linkPlugins(openDialog) });
    typeText(editor, ' ');
    button(editor, 'internal-link').click();
    editor.toolbar.element.querySelector<HTMLButtonElement>('.pv-menu-item')!.click();
    const state = openDialog.mock.calls[0]![0] as InternalLinkDialogState;
    expect(state.collapsed).toBe(true);
    state.apply({ href: 'uuid-1', text: 'the page' });
    expect(editor.getHtml()).toBe('<p>Read <internal-link href="uuid-1" provider="page">the page</internal-link></p>');
  });

  it('edits and removes through the balloon and resets the validation state', () => {
    const openDialog = vi.fn();
    const { editor } = setup({
      initialHtml: '<p><internal-link href="old" provider="page" validation-state="removed">x</internal-link></p>',
      plugins: linkPlugins(openDialog),
    });
    selectAll(editor);
    const balloon = editor.element.querySelector<HTMLElement>('.pv-balloon')!;
    expect(balloon.hidden).toBe(false);
    expect(balloon.querySelector('.pv-balloon-label')?.textContent).toBe('Page: old');
    balloon.querySelector<HTMLButtonElement>('[data-pv-balloon-action="edit"]')!.click();
    const state = openDialog.mock.calls[0]![0] as InternalLinkDialogState;
    expect(state.mode).toBe('edit');
    expect(state.href).toBe('old');
    state.apply({ href: 'new', anchor: 'a' });
    expect(editor.getHtml()).toBe('<p><internal-link href="new#a" provider="page">x</internal-link></p>');

    selectAll(editor);
    balloon.querySelector<HTMLButtonElement>('[data-pv-balloon-action="unlink"]')!.click();
    expect(editor.getHtml()).toBe('<p>x</p>');
  });

  it('uses the built-in panel without a dialog', () => {
    const { editor } = setup({ initialHtml: '<p>Doc</p>', plugins: linkPlugins() });
    selectAll(editor);
    button(editor, 'internal-link').click();
    editor.toolbar.element.querySelector<HTMLButtonElement>('.pv-menu-item')!.click();
    const form = editor.element.querySelector<HTMLFormElement>('.pv-link-form')!;
    form.querySelector<HTMLInputElement>('[aria-label="Resource id"]')!.value = 'p-1';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(editor.getHtml()).toBe('<p><internal-link href="p-1" provider="page">Doc</internal-link></p>');
  });

  it('keeps external and internal links apart', () => {
    const { editor } = setup({
      initialHtml: '<p><a href="https://x.example">ext</a> and <internal-link href="1" provider="page">int</internal-link></p>',
      plugins: linkPlugins(),
    });
    expect(editor.getHtml()).toBe(
      '<p><a href="https://x.example">ext</a> and <internal-link href="1" provider="page">int</internal-link></p>',
    );
  });
});

describe('alignment', () => {
  it('round-trips text-align styles', () => {
    const html = '<p style="text-align: center;">Mid</p><h2 style="text-align: right;">Right</h2>';
    const { editor } = setup({ initialHtml: html });
    expect(editor.getHtml()).toBe(html);
  });

  it('toggles alignment from the toolbar', () => {
    const { editor } = setup({ initialHtml: '<p>Text</p>' });
    selectAll(editor);
    const center = button(editor, 'align-center');
    center.click();
    expect(editor.getHtml()).toBe('<p style="text-align: center;">Text</p>');
    expect(center.getAttribute('aria-pressed')).toBe('true');
    center.click();
    expect(editor.getHtml()).toBe('<p>Text</p>');
  });
});

describe('inline formats', () => {
  it('applies subscript, superscript and code', () => {
    const { editor } = setup({ initialHtml: '<p>x</p>' });
    selectAll(editor);
    button(editor, 'superscript').click();
    expect(editor.getHtml()).toBe('<p><sup>x</sup></p>');
    button(editor, 'superscript').click();
    button(editor, 'code').click();
    expect(editor.getHtml()).toBe('<p><code>x</code></p>');
  });
});

describe('table cells', () => {
  it('merges and splits cells', () => {
    const { editor } = setup({
      initialHtml: '<table><tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></tbody></table>',
    });
    editor.lexical.update(
      () => {
        const table = $getRoot().getFirstChild();
        if (!$isTableNode(table)) throw new Error('no table');
        const rows = table.getChildren();
        const first = (rows[0] as { getFirstChild(): { getKey(): string } }).getFirstChild();
        const second = (rows[0] as { getLastChild(): { getKey(): string } }).getLastChild();
        const selection = $createTableSelection();
        selection.set(table.getKey(), first.getKey(), second.getKey());
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).__pv_setSelection = selection;
      },
      { discrete: true },
    );
    editor.lexical.update(
      () => {
        const { $setSelection } = require('lexical') as typeof import('lexical');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        $setSelection((globalThis as any).__pv_setSelection);
      },
      { discrete: true },
    );
    const merge = button(editor, 'table-merge-cells');
    expect(merge.hidden).toBe(false);
    expect(merge.disabled).toBe(false);
    merge.click();
    expect(editor.getHtml()).toBe(
      '<table><tbody><tr><td colspan="2"><p>a</p><p>b</p></td></tr><tr><td>c</td><td>d</td></tr></tbody></table>',
    );
    const split = button(editor, 'table-split-cell');
    expect(split.disabled).toBe(false);
    split.click();
    expect(editor.getHtml()).toBe(
      '<table><tbody><tr><td><p>a</p><p>b</p></td><td></td></tr><tr><td>c</td><td>d</td></tr></tbody></table>',
    );
  });
});

describe('typing helpers', () => {
  it('keeps working with the default plugins', () => {
    const { editor } = setup();
    typeText(editor, 'Hello');
    expect(editor.getHtml()).toBe('<p>Hello</p>');
    expect(createEditor).toBeTypeOf('function');
  });
});
