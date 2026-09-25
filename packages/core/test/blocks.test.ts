import { $getRoot, $getSelection, $isRangeSelection, INSERT_PARAGRAPH_COMMAND, PASTE_COMMAND } from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';
import { autoformat, blockquote, codeBlock, formatting, history, horizontalRule, pasteCleanup, type PrimavistaEditor, type PrimavistaPlugin } from '../src';
import { button, mount, selectAll, typeText } from './helpers';

let active: { editor: PrimavistaEditor; container: HTMLElement } | null = null;

function setup(initialHtml = '', plugins: PrimavistaPlugin[] = [history(), formatting(), blockquote(), codeBlock(), horizontalRule()]): PrimavistaEditor {
  active = mount({ plugins, initialHtml });
  return active.editor;
}

afterEach(() => {
  active?.editor.destroy();
  active?.container.remove();
  active = null;
});

describe('blockquote', () => {
  it('wraps the selected blocks and unwraps them again', () => {
    const editor = setup('<p>One</p><p>Two</p>');
    selectAll(editor);
    button(editor, 'blockquote').click();
    expect(editor.getHtml()).toBe('<blockquote><p>One</p><p>Two</p></blockquote>');
    expect(button(editor, 'blockquote').getAttribute('aria-pressed')).toBe('true');

    button(editor, 'blockquote').click();
    expect(editor.getHtml()).toBe('<p>One</p><p>Two</p>');
  });

  it('round-trips CKEditor markup and normalizes inline content into a paragraph', () => {
    const editor = setup('<blockquote><p>a</p><p style="text-align: center;">b</p></blockquote>');
    expect(editor.getHtml()).toBe('<blockquote><p>a</p><p style="text-align: center;">b</p></blockquote>');

    editor.setHtml('<blockquote>plain <strong>text</strong></blockquote>');
    expect(editor.getHtml()).toBe('<blockquote><p>plain <strong>text</strong></p></blockquote>');
  });

  it('adds paragraphs inside the quote on Enter and leaves it from an empty last one', () => {
    const editor = setup('<blockquote><p>a</p></blockquote>');
    typeText(editor, 'b');
    editor.lexical.update(() => editor.lexical.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined), { discrete: true });
    typeText(editor, 'c');
    expect(editor.getHtml()).toBe('<blockquote><p>ab</p><p>c</p></blockquote>');

    editor.lexical.update(() => editor.lexical.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined), { discrete: true });
    editor.lexical.update(() => editor.lexical.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined), { discrete: true });
    typeText(editor, 'after');
    expect(editor.getHtml()).toBe('<blockquote><p>ab</p><p>c</p></blockquote><p>after</p>');
  });

  it('is a typing shortcut with autoformat', async () => {
    const editor = setup('', [history(), blockquote(), autoformat()]);
    editor.lexical.update(() => $getRoot().selectEnd(), { discrete: true });
    for (const char of '> q') {
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
    expect(editor.getHtml()).toBe('<blockquote><p>q</p></blockquote>');
  });
});

describe('code block', () => {
  it('toggles a code block and stores it as pre and code with newlines', () => {
    const editor = setup('<p>let a = 1;</p>');
    selectAll(editor);
    button(editor, 'code-block').click();
    editor.lexical.update(() => $getRoot().selectEnd(), { discrete: true });
    editor.lexical.update(() => editor.lexical.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined), { discrete: true });
    typeText(editor, 'let b = 2;');
    expect(editor.getHtml()).toBe('<pre><code>let a = 1;\nlet b = 2;</code></pre>');
    expect(button(editor, 'code-block').getAttribute('aria-pressed')).toBe('true');

    button(editor, 'code-block').click();
    expect(editor.getHtml()).toBe('<p>let a = 1;<br>let b = 2;</p>');
  });

  it('reads CKEditor code blocks without turning the text into inline code', () => {
    const editor = setup('<pre><code class="language-plaintext">x &lt; y\n  z</code></pre>');
    expect(editor.getHtml()).toBe('<pre><code>x &lt; y\n  z</code></pre>');
    expect(editor.contentElement.querySelector('pre code')).toBeNull();
  });
});

describe('horizontal rule', () => {
  it('inserts an hr after the current block and round-trips it', () => {
    const editor = setup('<p>a</p>');
    editor.lexical.update(() => $getRoot().selectEnd(), { discrete: true });
    button(editor, 'horizontal-rule').click();
    typeText(editor, 'b');
    expect(editor.getHtml()).toBe('<p>a</p><hr><p>b</p>');

    editor.setHtml('<p>x</p><hr><p>y</p>');
    expect(editor.getHtml()).toBe('<p>x</p><hr><p>y</p>');
    expect(editor.contentElement.querySelector('hr.pv-hr')).not.toBeNull();
  });

  it('is removed with Backspace after selecting it', () => {
    const editor = setup('<p>x</p><hr><p>y</p>');
    editor.lexical.update(() => {
      const paragraph = $getRoot().getLastChild();
      paragraph?.selectStart();
      const selection = $getSelection();
      if ($isRangeSelection(selection)) selection.deleteCharacter(true);
    }, { discrete: true });
    editor.lexical.update(() => {
      const selection = $getSelection();
      if (selection) selection.deleteNodes?.();
    }, { discrete: true });
    expect(editor.getHtml()).toBe('<p>x</p><p>y</p>');
  });
});

describe('paste cleanup with the block plugins', () => {
  it('keeps quotes, code and rules only with their plugins', () => {
    const html = '<blockquote><p>q</p></blockquote><pre><code>a\nb</code></pre><hr><p>after</p>';
    const withPlugins = setup('', [history(), blockquote(), codeBlock(), horizontalRule(), pasteCleanup()]);
    withPlugins.lexical.update(() => $getRoot().selectEnd(), { discrete: true });
    expect(cleaned(withPlugins, html)).toBe('<blockquote><p>q</p></blockquote><pre><code>a\nb</code></pre><hr><p>after</p>');
  });
});

function cleaned(editor: PrimavistaEditor, html: string): string {
  const data = { 'text/html': html, 'text/plain': 'q a b after' };
  const clipboardData = { types: Object.keys(data), files: [], getData: (type: string) => (data as Record<string, string>)[type] ?? '' };
  const event = { clipboardData, preventDefault: () => {} } as unknown as ClipboardEvent;
  editor.lexical.dispatchCommand(PASTE_COMMAND, event);
  return editor.getHtml();
}
