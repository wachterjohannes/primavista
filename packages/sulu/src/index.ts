import {
  alignment,
  formatting,
  headings,
  history,
  internalLinks,
  language,
  links,
  lists,
  pasteCleanup,
  tables,
  type EditorOptions,
  type HeadingsOptions,
  type InlineFormat,
  type InternalLinkDialogState,
  type InternalLinksOptions,
  type Language,
  type LinkDialogState,
  type ListTag,
  type PrimavistaPlugin,
} from '@primavista/core';
import type { SuluEnterMode } from './enterMode';

export {
  htmlToSuluValue,
  stripParagraphs,
  suluValueToHtml,
  wrapParagraphs,
  type SuluEnterMode,
} from './enterMode';

type HeadingLevel = NonNullable<HeadingsOptions['levels']>[number];

/** Custom element Sulu's MarkupBundle resolves when it renders a page. */
export const SULU_LINK_TAG = 'sulu-link';
/** Attribute `LinkTag::validateAll` sets to `unpublished` or `removed` when content loads into the admin. */
export const SULU_VALIDATION_ATTRIBUTE = 'sulu-validation-state';
/** Sulu's CKEditor setup wrote `_self` on every new link. */
export const SULU_DEFAULT_TARGET = '_self';
/** Prefix of the translation keys in Sulu's `admin.*.json`. */
export const SULU_TRANSLATION_PREFIX = 'sulu_admin.primavista.';

/**
 * A text editor config as Sulu 3.1 defines it under
 * `sulu_admin.text_editor.configs`: the elements the editor may produce,
 * the attributes it may write, and the enter mode. Nothing in it is specific
 * to an editor implementation, which is why Primavista can be driven by it.
 */
export interface SuluTextEditorConfig {
  tags: ReadonlyArray<string>;
  attributes: ReadonlyArray<string>;
  enterMode: SuluEnterMode;
}

const HEADING_TAGS: ReadonlyArray<HeadingLevel> = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

/** Sulu's shipped `default` config: the toolbar Sulu had before configs existed. */
export const SULU_DEFAULT_CONFIG: SuluTextEditorConfig = {
  enterMode: 'p',
  tags: ['h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'i', 'u', 's', 'sub', 'sup', 'ul', 'ol', 'a', 'table', 'code'],
  attributes: ['align'],
};

/** Sulu's shipped `mini` config: inline markup only, paragraphs as line breaks. */
export const SULU_MINI_CONFIG: SuluTextEditorConfig = {
  enterMode: 'br',
  tags: ['a', 'strong', 'i'],
  attributes: [],
};

/** Heading levels the select offered before configs, `h1` was opt-in through `formats`. */
export const SULU_DEFAULT_FORMATS: ReadonlyArray<HeadingLevel> = ['h2', 'h3', 'h4', 'h5', 'h6'];

/** Inline format per tag key of a Sulu config. Italic is `i`, the element CKEditor produced. */
const INLINE_FORMATS: ReadonlyArray<[string, InlineFormat]> = [
  ['strong', 'bold'],
  ['i', 'italic'],
  ['u', 'underline'],
  ['s', 'strikethrough'],
  ['sub', 'subscript'],
  ['sup', 'superscript'],
  ['code', 'code'],
];

/**
 * The config a Sulu 3.0 property resolves to. The deprecated `formats`
 * param replaces the heading tags of the default config, `enter_mode`
 * overrides the enter mode. Same rules as Sulu 3.1's `resolveTextEditorConfig`.
 */
export function suluConfigFromLegacyOptions(options: {
  formats?: ReadonlyArray<string> | null;
  enterMode?: SuluEnterMode | null;
}): SuluTextEditorConfig {
  const base = SULU_DEFAULT_CONFIG;
  const formats = options.formats?.filter(isHeadingLevel);
  return {
    enterMode: options.enterMode ?? base.enterMode,
    attributes: base.attributes,
    tags: formats === undefined || options.formats?.length === 0
      ? base.tags
      : [...base.tags.filter((tag) => !isHeadingLevel(tag)), ...formats],
  };
}

export type SuluLinksOptions = Omit<InternalLinksOptions, 'tag' | 'validationAttribute'>;

/**
 * The core's internal links in Sulu's format:
 * `<sulu-link href="uuid?query#anchor" provider="page" target="_self" title="…" sulu-validation-state="…">`.
 * Providers are Sulu's link types (pages, media, articles, …).
 */
export function suluLinks(options: SuluLinksOptions): PrimavistaPlugin {
  return internalLinks({
    defaultTarget: SULU_DEFAULT_TARGET,
    ...options,
    tag: SULU_LINK_TAG,
    validationAttribute: SULU_VALIDATION_ATTRIBUTE,
  });
}

export interface SuluPluginsOptions {
  /** The property's text editor config. Defaults to Sulu's `default` config. */
  config?: SuluTextEditorConfig;
  /** One entry per link type from Sulu's `linkTypeRegistry`, without `external`. */
  providers: InternalLinksOptions['providers'];
  /** Languages the `lang` menu offers, for example the system's localizations. */
  languages?: ReadonlyArray<Language>;
  /** Sulu's `LinkTypeOverlay` for the provider. Without it the toolbar shows a plain form. */
  openInternalLinkDialog?: (state: InternalLinkDialogState) => void;
  /** Sulu's `ExternalLinkTypeOverlay`. Without it the toolbar shows a plain form. */
  openExternalLinkDialog?: (state: LinkDialogState) => void;
  /** Label of the balloon under an internal link. Defaults to `provider: href`. */
  describeInternalLink?: InternalLinksOptions['describe'];
}

/**
 * The plugin list of Sulu's `text_editor` field for a config. Every tag and
 * attribute of the config switches on the plugin that produces it, in the
 * order of Sulu's CKEditor toolbar: heading, inline formats, lists, links,
 * alignment, language, table. Paste cleanup comes last and lets pasted
 * content keep only what the config allows.
 */
export function suluPlugins(options: SuluPluginsOptions): PrimavistaPlugin[] {
  const config = options.config ?? SULU_DEFAULT_CONFIG;
  const tags = new Set(config.tags);
  const attributes = new Set(config.attributes);
  const plugins: PrimavistaPlugin[] = [history()];

  const levels = HEADING_TAGS.filter((tag) => tags.has(tag));
  if (levels.length > 0) plugins.push(headings({ levels }));

  const formats = INLINE_FORMATS.filter(([tag]) => tags.has(tag)).map(([, format]) => format);
  if (formats.length > 0) plugins.push(formatting({ formats }));

  const listTypes: ListTag[] = (['ul', 'ol'] as const).filter((tag) => tags.has(tag));
  if (listTypes.length > 0) plugins.push(lists({ types: listTypes }));

  if (tags.has('a')) {
    const external: Parameters<typeof links>[0] = { defaultTarget: SULU_DEFAULT_TARGET };
    if (options.openExternalLinkDialog) external.openDialog = options.openExternalLinkDialog;
    const internal: SuluLinksOptions = { providers: options.providers };
    if (options.openInternalLinkDialog) internal.openDialog = options.openInternalLinkDialog;
    if (options.describeInternalLink) internal.describe = options.describeInternalLink;
    plugins.push(links(external), suluLinks(internal));
  }

  if (attributes.has('align')) plugins.push(alignment());
  if (attributes.has('lang')) plugins.push(language(options.languages ? { languages: options.languages } : {}));
  if (tags.has('table')) plugins.push(tables());

  plugins.push(pasteCleanup({ formats, alignment: attributes.has('align') }));

  return plugins;
}

/**
 * Options that make the editor read and write HTML exactly like Sulu's
 * CKEditor 5 setup did: tables wrapped in `<figure class="table">` with a
 * `<thead>`, empty paragraphs as `&nbsp;`, and the Sulu theme from
 * `@primavista/sulu/sulu.css`. Spread it into the editor options.
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

/** `toolbar.bold` becomes `sulu_admin.primavista.toolbar.bold`, the key in Sulu's translation files. */
export function suluTranslationKey(key: string): string {
  return SULU_TRANSLATION_PREFIX + key;
}

function isHeadingLevel(value: string): value is HeadingLevel {
  return /^h[1-6]$/.test(value);
}
