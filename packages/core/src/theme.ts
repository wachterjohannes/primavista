import type { EditorThemeClasses } from 'lexical';

export const defaultTheme: EditorThemeClasses = {
  paragraph: 'pv-paragraph',
  heading: {
    h1: 'pv-h1',
    h2: 'pv-h2',
    h3: 'pv-h3',
    h4: 'pv-h4',
    h5: 'pv-h5',
    h6: 'pv-h6',
  },
  quote: 'pv-quote',
  code: 'pv-code-block',
  hr: 'pv-hr',
  hrSelected: 'pv-hr--selected',
  list: {
    ul: 'pv-ul',
    ol: 'pv-ol',
    listitem: 'pv-li',
    nested: {
      listitem: 'pv-li-nested',
    },
  },
  link: 'pv-link',
  text: {
    bold: 'pv-bold',
    italic: 'pv-italic',
    underline: 'pv-underline',
    strikethrough: 'pv-strikethrough',
    subscript: 'pv-subscript',
    superscript: 'pv-superscript',
    code: 'pv-code',
  },
  table: 'pv-table',
  tableRow: 'pv-table-row',
  tableCell: 'pv-table-cell',
  tableCellHeader: 'pv-table-cell-header',
  tableCellSelected: 'pv-table-cell-selected',
  tableSelected: 'pv-table-selected',
  tableSelection: 'pv-table-selection',
};

/** Deep-merges theme objects. Later arguments win. */
export function mergeThemes(...themes: ReadonlyArray<EditorThemeClasses | undefined>): EditorThemeClasses {
  const result: Record<string, unknown> = {};
  for (const theme of themes) {
    if (!theme) continue;
    mergeInto(result, theme as Record<string, unknown>);
  }
  return result as EditorThemeClasses;
}

function mergeInto(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (isPlainObject(value) && isPlainObject(existing)) {
      mergeInto(existing, value);
    } else if (isPlainObject(value)) {
      const copy: Record<string, unknown> = {};
      mergeInto(copy, value);
      target[key] = copy;
    } else {
      target[key] = value;
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Every class name that appears anywhere in the theme. */
export function collectThemeClassNames(theme: EditorThemeClasses): Set<string> {
  const names = new Set<string>();
  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      for (const name of value.split(/\s+/)) {
        if (name) names.add(name);
      }
    } else if (isPlainObject(value)) {
      for (const child of Object.values(value)) walk(child);
    }
  };
  walk(theme);
  return names;
}
