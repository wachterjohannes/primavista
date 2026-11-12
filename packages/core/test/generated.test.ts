import { describe, expect, it, vi } from 'vitest';
import { blockElement, defaultPlugins, inlineElement, voidElement, type PrimavistaPlugin } from '../src';
import { mount } from '../src/testing';

/*
 * Random documents built from the schema of the plugins. Two things must hold
 * for every one of them, because Sulu marks a form as changed on any `change`:
 * loading does not fire `change`, and the editor writes what it wrote before
 * when it reads its own output again.
 */
const plugins: PrimavistaPlugin[] = [
  ...defaultPlugins(),
  inlineElement({ name: 'yellow', tag: 'mark', className: 'yellow', toolbar: false }),
  inlineElement({ name: 'abbr', tag: 'abbr', attributes: ['title'], toolbar: false }),
  blockElement({ name: 'note', tag: 'aside', className: 'note', toolbar: false }),
  voidElement({ name: 'widget', tag: 'div', defaults: { 'data-widget': 'newsletter' }, toolbar: false }),
];

// Small deterministic generator, so a failure names the seed and repeats.
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const WORDS = ['alpha', 'beta', 'x', 'Größe', '日本', 'a & b', '1 < 2'];

function inline(next: () => number, depth: number, inLink = false): string {
  const word = WORDS[Math.floor(next() * WORDS.length)]!.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  if (depth > 2 || next() < 0.4) return word;
  const wraps = [
    (s: string) => `<strong>${s}</strong>`,
    (s: string) => `<em>${s}</em>`,
    (s: string) => `<u>${s}</u>`,
    (s: string) => `<code>${s}</code>`,
    (s: string) => `<mark class="yellow">${s}</mark>`,
    (s: string) => `<abbr title="t">${s}</abbr>`,
    (s: string) => `<a href="https://example.org">${s}</a>`,
  ];
  // A link inside a link is not valid HTML, so the generator never builds one.
  const choice = Math.floor(next() * (inLink ? 6 : 7));
  return wraps[choice]!(inline(next, depth + 1, inLink || choice === 6)) + (next() < 0.5 ? ` ${inline(next, depth + 1, inLink)}` : '');
}

function block(next: () => number): string {
  const pick = Math.floor(next() * 7);
  if (pick === 0) {
    const level = 2 + Math.floor(next() * 3);
    return `<h${level}>${inline(next, 0)}</h${level}>`;
  }
  if (pick === 1) return `<ul><li>${inline(next, 0)}</li><li>${inline(next, 0)}</li></ul>`;
  if (pick === 2) return `<aside class="note"><p>${inline(next, 0)}</p></aside>`;
  if (pick === 3) return '<div data-widget="newsletter"></div>';
  return `<p>${inline(next, 0)}</p>`;
}

function document_(seed: number): string {
  const next = random(seed);
  return Array.from({ length: 1 + Math.floor(next() * 5) }, () => block(next)).join('');
}

describe('documents generated from the schema', () => {
  it.each(Array.from({ length: 200 }, (_, i) => i + 1))('seed %i: loading is silent and a second pass changes nothing', (seed) => {
    const html = document_(seed);
    const first = mount({ plugins, initialHtml: html });
    const output = first.editor.getHtml();
    const second = mount({ plugins, initialHtml: output });
    const onChange = vi.fn();
    second.editor.on('change', onChange);
    second.editor.setHtml(output);
    expect(onChange).not.toHaveBeenCalled();
    expect(second.editor.getHtml()).toBe(output);
    expect(first.editor.getDiscarded()).toEqual([]);
    first.editor.destroy();
    second.editor.destroy();
  });
});
