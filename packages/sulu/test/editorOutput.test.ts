import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createEditor } from '@primavista/core';
import { describe, expect, it } from 'vitest';
import { SULU_DEFAULT_CONFIG, suluPlugins, suluPreset } from '../src';

/*
 * What the editor writes for typical Sulu content, kept in a file the PHP
 * sanitizer test reads. Lexical updates change behaviour more often than
 * names: empty paragraphs, whitespace, nesting. This test shows such a change
 * in the diff of the fixture file, and the PHP test shows when the sanitizer
 * would not let the new output through.
 *
 * Update the fixture on purpose with `UPDATE_FIXTURES=1 pnpm --filter @primavista/sulu test`.
 */
const FIXTURE = join(process.cwd(), '../../bundles/sulu-bundle/tests/Fixtures/editor-output.json');

const INPUTS: Record<string, string> = {
  headings: '<h2>Two</h2><h3>Three</h3><h4>Four</h4><h5>Five</h5><h6>Six</h6>',
  'inline formats': '<p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s> <code>c</code> H<sub>2</sub>O E=mc<sup>2</sup></p>',
  'CKEditor italic and bold': '<p><i>italic</i> <b>bold</b></p>',
  'nested formats': '<p><strong><em>both</em></strong> and <u><s>these</s></u></p>',
  'lists': '<ul><li>One</li><li>Two<ul><li>Nested</li></ul></li></ul><ol><li>First</li><li>Second</li></ol>',
  'external link': '<p>See <a href="https://sulu.io" target="_blank" title="Sulu">Sulu</a>.</p>',
  'sulu link': '<p><sulu-link href="abc-123?x=1#top" provider="page" target="_self" title="Home">Home</sulu-link></p>',
  'sulu link with validation state': '<p><sulu-link href="abc" provider="media" sulu-validation-state="unpublished">File</sulu-link></p>',
  alignment: '<p style="text-align: center;">c</p><p style="text-align: right;">r</p><p style="text-align: justify;">j</p>',
  table: '<figure class="table"><table><thead><tr><th>H</th><th>H</th></tr></thead><tbody><tr><td>a</td><td colspan="2">b</td></tr></tbody></table></figure>',
  'table with empty cells': '<figure class="table"><table><tbody><tr><td></td><td>x</td></tr></tbody></table></figure>',
  'empty paragraphs': '<p>a</p><p>&nbsp;</p><p></p><p><br></p><p>b</p>',
  whitespace: '<p>  leading and   inner  </p><p>trailing </p>',
  'line breaks': '<p>one<br>two<br><br>three</p>',
  entities: '<p>a &amp; b &lt; c &gt; d &quot;e&quot;</p>',
  unicode: '<p>Größe, café, 日本語, 😀</p>',
  'long text': `<p>${'word '.repeat(80).trim()}</p>`,
  'mixed document': '<h2>Title</h2><p>Intro with <strong>bold</strong> and a <a href="https://example.org">link</a>.</p><ul><li>Point</li></ul><p style="text-align: center;">End</p>',
};

function write(html: string): string {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const editor = createEditor(container, {
    ...suluPreset(),
    plugins: suluPlugins({ config: SULU_DEFAULT_CONFIG, providers: [{ key: 'page', label: 'Page' }, { key: 'media', label: 'Media' }] }),
    initialHtml: html,
  });
  const out = editor.getHtml();
  editor.destroy();
  container.remove();
  return out;
}

const outputs = Object.entries(INPUTS).map(([name, html]) => ({ name, html: write(html) }));

describe('editor output for Sulu content', () => {
  it.each(outputs)('is stable when the editor reads its own output: $name', ({ html }) => {
    expect(write(html)).toBe(html);
  });

  it('matches the fixture the PHP sanitizer test reads', () => {
    if (process.env['UPDATE_FIXTURES']) {
      writeFileSync(FIXTURE, `${JSON.stringify(outputs, null, 2)}\n`);
    }
    expect(existsSync(FIXTURE)).toBe(true);
    expect(JSON.parse(readFileSync(FIXTURE, 'utf8'))).toEqual(outputs);
  });
});
