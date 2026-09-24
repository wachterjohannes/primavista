import type { EditorOptions } from './types';

/**
 * Options that make the editor read and write HTML exactly like Sulu's
 * CKEditor 5 setup did: tables wrapped in `<figure class="table">` with a
 * `<thead>`, empty paragraphs as `&nbsp;`, and the Sulu theme. Spread it into
 * `createEditor` options. The plugin list stays with the host.
 */
export function suluPreset(): Pick<EditorOptions, 'theme' | 'html'> {
  return {
    theme: 'sulu',
    html: {
      tableWrapper: 'figure',
      tableHeadSection: true,
      emptyParagraph: 'nbsp',
    },
  };
}
