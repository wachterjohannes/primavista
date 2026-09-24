import { mergeRegister } from '@lexical/utils';
import { $getSelection, $isRangeSelection, $isTextNode, type LexicalNode, type RangeSelection } from 'lexical';
import { icons } from '../icons';
import {
  $createLanguageNode,
  $getLanguageNodeOf,
  $isolateInLanguageNode,
  $mergeLanguageNodeWithPrevious,
  $unwrapLanguageNode,
  LanguageNode,
} from '../nodes/LanguageNode';
import type { PrimavistaPlugin } from '../types';

export interface Language {
  /** BCP 47 tag written into the `lang` attribute, for example `de` or `pt-BR`. */
  code: string;
  label: string;
}

export interface LanguageOptions {
  languages?: ReadonlyArray<Language>;
}

const DEFAULT_LANGUAGES: ReadonlyArray<Language> = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
];

const REMOVE = 'remove';

/**
 * Marks a text part as written in another language: `<span lang="fr">`.
 * One menu entry per language plus one to remove the mark. Pass the
 * languages the site actually uses.
 */
export function language(options: LanguageOptions = {}): PrimavistaPlugin {
  const languages = options.languages ?? DEFAULT_LANGUAGES;
  return {
    name: 'language',
    nodes: [LanguageNode],
    theme: { language: 'pv-language' },
    register: ({ editor }) =>
      mergeRegister(
        editor.registerNodeTransform(LanguageNode, (node) => {
          if (node.getChildrenSize() === 0) {
            node.remove();
            return;
          }
          $mergeLanguageNodeWithPrevious(node);
        }),
      ),
    toolbar: [
      {
        type: 'menu',
        id: 'language',
        label: 'Language',
        icon: icons.language,
        group: 'language',
        options: [...languages.map((entry) => ({ value: entry.code, label: entry.label })), { value: REMOVE, label: 'Remove language' }],
        isActive: () => $getLanguageAtSelection() !== null,
        isDisabled: () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return true;
          return selection.isCollapsed() && $getLanguageAtSelection() === null;
        },
        onSelect: (value, editor) => {
          editor.update(() => $setLanguage(value === REMOVE ? null : value));
          editor.focus();
        },
      },
    ],
  };
}

/** The language of the text part at the selection anchor, or null. */
export function $getLanguageAtSelection(): string | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  return $getLanguageNodeOf(selection.anchor.getNode())?.getLang() ?? null;
}

/**
 * Sets the language of the selected text, or removes it with null. A
 * collapsed selection inside a language span changes that whole span.
 */
export function $setLanguage(lang: string | null): void {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return;

  if (selection.isCollapsed()) {
    const node = $getLanguageNodeOf(selection.anchor.getNode());
    if (!node) return;
    if (lang === null) $unwrapLanguageNode(node);
    else node.setLang(lang);
    return;
  }

  const textNodes = selection.extract().filter($isTextNode);
  const touched: LanguageNode[] = [];
  for (const textNode of textNodes) {
    if (textNode.getTextContent() === '') continue;
    const existing = $getLanguageNodeOf(textNode);
    if (existing) {
      // Only the selected part of the span changes, the rest keeps its language.
      const own = $isolateInLanguageNode(existing, textNode);
      if (lang === null) $unwrapLanguageNode(own);
      else touched.push(own.setLang(lang));
      continue;
    }
    if (lang === null) continue;
    const created = $createLanguageNode(lang);
    textNode.insertBefore(created);
    created.append(textNode);
    touched.push(created);
  }
  for (const node of touched) {
    if (node.isAttached()) $mergeLanguageNodeWithPrevious(node);
  }
  $reselect(selection, textNodes);
}

function $reselect(selection: RangeSelection, nodes: LexicalNode[]): void {
  const attached = nodes.filter((node) => node.isAttached() && $isTextNode(node));
  const first = attached[0];
  const last = attached[attached.length - 1];
  if (!first || !last || !$isTextNode(first) || !$isTextNode(last)) return;
  selection.anchor.set(first.getKey(), 0, 'text');
  selection.focus.set(last.getKey(), last.getTextContentSize(), 'text');
}
