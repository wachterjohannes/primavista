import type { PrimavistaPlugin } from '../types';
import { formatting } from './formatting';
import { headings } from './headings';
import { history } from './history';
import { language } from './language';
import { links } from './links';
import { lists } from './lists';
import { pasteCleanup } from './pasteCleanup';
import { tables } from './tables';
import { alignment } from './alignment';

export { alignment, type Alignment, type AlignmentOptions } from './alignment';
export { formatting, type FormattingOptions, type InlineFormat } from './formatting';
export { headings, type HeadingsOptions } from './headings';
export { history, type HistoryOptions } from './history';
export {
  internalLinks,
  parseHref,
  buildHref,
  type InternalLinkDialogState,
  type InternalLinkProvider,
  type InternalLinkValues,
  type InternalLinksOptions,
} from './internalLinks';
export { language, $getLanguageAtSelection, $setLanguage, type Language, type LanguageOptions } from './language';
export { links, type LinkDialogState, type LinkValues, type LinksOptions } from './links';
export { lists, type ListsOptions, type ListTag } from './lists';
export { pasteCleanup, type PasteCleanupOptions } from './pasteCleanup';
export { tables, type TablesOptions } from './tables';

/** The standard set: history, inline formatting, headings, lists, links, alignment, tables, paste cleanup. `language` is opt-in. */
export function defaultPlugins(): PrimavistaPlugin[] {
  return [history(), formatting(), headings(), lists(), links(), alignment(), tables(), pasteCleanup()];
}
