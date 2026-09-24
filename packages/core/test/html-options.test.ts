import { afterEach, describe, expect, it } from 'vitest';
import { headings, type EditorOptions } from '../src';
import { mount, select, selectAll } from './helpers';

/** The options `@primavista/sulu`'s preset bundles, spelled out. */
const CK: Pick<EditorOptions, 'html'> = { html: { tableWrapper: 'figure', tableHeadSection: true, emptyParagraph: 'nbsp' } };

const cleanups: Array<() => void> = [];
afterEach(() => cleanups.splice(0).forEach((fn) => fn()));

function roundTrip(html: string, options: Parameters<typeof mount>[0] = {}): string {
  const { editor, container } = mount({ initialHtml: html, ...options });
  cleanups.push(() => {
    editor.destroy();
    container.remove();
  });
  return editor.getHtml();
}

describe('CKEditor-compatible output', () => {
  const ck = '<figure class="table"><table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table></figure>';

  it('drops figure and thead by default', () => {
    expect(roundTrip(ck)).toBe('<table><tbody><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>');
  });

  it('keeps figure and thead with the CKEditor options', () => {
    expect(roundTrip(ck, CK)).toBe(ck);
  });

  it('does not create a thead when the first row has a body cell', () => {
    const html = '<table><tbody><tr><th>A</th><td>x</td></tr></tbody></table>';
    expect(roundTrip(html, { html: { tableHeadSection: true } })).toBe(html);
  });

  it('puts every leading header row into thead and nothing else', () => {
    const html = '<table><thead><tr><th>A</th></tr><tr><th>B</th></tr></thead><tbody><tr><td>1</td></tr><tr><th>C</th></tr></tbody></table>';
    expect(roundTrip(html, { html: { tableHeadSection: true } })).toBe(html);
  });

  it('writes empty paragraphs as nbsp with the CKEditor options', () => {
    const { editor, container } = mount({ initialHtml: '<p>a</p>', ...CK });
    cleanups.push(() => {
      editor.destroy();
      container.remove();
    });
    editor.lexical.update(
      () => {
        const { $getRoot, $createParagraphNode } = require('lexical') as typeof import('lexical');
        $getRoot().append($createParagraphNode());
      },
      { discrete: true },
    );
    expect(editor.getHtml()).toBe('<p>a</p><p>&nbsp;</p>');
  });

  it('keeps nbsp paragraphs from stored content either way', () => {
    expect(roundTrip('<p>&nbsp;</p><p>x</p>')).toBe('<p>&nbsp;</p><p>x</p>');
  });
});

describe('table cell alignment', () => {
  it('round-trips text-align on cells', () => {
    const html = '<table><tbody><tr><td style="text-align: right;">r</td><td>plain</td></tr></tbody></table>';
    expect(roundTrip(html)).toBe(html);
  });

  it('keeps paragraphs inside cells when there are several', () => {
    const html = '<table><tbody><tr><td><p style="text-align: center;">a</p><p>b</p></td></tr></tbody></table>';
    expect(roundTrip(html)).toBe(html);
  });
});

describe('heading levels', () => {
  it('demotes headings outside the configured levels to paragraphs', () => {
    const { editor, container } = mount({
      initialHtml: '<h1 style="text-align: center;">Top</h1><h2>Two</h2>',
      plugins: [headings({ levels: ['h2', 'h3'] })],
    });
    cleanups.push(() => {
      editor.destroy();
      container.remove();
    });
    expect(editor.getHtml()).toBe('<p style="text-align: center;">Top</p><h2>Two</h2>');
    expect(Array.from(select(editor, 'block-type').options).map((o) => o.value)).toEqual(['paragraph', 'h2', 'h3']);
  });

  it('keeps unlisted headings when demotion is off', () => {
    expect(roundTrip('<h1>Top</h1>', { plugins: [headings({ levels: ['h2'], demoteUnlisted: false })] })).toBe('<h1>Top</h1>');
  });
});

describe('themes', () => {
  it('adds the theme class', () => {
    const { editor, container } = mount({ theme: 'dark' });
    cleanups.push(() => {
      editor.destroy();
      container.remove();
    });
    expect(editor.element.classList.contains('pv-theme-dark')).toBe(true);
    selectAll(editor);
  });
});
