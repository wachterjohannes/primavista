import { describe, expect, it } from 'vitest';
import { blockElement, blockquote, codeBlock, defaultPlugins, getSchema, horizontalRule, inlineElement, language, voidElement, type PrimavistaPlugin, type SchemaElement } from '../src';
import { mount } from '../src/testing';

/*
 * HTML generated from the schema of the plugins: one snippet per declared
 * element, with its class and attributes filled in. The editor must keep each
 * snippet and a second pass through the editor must not change anything. A
 * Lexical update that changes how whitespace, empty blocks or nested elements
 * are exported shows up here without a hand-written fixture.
 */
const plugins: PrimavistaPlugin[] = [
  ...defaultPlugins(),
  blockquote(),
  codeBlock(),
  horizontalRule(),
  language(),
  inlineElement({ name: 'yellow', tag: 'mark', className: 'yellow', toolbar: false }),
  inlineElement({ name: 'green', tag: 'mark', className: 'green', toolbar: false }),
  inlineElement({ name: 'abbr', tag: 'abbr', attributes: ['title'], toolbar: false }),
  inlineElement({ name: 'lead', tag: 'span', className: 'lead', toolbar: false }),
  blockElement({ name: 'note', tag: 'aside', className: 'note', toolbar: false }),
  voidElement({ name: 'widget', tag: 'div', defaults: { 'data-widget': 'newsletter' }, toolbar: false }),
];

function attributesOf(element: SchemaElement): string {
  const names = new Set([...(element.attributes ?? []), ...(element.requires ?? [])]);
  const parts = [...names].map((name) => `${name}="${name === 'data-widget' ? 'newsletter' : `${name} value`}"`);
  if (element.className) parts.push(`class="${element.className}"`);
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

function snippetFor(element: SchemaElement): string {
  const open = `<${element.tag}${attributesOf(element)}>`;
  switch (element.kind ?? 'inline') {
    case 'block':
      return `${open}<p>Inside the block</p></${element.tag}>`;
    case 'void':
      return `${open}</${element.tag}>`;
    default:
      return `<p>Before ${open}inside</${element.tag}> after</p>`;
  }
}

function pass(html: string): string {
  const { editor, container } = mount({ plugins, initialHtml: html });
  const out = editor.getHtml();
  editor.destroy();
  container.remove();
  return out;
}

describe('HTML generated from the schema', () => {
  const elements = getSchema(plugins).elements;

  it('has an entry for every helper', () => {
    expect(elements.map((element) => `${element.tag}.${element.className ?? ''}`)).toEqual(
      expect.arrayContaining(['mark.yellow', 'mark.green', 'abbr.', 'span.lead', 'aside.note', 'div.']),
    );
  });

  it.each(elements.map((element) => [`${element.tag}${element.className ? `.${element.className}` : ''}`, element] as const))(
    'keeps %s and is stable on a second pass',
    (_name, element) => {
      const html = snippetFor(element);
      const first = pass(html);
      expect(first).toContain(`<${element.tag}`);
      expect(pass(first)).toBe(first);
    },
  );

  it('is stable for all snippets in one document', () => {
    const html = `<h2>Title</h2>${elements.map(snippetFor).join('')}<ul><li>One</li></ul><p></p><p>End</p>`;
    const first = pass(html);
    expect(pass(first)).toBe(first);
  });
});
