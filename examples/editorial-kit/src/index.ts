import {
  blockElement,
  inlineElement,
  voidElement,
  type PluginContext,
  type PrimavistaEditor,
  type PrimavistaPlugin,
} from '@primavista/core';

/*
 * An editorial toolkit built only from Primavista's own API. There is no
 * import from lexical, no $-function and no editor.update(). Each part says
 * which piece of the API it uses.
 */

/** Level 2 helpers: two colours of one tag, an element with an attribute, a plain inline element. */
export const highlightYellow = inlineElement({ name: 'highlight-yellow', tag: 'mark', className: 'yellow', toolbar: { label: 'Highlight yellow' } });
export const highlightGreen = inlineElement({ name: 'highlight-green', tag: 'mark', className: 'green', toolbar: { label: 'Highlight green' } });
export const abbreviation = inlineElement({ name: 'abbreviation', tag: 'abbr', attributes: ['title'], toolbar: { label: 'Abbreviation' } });
export const keyboardKey = inlineElement({ name: 'keyboard-key', tag: 'kbd', toolbar: { label: 'Keyboard key' } });

/** A box around whole blocks. */
export const note = blockElement({ name: 'note', tag: 'aside', className: 'note', toolbar: { label: 'Note' } });

/** A placeholder with a preview in the editor and the bare element in the HTML. */
export const newsletter = voidElement({
  name: 'newsletter',
  tag: 'div',
  defaults: { 'data-widget': 'newsletter' },
  render: (element) => {
    element.textContent = 'Newsletter sign-up';
  },
  toolbar: { label: 'Newsletter' },
});

export interface Snippet {
  id: string;
  label: string;
  html: string;
}

export const DEFAULT_SNIPPETS: ReadonlyArray<Snippet> = [
  { id: 'disclaimer', label: 'Disclaimer', html: '<p><em>Prices include VAT.</em></p>' },
  { id: 'contact', label: 'Contact box', html: '<aside class="note"><p>Questions? Write to <strong>info@example.org</strong>.</p></aside>' },
];

/**
 * A menu that inserts HTML. Uses `context.primavista.insertHtml`, so the
 * result goes through the same import rules as loaded content and is one undo
 * step.
 */
export function snippets(list: ReadonlyArray<Snippet> = DEFAULT_SNIPPETS): PrimavistaPlugin {
  let primavista: PrimavistaEditor | null = null;
  return {
    name: 'snippets',
    register: (context) => {
      primavista = context.primavista;
    },
    toolbar: [
      {
        type: 'menu',
        id: 'snippets',
        label: 'Snippets',
        icon: 'Snippets',
        group: 'insert',
        options: list.map(({ id, label }) => ({ value: id, label })),
        onSelect: (value) => {
          const snippet = list.find((entry) => entry.id === value);
          if (snippet) primavista?.insertHtml(snippet.html);
        },
      },
    ],
  };
}

export const SPECIAL_CHARACTERS = ['§', '©', '®', '€', '–', '…', '→', '·'] as const;

/** A menu that inserts characters. Uses `insertText`, which replaces a selection. */
export function specialCharacters(characters: ReadonlyArray<string> = SPECIAL_CHARACTERS): PrimavistaPlugin {
  let primavista: PrimavistaEditor | null = null;
  return {
    name: 'special-characters',
    register: (context) => {
      primavista = context.primavista;
    },
    toolbar: [
      {
        type: 'menu',
        id: 'special-characters',
        label: 'Special characters',
        icon: 'Ω',
        group: 'insert',
        options: characters.map((character) => ({ value: character, label: character })),
        onSelect: (value) => primavista?.insertText(value),
      },
    ],
  };
}

const TRANSFORMS: Record<string, (text: string) => string> = {
  upper: (text) => text.toUpperCase(),
  lower: (text) => text.toLowerCase(),
  title: (text) => text.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, space: string, letter: string) => space + letter.toUpperCase()),
};

/**
 * Rewrites the selected text. Reads it with `getSelectedText` and writes it
 * back with `insertText`. The result is plain text, so formats inside the
 * selection are lost, which is the price of staying away from the nodes.
 */
export function textCase(): PrimavistaPlugin {
  let primavista: PrimavistaEditor | null = null;
  return {
    name: 'text-case',
    register: (context) => {
      primavista = context.primavista;
    },
    toolbar: [
      {
        type: 'menu',
        id: 'text-case',
        label: 'Text case',
        icon: 'Aa',
        group: 'transform',
        options: [
          { value: 'upper', label: 'UPPERCASE' },
          { value: 'lower', label: 'lowercase' },
          { value: 'title', label: 'Title Case' },
        ],
        // `isDisabled` runs inside editor.read(), where getSelectedText() may read again.
        isDisabled: () => (primavista?.getSelectedText() ?? '') === '',
        onSelect: (value) => {
          const text = primavista?.getSelectedText() ?? '';
          const transform = TRANSFORMS[value];
          if (text !== '' && transform) primavista?.insertText(transform(text));
        },
      },
    ],
  };
}

/**
 * Shows the title of an abbreviation in a balloon while the pointer is over
 * it. Pure DOM: the content element and `context.balloon`.
 */
export function abbreviationTooltip(): PrimavistaPlugin {
  return {
    name: 'abbreviation-tooltip',
    register: ({ contentElement, balloon }: PluginContext) => {
      const onOver = (event: Event): void => {
        const target = event.target instanceof Element ? event.target.closest('abbr[title]') : null;
        if (!(target instanceof HTMLElement)) return;
        balloon.show(target, (element) => {
          element.textContent = target.getAttribute('title') ?? '';
        });
      };
      const onOut = (event: Event): void => {
        if (event.target instanceof Element && event.target.closest('abbr[title]')) balloon.hide();
      };
      contentElement.addEventListener('mouseover', onOver);
      contentElement.addEventListener('mouseout', onOut);
      return () => {
        contentElement.removeEventListener('mouseover', onOver);
        contentElement.removeEventListener('mouseout', onOut);
      };
    },
  };
}

/**
 * A status line under the content with the reading time. Uses the `change`
 * event of the editor and `getHtml`, and adds one element to the container.
 */
export function readingTime(wordsPerMinute = 200): PrimavistaPlugin {
  return {
    name: 'reading-time',
    register: ({ primavista, container }) => {
      const line = document.createElement('div');
      line.className = 'reading-time';
      line.setAttribute('aria-live', 'off');
      const update = (): void => {
        const text = new DOMParser().parseFromString(primavista.getHtml(), 'text/html').body.textContent ?? '';
        const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
        line.textContent = `${Math.max(1, Math.ceil(words / wordsPerMinute))} min read`;
      };
      update();
      container.appendChild(line);
      const off = primavista.on('change', update);
      return () => {
        off();
        line.remove();
      };
    },
  };
}

/** Everything above, in toolbar order. */
export function editorialKit(): PrimavistaPlugin[] {
  return [
    highlightYellow,
    highlightGreen,
    abbreviation,
    keyboardKey,
    note,
    newsletter,
    snippets(),
    specialCharacters(),
    textCase(),
    abbreviationTooltip(),
    readingTime(),
  ];
}
