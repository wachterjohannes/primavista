/**
 * How a helper recognises its element in loaded or pasted HTML. The tag alone
 * is not enough for common tags: `<span>`, `<div>` and friends carry other
 * content too, and two helpers may share a tag, such as `mark.yellow` and
 * `mark.green`.
 */
export interface ElementMatch {
  tag: string;
  /** The element must have this class. */
  className?: string | undefined;
  /** The element must have all of these attributes. */
  requires?: ReadonlyArray<string> | undefined;
}

/** Tags that stand for something else in most content. A helper needs a class or an attribute to claim one. */
const GENERIC_TAGS = new Set([
  'span', 'div', 'p', 'a', 'li', 'ul', 'ol', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'blockquote', 'pre', 'code', 'hr', 'br',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup', 'font', 'body', 'html',
]);

/** Throws when a generic tag has no class or attribute to tell the helper's elements apart. */
export function assertSpecificMatch(helper: string, name: string, match: ElementMatch): void {
  if (!GENERIC_TAGS.has(match.tag)) return;
  if (match.className || (match.requires?.length ?? 0) > 0) return;
  throw new Error(
    `Primavista: ${helper}("${name}") claims <${match.tag}>, which other content uses too. ` +
      `Set className or requires so only your elements match.`,
  );
}

export function elementMatches(element: Element, match: ElementMatch): boolean {
  if (element.localName !== match.tag) return false;
  if (match.className && !element.classList.contains(match.className)) return false;
  return (match.requires ?? []).every((name) => element.hasAttribute(name));
}

/** A CSS selector for the elements the match claims. Class names with special characters are escaped. */
export function matchSelector(match: ElementMatch): string {
  const className = match.className ? `.${match.className.replace(/[^\w-]/g, (c) => `\\${c}`)}` : '';
  const requires = (match.requires ?? []).map((name) => `[${name.replace(/[^\w:-]/g, (c) => `\\${c}`)}]`).join('');
  return `${match.tag}${className}${requires}`;
}
