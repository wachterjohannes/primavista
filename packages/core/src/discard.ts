import type { DiscardedElement } from './types';

/*
 * Markup the editor loaded but cannot write back. A document that needs a
 * plugin which is not loaded loses its element on the next save, so the host
 * should know before the first keystroke. The check compares what went in with
 * what the editor would write out, by element key (tag and classes):
 *
 * - a key that is missing from the output was dropped as a whole
 * - an attribute that no element of a kept key has any more was dropped
 *
 * A lower count alone is no loss, Lexical merges neighbours such as two
 * adjacent <strong>.
 */
const TAG_ALIASES: Record<string, string> = { b: 'strong', i: 'em', strike: 's', del: 's' };
// Elements whose loss is a normal clean-up, not content.
const IGNORED_TAGS = new Set(['br', 'tbody', 'thead', 'tfoot', 'colgroup', 'col', 'script', 'style', 'meta', 'link', 'title', 'wbr']);
// Wrappers that carry nothing as long as they have no class and no attribute.
const BARE_WRAPPERS = new Set(['div', 'span', 'font']);

interface Seen {
  count: number;
  attributes: Map<string, number>;
}

function keyOf(element: Element): string | null {
  const tag = element.localName.toLowerCase();
  if (IGNORED_TAGS.has(tag)) return null;
  const classes = [...element.classList].sort();
  if (BARE_WRAPPERS.has(tag) && classes.length === 0 && element.attributes.length === 0) return null;
  return `${TAG_ALIASES[tag] ?? tag}${classes.map((name) => `.${name}`).join('')}`;
}

function scan(html: string): Map<string, Seen> {
  const seen = new Map<string, Seen>();
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  for (const element of body.querySelectorAll('*')) {
    const key = keyOf(element);
    if (!key) continue;
    const entry = seen.get(key) ?? { count: 0, attributes: new Map<string, number>() };
    entry.count += 1;
    for (const name of element.getAttributeNames()) {
      if (name !== 'class') entry.attributes.set(name, (entry.attributes.get(name) ?? 0) + 1);
    }
    seen.set(key, entry);
  }
  return seen;
}

function describe(key: string): { tag: string; className?: string } {
  const [tag = '', ...classes] = key.split('.');
  return { tag, ...(classes.length > 0 ? { className: classes.join(' ') } : {}) };
}

export function findDiscarded(inputHtml: string, outputHtml: string): DiscardedElement[] {
  if (inputHtml.trim() === '') return [];
  const output = scan(outputHtml);
  const discarded: DiscardedElement[] = [];
  for (const [key, entry] of scan(inputHtml)) {
    const kept = output.get(key);
    if (!kept) {
      discarded.push({ ...describe(key), count: entry.count });
      continue;
    }
    const lost = [...entry.attributes].filter(([name]) => !kept.attributes.has(name));
    if (lost.length > 0) {
      discarded.push({ ...describe(key), count: Math.max(...lost.map(([, count]) => count)), attributes: lost.map(([name]) => name).sort() });
    }
  }
  return discarded;
}
