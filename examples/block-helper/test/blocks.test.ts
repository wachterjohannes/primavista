import { defaultPlugins } from '@primavista/core';
import { button, expectRoundTrip, mount, selectAll } from '@primavista/core/testing';
import { expect, it } from 'vitest';
import { newsletter, note } from '../src';

const plugins = [...defaultPlugins(), note, newsletter];

it('keeps the note and the placeholder through a round trip', () => {
  expectRoundTrip(plugins, '<aside class="note"><p>Read this</p></aside><div data-widget="newsletter"></div>');
});

it('inserts the placeholder with its default attribute', () => {
  const { editor, container } = mount({ plugins });
  editor.setHtml('<p>Text</p>');
  selectAll(editor);
  button(editor, 'newsletter').click();
  expect(editor.getHtml()).toContain('<div data-widget="newsletter"></div>');
  editor.destroy();
  container.remove();
});

it('reads and replaces the selection through the editor commands', () => {
  const { editor, container } = mount({ plugins });
  editor.setHtml('<p>Hello</p>');
  selectAll(editor);
  expect(editor.getSelectedText()).toBe('Hello');
  editor.insertText('Bye');
  expect(editor.getHtml()).toBe('<p>Bye</p>');
  editor.destroy();
  container.remove();
});
