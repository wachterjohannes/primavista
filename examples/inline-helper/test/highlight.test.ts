import { defaultPlugins } from '@primavista/core';
import { expectRoundTrip, paste, mount } from '@primavista/core/testing';
import { expect, it } from 'vitest';
import { abbreviation, highlight } from '../src';

const plugins = [...defaultPlugins(), highlight, abbreviation];

it('keeps the elements through a round trip', () => {
  expectRoundTrip(plugins, '<p>An <abbr title="Hypertext">HTML</abbr> <mark>page</mark></p>');
});

it('keeps the elements when pasting', () => {
  const { editor, container } = mount({ plugins });
  paste(editor, { 'text/html': '<p><mark class="x">a</mark></p>', 'text/plain': 'a' });
  expect(editor.getHtml()).toBe('<p><mark>a</mark></p>');
  editor.destroy();
  container.remove();
});
