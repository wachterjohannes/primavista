import { $getRoot, PASTE_COMMAND } from 'lexical';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  alignment,
  cleanPastedHtml,
  formatting,
  headings,
  history,
  internalLinks,
  language,
  links,
  lists,
  pasteCleanup,
  tables,
  type PrimavistaEditor,
} from '../src';
import { googleDocs, libreOffice, webPage, word } from './fixtures/paste';
import { mount } from './helpers';

describe('cleanPastedHtml', () => {
  it('cleans Word markup and turns list paragraphs into nested lists', () => {
    expect(cleanPastedHtml(word)).toBe(
      '<h1>Quarterly report</h1>' +
        '<p>Der Umsatz ist <strong>deutlich</strong> gestiegen, <em>vor allem</em> im <u>Export</u> nach Great Britain.</p>' +
        '<p style="text-align: center;">H<sub>2</sub>O und E=mc<sup>2</sup></p>' +
        '<ul><li>Erster Punkt<ul><li>Unterpunkt mit <strong>Fett</strong></li></ul></li><li>Zweiter Punkt</li></ul>' +
        '<ol><li>Schritt eins</li><li>Schritt zwei</li></ol>' +
        '<table><tr><td><p><strong>Region</strong></p></td><td><p style="text-align: right;"><strong>Umsatz</strong></p></td></tr>' +
        '<tr><td><p>Nord</p></td><td><p style="text-align: right;">1.200</p></td></tr></table>' +
        '<p>Mehr unter <a href="https://example.com/bericht">example.com</a>.</p>',
    );
  });

  it('maps Google Docs inline styles to elements and ignores the guid wrapper', () => {
    expect(cleanPastedHtml(googleDocs)).toBe(
      '<h2>Project plan</h2>' +
        '<p><strong>Bold</strong>, <em>italic</em>, <u>underlined</u> and <strong><em><s>struck</s></em></strong>. ' +
        'See <a href="https://docs.example.com/plan">the docs</a>.</p>' +
        '<ul><li>Alpha<ul><li>Alpha one</li></ul></li><li>Beta</li></ul>' +
        '<p style="text-align: center;">Centered x<sup>2</sup></p>',
    );
  });

  it('cleans LibreOffice markup', () => {
    expect(cleanPastedHtml(libreOffice)).toBe(
      '<h1>Überschrift</h1>' +
        '<p><strong>Fett</strong> und <em>kursiv</em> und <s>durch</s> und English words.</p>' +
        '<p style="text-align: center;">Zentriert</p>' +
        '<ol><li>Eins</li><li>Zwei</li></ol>' +
        '<table><tr><td><p>A1</p></td><td><p style="text-align: right;">B1</p></td></tr></table>',
    );
  });

  it('drops scripts, images, classes, ids and unsafe links from web pages', () => {
    expect(cleanPastedHtml(webPage)).toBe(
      '<h3>Intro</h3>' +
        '<p>Read the <a href="/docs/start" target="_blank" rel="noopener">guide</a>, not this. <strong>Done.</strong></p>' +
        '<p>A loose line</p>' +
        '<p>line one<br>line two</p>',
    );
  });

  it('keeps text parts in another language than the document with the language option', () => {
    const html = cleanPastedHtml(word, { language: true });
    expect(html).toContain('<h1><span lang="en-US">Quarterly report</span></h1>');
    expect(html).toContain('nach <span lang="en-GB">Great Britain</span>.');
    expect(cleanPastedHtml(libreOffice, { language: true })).toContain('und <span lang="en-GB">English words</span>.');
    // The document language itself is no text part.
    expect(cleanPastedHtml('<body lang="de-AT"><p><span lang="DE">Hallo</span></p></body>', { language: true })).toBe('<p>Hallo</p>');
  });

  it('turns list items into paragraphs without the bullet when lists are off', () => {
    const html = cleanPastedHtml(word, { lists: false });
    expect(html).toContain('<p>Erster Punkt</p><p>Unterpunkt mit <strong>Fett</strong></p><p>Zweiter Punkt</p><p>Schritt eins</p>');
    expect(html).not.toMatch(/[·§]|<[uo]l>/);
    expect(cleanPastedHtml(googleDocs, { lists: false })).toContain('<p>Alpha</p><p>Alpha one</p><p>Beta</p>');
  });

  it('flattens tables, headings, links and alignment when they are off', () => {
    const html = cleanPastedHtml(word, { tables: false, headings: false, links: false, alignment: false });
    expect(html).toContain('<p>Quarterly report</p>');
    expect(html).toContain('<p><strong>Region</strong></p><p><strong>Umsatz</strong></p><p>Nord</p><p>1.200</p>');
    expect(html).toContain('<p>Mehr unter example.com.</p>');
    expect(html).not.toMatch(/<table|<h1|<a |style=/);
  });

  it('keeps only the allowed inline formats', () => {
    expect(cleanPastedHtml(googleDocs, { formats: ['bold'] })).toContain(
      '<p><strong>Bold</strong>, italic, underlined and <strong>struck</strong>.',
    );
  });

  it('maps inline styles and legacy elements to format elements', () => {
    expect(cleanPastedHtml('<p><span style="font-weight: bold">a</span><span style="FONT-STYLE: italic">b</span><font color="red">c</font></p>')).toBe(
      '<p><strong>a</strong><em>b</em>c</p>',
    );
    expect(cleanPastedHtml('<p><b style="font-weight:normal">not bold</b> <span style="vertical-align: sub">2</span> <strike>old</strike></p>')).toBe(
      '<p>not bold <sub>2</sub> <s>old</s></p>',
    );
    expect(cleanPastedHtml('<p><strong>one</strong><b>two</b></p>')).toBe('<p><strong>onetwo</strong></p>');
  });

  it('does not underline link text that is underlined by style', () => {
    expect(cleanPastedHtml('<p><a href="https://example.com" style="text-decoration: underline"><u>kept</u> <span style="text-decoration:underline">dropped</span></a></p>')).toBe(
      '<p><a href="https://example.com"><u>kept</u> dropped</a></p>',
    );
  });

  it('keeps a pasted fragment inline', () => {
    expect(cleanPastedHtml('<meta charset="utf-8"><span style="color: rgb(0, 0, 0); font-family: Arial;">just <b>some</b> words</span>')).toBe(
      'just <strong>some</strong> words',
    );
  });

  it('drops empty paragraphs and trailing line breaks', () => {
    expect(cleanPastedHtml('<p class=MsoNormal><o:p>&nbsp;</o:p></p><p>Text<br></p><p>&nbsp;</p><p><br></p><br>')).toBe('<p>Text</p>');
  });

  it('detects ordered Word lists by their marker', () => {
    const item = (marker: string, text: string, level = 1) =>
      `<p class=MsoListParagraph style='mso-list:l3 level${level} lfo4'><span style='mso-list:Ignore'>${marker}<span>&nbsp;&nbsp;</span></span>${text}</p>`;
    expect(cleanPastedHtml(item('a)', 'A') + item('b)', 'B') + item('i.', 'Deep', 2))).toBe('<ol><li>A</li><li>B<ol><li>Deep</li></ol></li></ol>');
    expect(cleanPastedHtml(item('§', 'Square') + item('', 'Arrow'))).toBe('<ul><li>Square</li><li>Arrow</li></ul>');
  });

  it('joins the one-item lists Word Online writes', () => {
    const html =
      '<div class="ListContainerWrapper"><ul class="BulletListStyle1"><li class="OutlineElement" role="listitem"><p class="Paragraph"><span class="TextRun">One</span></p></li></ul></div>' +
      '<div class="ListContainerWrapper"><ul class="BulletListStyle1"><li class="OutlineElement" role="listitem"><p class="Paragraph"><span class="TextRun">Two</span></p></li></ul></div>';
    expect(cleanPastedHtml(html)).toBe('<ul><li>One</li><li>Two</li></ul>');
  });

  it('puts loose text next to blocks into a paragraph', () => {
    expect(cleanPastedHtml('<div>Intro<ul><li>Item</li></ul>Outro</div>')).toBe('<p>Intro</p><ul><li>Item</li></ul><p>Outro</p>');
  });

  it('keeps colspan, rowspan and cell alignment', () => {
    expect(cleanPastedHtml('<table><tr><th colspan="2" style="text-align:center">Head</th></tr><tr><td rowspan="1">A</td><td align="right">B</td></tr></table>')).toBe(
      '<table><tr><th colspan="2"><p style="text-align: center;">Head</p></th></tr><tr><td><p>A</p></td><td><p style="text-align: right;">B</p></td></tr></table>',
    );
  });
});

/** jsdom has no clipboard or drag events. Lexical tells events apart by constructor name, so the stand-ins carry the real names. */
class DragEvent extends Event {}

class ClipboardEvent extends Event {
  readonly clipboardData: DataTransfer;
  constructor(clipboardData: DataTransfer) {
    super('paste', { bubbles: true, cancelable: true });
    this.clipboardData = clipboardData;
  }
}

function clipboard(data: Record<string, string>): DataTransfer {
  return {
    types: Object.keys(data),
    files: [],
    getData: (type: string) => data[type] ?? '',
  } as unknown as DataTransfer;
}

describe('paste cleanup plugin', () => {
  let active: ReturnType<typeof mount> | null = null;

  beforeAll(() => {
    if (!('ClipboardEvent' in globalThis)) Object.assign(globalThis, { ClipboardEvent });
    if (!('DragEvent' in globalThis)) Object.assign(globalThis, { DragEvent });
  });

  afterEach(() => {
    active?.editor.destroy();
    active?.container.remove();
    active = null;
  });

  function setup(options: Parameters<typeof mount>[0]): PrimavistaEditor {
    active = mount(options);
    const { editor } = active;
    editor.lexical.update(() => $getRoot().selectEnd(), { discrete: true });
    return editor;
  }

  function paste(editor: PrimavistaEditor, data: Record<string, string>): ClipboardEvent {
    const event = new ClipboardEvent(clipboard(data));
    editor.contentElement.dispatchEvent(event);
    return event;
  }

  it('cleans HTML pasted into the default editor', () => {
    const editor = setup({});
    const event = paste(editor, { 'text/html': googleDocs, 'text/plain': 'Project plan' });
    expect(event.defaultPrevented).toBe(true);
    expect(editor.getHtml()).toBe(
      '<h2>Project plan</h2>' +
        '<p><strong>Bold</strong>, <em>italic</em>, <u>underlined</u> and <strong><em><s>struck</s></em></strong>. ' +
        'See <a href="https://docs.example.com/plan">the docs</a>.</p>' +
        '<ul><li>Alpha<ul><li>Alpha one</li></ul></li><li>Beta</li></ul>' +
        '<p style="text-align: center;">Centered x<sup>2</sup></p>',
    );
  });

  it('pastes Word lists and tables as editor content', () => {
    const editor = setup({});
    paste(editor, { 'text/html': word, 'text/plain': 'Quarterly report' });
    const html = editor.getHtml();
    expect(html).toContain('<ul><li>Erster Punkt<ul><li>Unterpunkt mit <strong>Fett</strong></li></ul></li><li>Zweiter Punkt</li></ul>');
    expect(html).toContain('<table><tbody><tr><td><strong>Region</strong></td><td style="text-align: right;"><strong>Umsatz</strong></td></tr>');
    expect(html).not.toMatch(/class=|mso-|<span|<o:p/);
  });

  it('inserts a fragment inline at the caret', () => {
    const editor = setup({ initialHtml: '<p>Start</p>' });
    paste(editor, { 'text/html': '<span style="font-weight: 700; color: red">bold words</span>', 'text/plain': 'bold words' });
    expect(editor.getHtml()).toBe('<p>Start<strong>bold words</strong></p>');
  });

  it('follows the registered plugins', () => {
    const editor = setup({ plugins: [history(), formatting({ formats: ['bold'] }), pasteCleanup()] });
    paste(editor, { 'text/html': googleDocs, 'text/plain': 'Project plan' });
    expect(editor.getHtml()).toBe(
      '<p>Project plan</p>' +
        '<p><strong>Bold</strong>, italic, underlined and <strong>struck</strong>. See the docs.</p>' +
        '<p>Alpha</p><p>Alpha one</p><p>Beta</p><p>Centered x2</p>',
    );
  });

  it('keeps internal links and drops ones with a scheme', () => {
    const providers = [{ key: 'page', label: 'Page' }];
    const editor = setup({ plugins: [history(), links(), internalLinks({ providers }), pasteCleanup()] });
    paste(editor, {
      'text/html':
        '<p>See <internal-link href="abc?x=1#top" provider="page" target="_self" title="Home" validation-state="unpublished" onclick="x()">home</internal-link>' +
        ' and <internal-link href="javascript:alert(1)" provider="page">bad</internal-link></p>',
      'text/plain': 'See home and bad',
    });
    expect(editor.getHtml()).toBe(
      '<p>See <internal-link href="abc?x=1#top" provider="page" target="_self" title="Home" validation-state="unpublished">home</internal-link> and bad</p>',
    );
  });

  it('retypes lists and drops alignments the plugins do not offer', () => {
    const editor = setup({ plugins: [history(), lists({ types: ['ul'] }), alignment({ alignments: ['center'] }), pasteCleanup()] });
    paste(editor, {
      'text/html': '<ol><li>a</li></ol><p style="text-align: right">r</p><p style="text-align: center">c</p>',
      'text/plain': 'a r c',
    });
    expect(editor.getHtml()).toBe('<ul><li>a</li></ul><p>r</p><p style="text-align: center;">c</p>');
  });

  it('leaves HTML that equals the plain text to Lexical', () => {
    const editor = setup({});
    const event = paste(editor, { 'text/html': 'one\ntwo', 'text/plain': 'one\ntwo' });
    expect(event.defaultPrevented).toBe(true);
    expect(editor.getHtml()).toBe('<p>one</p><p>two</p>');
  });

  it('keeps language spans with the language plugin', () => {
    const editor = setup({ plugins: [history(), formatting(), headings(), lists(), links(), tables(), language(), pasteCleanup()] });
    paste(editor, { 'text/html': libreOffice, 'text/plain': 'Überschrift' });
    expect(editor.getHtml()).toContain('<p><strong>Fett</strong> und <em>kursiv</em> und <s>durch</s> und <span lang="en-GB">English words</span>.</p>');
  });

  it('leaves plain text to Lexical', () => {
    const editor = setup({});
    const event = paste(editor, { 'text/plain': 'Line one\nLine two' });
    expect(event.defaultPrevented).toBe(true);
    expect(editor.getHtml()).toBe('<p>Line one</p><p>Line two</p>');
  });

  it('handles PASTE_COMMAND dispatched by other code', () => {
    const editor = setup({ initialHtml: '<p>A</p>' });
    const event = new ClipboardEvent(clipboard({ 'text/html': '<p class="x"><font face="Arial">B</font></p>' }));
    expect(editor.lexical.dispatchCommand(PASTE_COMMAND, event as unknown as globalThis.ClipboardEvent)).toBe(true);
    expect(editor.getHtml()).toBe('<p>AB</p>');
  });

  it('is part of the default plugins', () => {
    const editor = setup({});
    paste(editor, { 'text/html': '<p><span style="font-style: italic">x</span></p>' });
    expect(editor.getHtml()).toBe('<p><em>x</em></p>');
  });
});
