import { $getRoot, type EditorState, type LexicalEditor } from 'lexical';
import type { PrimavistaEditor, PrimavistaPlugin } from '../types';

export type WordCountMode = 'words' | 'characters' | 'both';

export interface WordCountStats {
  words: number;
  /** Characters including spaces, without the line breaks between blocks. */
  characters: number;
}

export interface WordCountState extends WordCountStats {
  /** True when a `limit` is set and the counted unit exceeds it. */
  overLimit: boolean;
}

export interface WordCountOptions {
  /** What the status bar shows. Defaults to `both`. */
  mode?: WordCountMode;
  /**
   * Soft limit. Going over it marks the status bar and announces it to
   * screen readers, typing is never blocked.
   */
  limit?: number;
  /** The unit `limit` counts. Defaults to characters in `characters` mode and to words otherwise. */
  limitBy?: 'words' | 'characters';
  /** Called with the counts after every change, and once on mount. */
  onChange?: (state: WordCountState) => void;
}

/**
 * A status bar below the content with the number of words and characters.
 * It sits outside the editable element, so it never ends up in the HTML.
 * Hosts that only need the numbers call `getWordCount(editor)` or pass
 * `onChange`.
 */
export function wordCount(options: WordCountOptions = {}): PrimavistaPlugin {
  const mode = options.mode ?? 'both';
  const limitBy = options.limitBy ?? (mode === 'characters' ? 'characters' : 'words');
  return {
    name: 'word-count',
    register: ({ editor, container, translate }) => {
      const bar = document.createElement('div');
      bar.className = 'pv-word-count';
      // Only the limit message is live. Announcing the counts on every keystroke would drown the typing.
      const announcer = document.createElement('span');
      announcer.className = 'pv-word-count-alert';
      announcer.setAttribute('aria-live', 'polite');
      bar.appendChild(announcer);
      const counts: Partial<Record<keyof WordCountStats, HTMLElement>> = {};
      const units: Array<keyof WordCountStats> = mode === 'both' ? ['words', 'characters'] : [mode];
      for (const unit of units) {
        const el = document.createElement('span');
        el.className = `pv-word-count-${unit}`;
        bar.appendChild(el);
        counts[unit] = el;
      }
      container.appendChild(bar);

      const labels = {
        words: translate('wordCount.words', 'Words'),
        characters: translate('wordCount.characters', 'Characters'),
      };
      const overLimitLabel = translate('wordCount.overLimit', 'Over the limit');

      const render = (editorState: EditorState): void => {
        const stats = editorState.read($countWords);
        const overLimit = options.limit !== undefined && stats[limitBy] > options.limit;
        for (const unit of units) {
          const limit = options.limit !== undefined && unit === limitBy ? ` / ${options.limit}` : '';
          counts[unit]!.textContent = `${labels[unit]}: ${stats[unit]}${limit}`;
        }
        bar.classList.toggle('pv-word-count--over', overLimit);
        bar.dataset['words'] = String(stats.words);
        bar.dataset['characters'] = String(stats.characters);
        const message = overLimit ? overLimitLabel : '';
        if (announcer.textContent !== message) announcer.textContent = message;
        options.onChange?.({ ...stats, overLimit });
      };

      render(editor.getEditorState());
      const unregister = editor.registerUpdateListener(({ editorState, prevEditorState, dirtyElements, dirtyLeaves }) => {
        if (editorState === prevEditorState || (dirtyElements.size === 0 && dirtyLeaves.size === 0)) return;
        render(editorState);
      });
      return () => {
        unregister();
        bar.remove();
      };
    },
  };
}

/** Counts words and characters of an editor. Works with or without the `wordCount` plugin. */
export function getWordCount(editor: PrimavistaEditor | LexicalEditor): WordCountStats {
  const lexical = 'lexical' in editor ? editor.lexical : editor;
  return lexical.getEditorState().read($countWords);
}

/** Counts the current document. Must run inside `editor.read()` or `editor.update()`. */
export function $countWords(): WordCountStats {
  return countText($getRoot().getTextContent());
}

/*
 * Chinese and Japanese are written without spaces. Like word processors, the
 * count takes every ideograph and kana as a word of its own, which keeps the
 * result independent of a dictionary.
 */
const CJK = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}';
const WORD = new RegExp(`[${CJK}]|(?:(?![${CJK}])[\\p{L}\\p{N}\\p{M}])+(?:['’.\\-_](?:(?![${CJK}])[\\p{L}\\p{N}\\p{M}])+)*`, 'gu');

/** Counts words and characters of plain text. Line breaks are not characters. */
export function countText(text: string): WordCountStats {
  const flat = text.replace(/[\r\n]/g, '');
  return {
    words: text.match(WORD)?.length ?? 0,
    characters: countGraphemes(flat),
  };
}

const graphemes =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

function countGraphemes(text: string): number {
  if (!graphemes) return Array.from(text).length;
  let count = 0;
  for (const _ of graphemes.segment(text)) count++;
  return count;
}
