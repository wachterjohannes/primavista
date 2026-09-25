import { $getRoot, $getSelection, $isRangeSelection } from 'lexical';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { autoformat, defaultPlugins, formatting, headings, history, lists, type PrimavistaEditor, type PrimavistaPlugin } from '../src';
import { mount } from './helpers';

let active: { editor: PrimavistaEditor; container: HTMLElement } | null = null;

function setup(plugins: PrimavistaPlugin[], initialHtml = ''): PrimavistaEditor {
  active = mount({ plugins, initialHtml });
  return active.editor;
}

// Lexical scrolls the caret into view after a shortcut. jsdom cannot measure ranges.
beforeAll(() => {
  Range.prototype.getBoundingClientRect ??= () => new DOMRect();
});

afterEach(() => {
  active?.editor.destroy();
  active?.container.remove();
  active = null;
});

/**
 * Types one character per update at the end of the document, the way the
 * browser reports keystrokes. The shortcuts run in an update listener, which
 * schedules its own update, so every keystroke waits for that to flush.
 */
async function type(editor: PrimavistaEditor, text: string): Promise<void> {
  editor.lexical.update(() => $getRoot().selectEnd(), { discrete: true });
  for (const char of text) {
    editor.lexical.update(
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) selection.insertText(char);
      },
      { discrete: true },
    );
    await Promise.resolve();
  }
  editor.lexical.update(() => {}, { discrete: true });
}

describe('autoformat', () => {
  it('turns block shortcuts into headings and lists', async () => {
    const editor = setup(defaultPlugins());
    await type(editor, '## Title');
    expect(editor.getHtml()).toBe('<h2>Title</h2>');

    editor.setHtml('');
    await type(editor, '- one');
    expect(editor.getHtml()).toBe('<ul><li>one</li></ul>');

    editor.setHtml('');
    await type(editor, '* two');
    expect(editor.getHtml()).toBe('<ul><li>two</li></ul>');

    editor.setHtml('');
    await type(editor, '1. first');
    expect(editor.getHtml()).toBe('<ol><li>first</li></ol>');
  });

  it('turns inline shortcuts into formats', async () => {
    const editor = setup(defaultPlugins());
    await type(editor, 'a **b** *c* ~~d~~ `e` ***f***');
    expect(editor.getHtml()).toBe('<p>a <strong>b</strong> <em>c</em> <s>d</s> <code>e</code> <strong><em>f</em></strong></p>');
  });

  it('only converts what the other plugins offer', async () => {
    const editor = setup([history(), formatting({ formats: ['bold'] }), headings({ levels: ['h2', 'h3'] }), lists({ types: ['ol'] }), autoformat()]);
    await type(editor, '# no h1');
    expect(editor.getHtml()).toBe('<p># no h1</p>');

    editor.setHtml('');
    await type(editor, '### Yes');
    expect(editor.getHtml()).toBe('<h3>Yes</h3>');

    editor.setHtml('');
    await type(editor, '- no bullets');
    expect(editor.getHtml()).toBe('<p>- no bullets</p>');

    editor.setHtml('');
    await type(editor, '**b** *i* ~~s~~');
    expect(editor.getHtml()).toBe('<p><strong>b</strong> *i* ~~s~~</p>');
  });

  it('only starts a numbered list at 1', async () => {
    const editor = setup(defaultPlugins());
    await type(editor, '3. Oktober');
    expect(editor.getHtml()).toBe('<p>3. Oktober</p>');
  });

  it('follows a spread or replaced plugin', async () => {
    const custom: PrimavistaPlugin = { ...headings({ levels: ['h3'] }), toolbar: [] };
    const editor = setup([history(), custom, autoformat()]);
    await type(editor, '## no h2');
    expect(editor.getHtml()).toBe('<p>## no h2</p>');

    editor.setHtml('');
    await type(editor, '### yes');
    expect(editor.getHtml()).toBe('<h3>yes</h3>');
  });

  it('does nothing without the plugins it relies on', async () => {
    const editor = setup([history(), autoformat()]);
    await type(editor, '## a **b**');
    expect(editor.getHtml()).toBe('<p>## a **b**</p>');
  });

  it('switches the block shortcuts off', async () => {
    const editor = setup([history(), formatting(), headings(), lists(), autoformat({ blocks: false })]);
    await type(editor, '## a **b**');
    expect(editor.getHtml()).toBe('<p>## a <strong>b</strong></p>');
  });

  it('switches the inline shortcuts off', async () => {
    const editor = setup([history(), formatting(), headings(), lists(), autoformat({ inline: false })]);
    await type(editor, '- **b**');
    expect(editor.getHtml()).toBe('<ul><li>**b**</li></ul>');
  });

  it('leaves loaded HTML alone', () => {
    const html = '<p>## not a heading</p><p>- not a list and **not bold**</p>';
    const editor = setup(defaultPlugins(), html);
    expect(editor.getHtml()).toBe(html);
    editor.setHtml('<p>1. still text</p>');
    expect(editor.getHtml()).toBe('<p>1. still text</p>');
  });

  it('does not convert inside table cells', async () => {
    const editor = setup(defaultPlugins(), '<table><tbody><tr><td>x</td></tr></tbody></table>');
    await type(editor, ' ## y');
    expect(editor.getHtml()).toBe('<table><tbody><tr><td>x ## y</td></tr></tbody></table>');
  });
});
