import { $getRoot, $isElementNode, $isTextNode, PASTE_COMMAND, type LexicalNode } from 'lexical';
import { createEditor, type InternalLinkDialogState, type PrimavistaEditor } from '@primavista/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  htmlToSuluValue,
  stripParagraphs,
  SULU_DEFAULT_CONFIG,
  SULU_DEFAULT_FORMATS,
  SULU_MINI_CONFIG,
  suluConfigFromLegacyOptions,
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

function ids(editor: PrimavistaEditor): string[] {
  return Array.from(editor.toolbar.element.querySelectorAll('[data-pv-item]')).map((el) => el.getAttribute('data-pv-item') ?? '');
}

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

/** A paste event as far as the paste cleanup reads it. */
function clipboardEvent(data: Record<string, string>): ClipboardEvent {
  const clipboardData = { types: Object.keys(data), files: [], getData: (type: string) => data[type] ?? '' };
  return { clipboardData, preventDefault: () => {} } as unknown as ClipboardEvent;
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
  it('builds the toolbar of the default config in the order of the CKEditor toolbar', () => {
    const { editor } = mount({ plugins: suluPlugins({ providers }) });
    expect(ids(editor)).toEqual([
      'undo',
      'redo',
      'block-type',
      'bold',
      'italic',
      'underline',
      'strikethrough',
      'subscript',
      'superscript',
      'code',
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

  it('switches plugins on and off per tag and attribute', () => {
    const { editor } = mount({ plugins: suluPlugins({ providers, config: SULU_MINI_CONFIG }) });
    expect(ids(editor)).toEqual(['undo', 'redo', 'bold', 'italic', 'link', 'internal-link']);
  });

  it('adds alignment for the style attribute and the earlier align key', () => {
    for (const attribute of ['style', 'align']) {
      const names = suluPlugins({ providers, config: { ...SULU_MINI_CONFIG, attributes: [attribute] } }).map((p) => p.name);
      expect(names).toContain('alignment');
    }
    expect(suluPlugins({ providers, config: SULU_MINI_CONFIG }).map((p) => p.name)).not.toContain('alignment');
  });

  it('adds autoformat only on request', () => {
    expect(suluPlugins({ providers }).map((p) => p.name)).not.toContain('autoformat');
    expect(suluPlugins({ providers, autoformat: true }).map((p) => p.name)).toContain('autoformat');
    expect(suluPlugins({ providers, autoformat: { inline: false } }).map((p) => p.name)).toContain('autoformat');
  });

  it('adds the language menu for the lang attribute with the given languages', () => {
    const config = { ...SULU_DEFAULT_CONFIG, tags: ['ol', 'strong'], attributes: ['lang'] };
    const { editor } = mount({
      initialHtml: '<p>Hallo</p>',
      plugins: suluPlugins({ providers, config, languages: [{ code: 'de-AT', label: 'Deutsch (Österreich)' }] }),
    });
    expect(ids(editor)).toEqual(['undo', 'redo', 'bold', 'numbered-list', 'language']);
    selectAll(editor);
    editor.toolbar.element.querySelector<HTMLButtonElement>('[data-pv-item="language"]')!.click();
    const entries = Array.from(editor.toolbar.element.querySelectorAll<HTMLButtonElement>('.pv-menu-item')).map((e) => e.textContent);
    expect(entries).toEqual(['Deutsch (Österreich)', 'Remove language']);
    editor.toolbar.element.querySelector<HTMLButtonElement>('.pv-menu [data-pv-option="de-AT"]')!.click();
    expect(editor.getHtml()).toBe('<p><span lang="de-AT">Hallo</span></p>');
  });

  it('cleans pasted content down to what the config allows', () => {
    const { editor } = mount({ plugins: suluPlugins({ providers, config: SULU_MINI_CONFIG }) });
    editor.lexical.update(() => $getRoot().selectEnd(), { discrete: true });
    const html =
      '<h2 class="title">Title</h2><p style="text-align:center"><span style="font-weight:700">Bold</span>, <u>underlined</u> and ' +
      '<span style="font-style:italic">italic</span></p><ul><li>Item</li></ul>';
    editor.lexical.dispatchCommand(PASTE_COMMAND, clipboardEvent({ 'text/html': html, 'text/plain': 'Title' }));
    expect(editor.getHtml()).toBe('<p>Title</p><p><strong>Bold</strong>, underlined and <em>italic</em></p><p>Item</p>');
  });

  it('keeps sulu links when only HTML is on the clipboard', () => {
    const { editor } = mount({ plugins: suluPlugins({ providers, config: SULU_DEFAULT_CONFIG }) });
    editor.lexical.update(() => $getRoot().selectEnd(), { discrete: true });
    const html = '<p>See <sulu-link href="abc-123" provider="page" target="_self" sulu-validation-state="unpublished">home</sulu-link>.</p>';
    editor.lexical.dispatchCommand(PASTE_COMMAND, clipboardEvent({ 'text/html': html, 'text/plain': 'See home.' }));
    expect(editor.getHtml()).toBe(html);
  });

  it('maps the legacy formats and enter_mode params to a config', () => {
    expect(suluConfigFromLegacyOptions({})).toEqual(SULU_DEFAULT_CONFIG);
    expect(suluConfigFromLegacyOptions({ formats: ['h1', 'h2', 'table'], enterMode: 'br' })).toEqual({
      enterMode: 'br',
      attributes: ['style'],
      tags: ['strong', 'i', 'u', 's', 'sub', 'sup', 'ul', 'ol', 'a', 'table', 'code', 'h1', 'h2'],
    });
    expect(suluConfigFromLegacyOptions({ formats: [] }).tags).toEqual(SULU_DEFAULT_CONFIG.tags);
    const { editor } = mount({
      initialHtml: '<h3>Three</h3>',
      plugins: suluPlugins({ providers, config: suluConfigFromLegacyOptions({ formats: ['h1', 'h2'] }) }),
    });
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
