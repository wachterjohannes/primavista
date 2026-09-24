import { afterEach, describe, expect, it, vi } from 'vitest';
import { countText, defaultPlugins, getWordCount, type PrimavistaEditor, type WordCountOptions, type WordCountState, wordCount } from '../src';
import { mount, typeText } from './helpers';

let active: { editor: PrimavistaEditor; container: HTMLElement } | null = null;

function setup(initialHtml: string, options: WordCountOptions = {}, translate?: (key: string, fallback: string) => string): PrimavistaEditor {
  active = mount({ initialHtml, plugins: [...defaultPlugins(), wordCount(options)], ...(translate ? { translate } : {}) });
  return active.editor;
}

function bar(editor: PrimavistaEditor): HTMLElement {
  const el = editor.element.querySelector<HTMLElement>('.pv-word-count');
  if (!el) throw new Error('no word count bar');
  return el;
}

afterEach(() => {
  active?.editor.destroy();
  active?.container.remove();
  active = null;
});

describe('countText', () => {
  it('counts words and characters with spaces, without line breaks', () => {
    expect(countText('')).toEqual({ words: 0, characters: 0 });
    expect(countText('   ')).toEqual({ words: 0, characters: 3 });
    expect(countText('Hello, world!')).toEqual({ words: 2, characters: 13 });
    expect(countText('one\n\ntwo')).toEqual({ words: 2, characters: 6 });
    expect(countText("don't re-use e-mail 3.14 — ok")).toEqual({ words: 5, characters: 29 });
  });

  it('counts every ideograph and kana as a word', () => {
    expect(countText('你好世界')).toEqual({ words: 4, characters: 4 });
    expect(countText('Primavista は エディタ')).toEqual({ words: 6, characters: 17 });
    expect(countText('한국어 문장')).toEqual({ words: 2, characters: 6 });
  });

  it('counts an emoji sequence as one character', () => {
    expect(countText('👩‍💻 ok').characters).toBe(4);
  });
});

describe('wordCount', () => {
  it('counts across paragraphs, headings, lists and tables', () => {
    const editor = setup(
      '<h2>Two words</h2><p>Three more <strong>words</strong></p><ul><li>one</li><li>two items</li></ul>' +
        '<table><tbody><tr><td>cell</td><td>next cell</td></tr></tbody></table>',
    );
    expect(getWordCount(editor)).toEqual({ words: 11, characters: 50 });
    expect(bar(editor).textContent).toBe('Words: 11Characters: 50');
    expect(bar(editor).dataset['words']).toBe('11');
  });

  it('shows zero for an empty document', () => {
    const editor = setup('');
    expect(getWordCount(editor)).toEqual({ words: 0, characters: 0 });
    expect(getWordCount(editor.lexical)).toEqual({ words: 0, characters: 0 });
    expect(bar(editor).textContent).toBe('Words: 0Characters: 0');
  });

  it('updates on change and stays out of the HTML', () => {
    const onChange = vi.fn<(state: WordCountState) => void>();
    const editor = setup('<p>One</p>', { onChange });
    expect(onChange).toHaveBeenLastCalledWith({ words: 1, characters: 3, overLimit: false });
    typeText(editor, ' two');
    expect(bar(editor).querySelector('.pv-word-count-words')?.textContent).toBe('Words: 2');
    expect(onChange).toHaveBeenLastCalledWith({ words: 2, characters: 7, overLimit: false });
    expect(editor.getHtml()).toBe('<p>One two</p>');
    expect(editor.contentElement.contains(bar(editor))).toBe(false);
  });

  it('shows one unit and translates the labels', () => {
    const editor = setup('<p>Hallo Welt</p>', { mode: 'characters' }, (key, fallback) => (key === 'wordCount.characters' ? 'Zeichen' : fallback));
    expect(bar(editor).textContent).toBe('Zeichen: 10');
    expect(bar(editor).querySelector('.pv-word-count-words')).toBeNull();
  });

  it('marks and announces a soft limit', () => {
    const editor = setup('<p>one two</p>', { limit: 3 });
    const alert = bar(editor).querySelector<HTMLElement>('[aria-live="polite"]')!;
    expect(bar(editor).querySelector('.pv-word-count-words')?.textContent).toBe('Words: 2 / 3');
    expect(bar(editor).classList.contains('pv-word-count--over')).toBe(false);
    expect(alert.textContent).toBe('');

    typeText(editor, ' three four');
    expect(bar(editor).classList.contains('pv-word-count--over')).toBe(true);
    expect(alert.textContent).toBe('Over the limit');
    expect(editor.getHtml()).toBe('<p>one two three four</p>');

    editor.setHtml('<p>short</p>');
    expect(bar(editor).classList.contains('pv-word-count--over')).toBe(false);
    expect(alert.textContent).toBe('');
  });

  it('limits characters in characters mode', () => {
    const editor = setup('<p>abcdef</p>', { mode: 'characters', limit: 5 });
    expect(bar(editor).textContent).toBe('Over the limitCharacters: 6 / 5');
  });

  it('removes the status bar on destroy', () => {
    const editor = setup('<p>x</p>');
    const element = bar(editor);
    editor.destroy();
    expect(element.isConnected).toBe(false);
  });
});
