import type { PrimavistaPlugin } from '../types';
import { formatting } from './formatting';
import { headings } from './headings';
import { history } from './history';
import { links } from './links';
import { lists } from './lists';
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
export { links, type LinkDialogState, type LinkValues, type LinksOptions } from './links';
export { lists } from './lists';
export { tables, type TablesOptions } from './tables';

/** The standard set: history, inline formatting, headings, lists, links, alignment, tables. */
export function defaultPlugins(): PrimavistaPlugin[] {
  return [history(), formatting(), headings(), lists(), links(), alignment(), tables()];
}
