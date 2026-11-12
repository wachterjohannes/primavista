import type { DiscardedElement } from './types';

/*
 * Markup the editor loaded but cannot write back. A document that needs a
 * plugin which is not loaded loses its element on the next save, so the host
 * should know before the first keystroke. The check compares what went in with
 * what the editor would write out: an element key (tag and classes) that
 * appears less often in the output was dropped.
 */
const TAG_ALIASES: Record<string, string> = { b: 'strong', i: 'em', strike: 's', del: 's' };
// Elements whose loss is a normal clean-up, not content.
const IGNORED_TAGS = new Set(['p', 'br', 'tbody', 'thead', 'tfoot', 'colgroup', 'col', 'script', 'style', 'meta', 'link', 'title', 'wbr']);
// Wrappers that carry nothing without a class.
const BARE_WRAPPERS = new Set(['div', 'span', 'font']);

function keyOf(element: Element): string | null {
  const tag = element.localName.toLowerCase();
  if (IGNORED_TAGS.has(tag)) return null;
  const classes = [...element.classList].sort();
  if (BARE_WRAPPERS.has(tag) && classes.length === 0) return null;
  return `${TAG_ALIASES[tag] ?? tag}${classes.map((name) => `.${name}`).join('')}`;
}

function countKeys(html: string): Map<string, number> {
  const counts = new Map<string, number>();
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  for (const element of body.querySelectorAll('*')) {
    const key = keyOf(element);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function findDiscarded(inputHtml: string, outputHtml: string): DiscardedElement[] {
  if (inputHtml.trim() === '') return [];
  const output = countKeys(outputHtml);
  const discarded: DiscardedElement[] = [];
  for (const [key, count] of countKeys(inputHtml)) {
    if (output.has(key)) continue;
    const lost = count;
    const [tag = '', ...classes] = key.split('.');
    discarded.push({ tag, ...(classes.length > 0 ? { className: classes.join(' ') } : {}), count: lost });
  }
  return discarded;
}
