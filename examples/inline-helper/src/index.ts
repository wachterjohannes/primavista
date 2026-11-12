import { inlineElement } from '@primavista/core';

/**
 * Highlight and abbreviation, written with the helper. There is no Lexical in
 * here, so a Lexical update cannot affect it.
 */
export const highlight = inlineElement({ name: 'highlight', tag: 'mark', toolbar: { label: 'Highlight' } });

export const abbreviation = inlineElement({ name: 'abbreviation', tag: 'abbr', attributes: ['title'], toolbar: false });
