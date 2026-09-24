import { afterEach, describe, expect, it } from 'vitest';
import { mount } from './helpers';

const cleanups: Array<() => void> = [];
afterEach(() => {
  cleanups.splice(0).forEach((fn) => fn());
});

function roundTrip(html: string): string {
  const { editor, container } = mount({ initialHtml: html });
  cleanups.push(() => {
    editor.destroy();
    container.remove();
  });
  return editor.getHtml();
}

describe('HTML round trip', () => {
  it.each([
    ['', ''],
    ['<p>Hello</p>', '<p>Hello</p>'],
    ['<p>Hello <strong>world</strong></p>', '<p>Hello <strong>world</strong></p>'],
    ['<p><em>a</em> <u>b</u> <s>c</s></p>', '<p><em>a</em> <u>b</u> <s>c</s></p>'],
    ['<p><strong><em>nested</em></strong></p>', '<p><strong><em>nested</em></strong></p>'],
    ['<h1>Title</h1><p>Text</p>', '<h1>Title</h1><p>Text</p>'],
    ['<h2>Two</h2><h3>Three</h3><h4>Four</h4>', '<h2>Two</h2><h3>Three</h3><h4>Four</h4>'],
    ['<ul><li>One</li><li>Two</li></ul>', '<ul><li>One</li><li>Two</li></ul>'],
    ['<ol><li>One</li><li>Two</li></ol>', '<ol><li>One</li><li>Two</li></ol>'],
    ['<p><a href="https://example.com">Link</a></p>', '<p><a href="https://example.com">Link</a></p>'],
    [
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a></p>',
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a></p>',
    ],
    [
      '<table><tbody><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>',
      '<table><tbody><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>',
    ],
    ['<p>Line<br>break</p>', '<p>Line<br>break</p>'],
    ['<p><code>x = 1</code></p>', '<p><code>x = 1</code></p>'],
    ['<p>H<sub>2</sub>O and x<sup>2</sup></p>', '<p>H<sub>2</sub>O and x<sup>2</sup></p>'],
  ])('keeps %s', (input, expected) => {
    expect(roundTrip(input)).toBe(expected);
  });

  it('wraps loose inline content in a paragraph', () => {
    expect(roundTrip('Hello')).toBe('<p>Hello</p>');
    expect(roundTrip('Hello <b>bold</b>')).toBe('<p>Hello <strong>bold</strong></p>');
    expect(roundTrip('<i>a</i><p>b</p>c')).toBe('<p><em>a</em></p><p>b</p><p>c</p>');
  });

  it('normalizes legacy tags', () => {
    expect(roundTrip('<p><b>b</b> <i>i</i> <strike>s</strike></p>')).toBe('<p><strong>b</strong> <em>i</em> <s>s</s></p>');
  });

  it('does not leak editor classes, dir attributes or inline styles', () => {
    const html = roundTrip('<h2>Title</h2><ul><li>One</li></ul><table><tbody><tr><td>x</td></tr></tbody></table>');
    expect(html).not.toMatch(/class=/);
    expect(html).not.toMatch(/dir=/);
    expect(html).not.toMatch(/style=/);
    expect(html).not.toMatch(/value=/);
    expect(html).not.toMatch(/<span/);
  });

  it('treats whitespace-only input as empty', () => {
    expect(roundTrip('  \n ')).toBe('');
    expect(roundTrip('<p></p>')).toBe('');
  });

  it('keeps a table with an empty text content', () => {
    const html = roundTrip('<table><tbody><tr><td></td></tr></tbody></table>');
    expect(html).toBe('<table><tbody><tr><td></td></tr></tbody></table>');
  });

  it('keeps colspan and rowspan', () => {
    const html = roundTrip('<table><tbody><tr><td colspan="2">a</td></tr><tr><td>b</td><td>c</td></tr></tbody></table>');
    expect(html).toBe('<table><tbody><tr><td colspan="2">a</td></tr><tr><td>b</td><td>c</td></tr></tbody></table>');
  });
});
