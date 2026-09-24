import { $getRoot, $isElementNode, $isTextNode, type LexicalNode } from 'lexical';
import { createEditor, type InternalLinkDialogState, type PrimavistaEditor } from '@primavista/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  htmlToSuluValue,
  stripParagraphs,
  SULU_DEFAULT_FORMATS,
  suluLinks,
  suluPlugins,
  suluPreset,
  suluTranslationKey,
  suluValueToHtml,
  wrapParagraphs,
} from '../src';

const providers = [
  { key: 'page', label: 'Page' },
  { key: 'media', label: 'Media' },
];

let active: { editor: PrimavistaEditor; container: HTMLElement } | null = null;

function mount(options: Parameters<typeof createEditor>[1] = {}): { editor: PrimavistaEditor; container: HTMLElement } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  active = { editor: createEditor(container, options), container };
  return active;
}

afterEach(() => {
  active?.editor.destroy();
  active?.container.remove();
  active = null;
});

function selectAll(editor: PrimavistaEditor): void {
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
        const selection = first.select(0, 0);
        selection.focus.set(last.getKey(), last.getTextContentSize(), 'text');
      }
    },
    { discrete: true },
  );
}

describe('sulu links', () => {
  it('round-trips sulu-link markup with the validation state', () => {
    const html =
      '<p>See <sulu-link href="abc-123?x=1#top" provider="page" target="_self" title="Home" sulu-validation-state="unpublished">home</sulu-link>.</p>';
    const { editor } = mount({ initialHtml: html, plugins: [suluLinks({ providers })] });
    expect(editor.getHtml()).toBe(html);
    const anchor = editor.contentElement.querySelector('a.pv-internal-link')!;
    expect(anchor.getAttribute('data-provider')).toBe('page');
    expect(anchor.getAttribute('data-validation-state')).toBe('unpublished');
  });

  it('writes _self on new links and hands the dialog to the host', () => {
    const openDialog = vi.fn();
    const { editor } = mount({ initialHtml: '<p>Contact</p>', plugins: [suluLinks({ providers, openDialog })] });
    selectAll(editor);
    editor.toolbar.element.querySelector<HTMLButtonElement>('[data-pv-item="internal-link"]')!.click();
    editor.toolbar.element.querySelector<HTMLButtonElement>('.pv-menu [data-pv-option="media"]')!.click();
    const state = openDialog.mock.calls[0]![0] as InternalLinkDialogState;
    expect(state.target).toBe('_self');
    state.apply({ href: 42, anchor: 'sec', target: state.target, title: 'Brochure' });
    expect(editor.getHtml()).toBe('<p><sulu-link href="42#sec" provider="media" target="_self" title="Brochure">Contact</sulu-link></p>');
  });
});

describe('sulu plugins', () => {
  it('builds the toolbar of the CKEditor configuration in order', () => {
    const { editor } = mount({ plugins: suluPlugins({ providers }) });
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
      'internal-link',
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
    const levels = Array.from(editor.toolbar.element.querySelectorAll<HTMLOptionElement>('[data-pv-item="block-type"] option')).map((o) => o.value);
    expect(levels).toEqual(['paragraph', ...SULU_DEFAULT_FORMATS]);
  });

  it('takes the formats option and demotes other headings', () => {
    const { editor } = mount({ initialHtml: '<h3>Three</h3>', plugins: suluPlugins({ providers, formats: ['h1', 'h2'] }) });
    const levels = Array.from(editor.toolbar.element.querySelectorAll<HTMLOptionElement>('[data-pv-item="block-type"] option')).map((o) => o.value);
    expect(levels).toEqual(['paragraph', 'h1', 'h2']);
    expect(editor.getHtml()).toBe('<p>Three</p>');
  });
});

describe('sulu preset', () => {
  it('writes CKEditor markup and uses the sulu theme', () => {
    const ck = '<figure class="table"><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table></figure>';
    const { editor } = mount({ initialHtml: ck, ...suluPreset() });
    expect(editor.getHtml()).toBe(ck);
    expect(editor.element.classList.contains('pv-theme-sulu')).toBe(true);
  });
});

describe('enter mode and value mapping', () => {
  it('matches the Sulu algorithm', () => {
    expect(stripParagraphs('<p>only</p>')).toBe('only');
    expect(stripParagraphs('<p>a</p><p>b</p>')).toBe('<!--p-->a<!--/p--><br></br><!--p-->b<!--/p-->');
    expect(wrapParagraphs('only')).toBe('<p>only</p>');
    expect(wrapParagraphs('<!--p-->a<!--/p--><br></br><!--p-->b<!--/p-->')).toBe('<p>a</p><p>b</p>');
    expect(wrapParagraphs(stripParagraphs('<p>a <strong>b</strong></p><p>c</p>'))).toBe('<p>a <strong>b</strong></p><p>c</p>');
  });

  it('maps empty values both ways', () => {
    expect(suluValueToHtml(undefined)).toBe('');
    expect(suluValueToHtml('<p>x</p>')).toBe('<p>x</p>');
    expect(suluValueToHtml('a<br></br>', 'br')).toBe('<p>a<br></br></p>');
    expect(htmlToSuluValue('')).toBeUndefined();
    expect(htmlToSuluValue('<p>a</p><p>b</p>', 'br')).toBe('<!--p-->a<!--/p--><br></br><!--p-->b<!--/p-->');
  });

  it('prefixes translation keys', () => {
    expect(suluTranslationKey('toolbar.bold')).toBe('sulu_admin.primavista.toolbar.bold');
  });
});
