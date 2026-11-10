import { describe, expect, it } from 'vitest';
import { defaultPlugins } from '../src';
import { expectRoundTrip, mount, paste } from '../src/testing';

describe('testing kit', () => {
  it('passes when the HTML survives the round trip', () => {
    expectRoundTrip(defaultPlugins(), '<p>Hello <strong>world</strong></p>');
  });

  it('throws with both versions when the HTML changes', () => {
    expect(() => expectRoundTrip(defaultPlugins(), '<p><font>x</font></p>')).toThrow(/expected: .*\n.*actual:/);
  });

  it('accepts an expected result that differs from the input', () => {
    expectRoundTrip(defaultPlugins(), '<p><b>x</b></p>', '<p><strong>x</strong></p>');
  });

  it('pastes through the editor, so paste cleanup runs', () => {
    const { editor, container } = mount({ plugins: defaultPlugins() });
    paste(editor, { 'text/html': '<span style="font-weight: 700; color: red">bold</span>', 'text/plain': 'bold' });
    expect(editor.getHtml()).toBe('<p><strong>bold</strong></p>');
    editor.destroy();
    container.remove();
  });
});
