import {
  alignment,
  formatting,
  headings,
  history,
  internalLinks,
  links,
  lists,
  tables,
  type EditorOptions,
  type HeadingsOptions,
  type InlineFormat,
  type InternalLinkDialogState,
  type InternalLinksOptions,
  type LinkDialogState,
  type PrimavistaPlugin,
} from '@primavista/core';

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
/** Heading levels the select offers when a template sets no `formats`. `h1` is opt-in. */
export const SULU_DEFAULT_FORMATS: ReadonlyArray<HeadingLevel> = ['h2', 'h3', 'h4', 'h5', 'h6'];
/** Inline formats of Sulu's CKEditor toolbar, in order. */
export const SULU_INLINE_FORMATS: ReadonlyArray<InlineFormat> = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'subscript',
  'superscript',
  'code',
];
/** Prefix of the translation keys in Sulu's `admin.*.json`. */
export const SULU_TRANSLATION_PREFIX = 'sulu_admin.primavista.';

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
  /** One entry per link type from Sulu's `linkTypeRegistry`, without `external`. */
  providers: InternalLinksOptions['providers'];
  /** The template's `formats` option. Unknown entries are ignored, none means `SULU_DEFAULT_FORMATS`. */
  formats?: ReadonlyArray<string> | null;
  /** Sulu's `LinkTypeOverlay` for the provider. Without it the toolbar shows a plain form. */
  openInternalLinkDialog?: (state: InternalLinkDialogState) => void;
  /** Sulu's `ExternalLinkTypeOverlay`. Without it the toolbar shows a plain form. */
  openExternalLinkDialog?: (state: LinkDialogState) => void;
  /** Label of the balloon under an internal link. Defaults to `provider: href`. */
  describeInternalLink?: InternalLinksOptions['describe'];
}

/**
 * The plugin list of Sulu's `text_editor` field: the toolbar of Sulu's
 * CKEditor configuration, in the same order, with Sulu's link plugins.
 */
export function suluPlugins(options: SuluPluginsOptions): PrimavistaPlugin[] {
  const levels = (options.formats ?? []).filter(isHeadingLevel);
  const external: Parameters<typeof links>[0] = { defaultTarget: SULU_DEFAULT_TARGET };
  if (options.openExternalLinkDialog) external.openDialog = options.openExternalLinkDialog;
  const internal: SuluLinksOptions = { providers: options.providers };
  if (options.openInternalLinkDialog) internal.openDialog = options.openInternalLinkDialog;
  if (options.describeInternalLink) internal.describe = options.describeInternalLink;

  return [
    history(),
    formatting({ formats: SULU_INLINE_FORMATS }),
    headings({ levels: levels.length > 0 ? levels : SULU_DEFAULT_FORMATS }),
    lists(),
    links(external),
    suluLinks(internal),
    alignment(),
    tables(),
  ];
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
