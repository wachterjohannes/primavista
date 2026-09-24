/** Sulu's `enter_mode` option of the `text_editor` field type. */
export type SuluEnterMode = 'p' | 'br';

/**
 * Sulu's `enter_mode: br` storage format. Paragraph tags become comments and
 * `<br>` separators, a single paragraph is unwrapped. Same algorithm as
 * Sulu's CKEditor container, so stored content stays compatible.
 */
export function stripParagraphs(html: string): string {
  const single = html.match(/^<p>([^<>]*)<\/p>$/);
  if (single) return single[1] ?? '';
  const replaced = html.replace(/<p>/g, '<!--p-->').replace(/<\/p>/g, '<!--/p--><br></br>');
  const marker = '<br></br>';
  const last = replaced.lastIndexOf(marker);
  return last === -1 ? replaced : replaced.slice(0, last) + replaced.slice(last + marker.length);
}

/** Inverse of `stripParagraphs`. */
export function wrapParagraphs(html: string): string {
  if (!html.includes('<!--p-->')) return `<p>${html}</p>`;
  return html
    .replace(/<!--p-->/g, '<p>')
    .replace(/<!--\/p--><br><\/br>/g, '</p>')
    .replace(/<!--\/p-->/g, '</p>');
}

/** A stored Sulu value into editor HTML. Empty values become `""`. */
export function suluValueToHtml(value: string | null | undefined, enterMode: SuluEnterMode = 'p'): string {
  if (!value) return '';
  return enterMode === 'br' ? wrapParagraphs(value) : value;
}

/**
 * Editor HTML into the value Sulu stores. An empty editor reports
 * `undefined`, as the CKEditor adapter did, so the field counts as unset.
 */
export function htmlToSuluValue(html: string, enterMode: SuluEnterMode = 'p'): string | undefined {
  if (html === '') return undefined;
  return enterMode === 'br' ? stripParagraphs(html) : html;
}
