export { createEditor } from './editor';
export { LEXICAL_VERSION } from './lexicalGuard';
export * from './plugins';
export { icons, type IconName } from './icons';
export { defaultTheme, mergeThemes } from './theme';
export { PRIMAVISTA_SET_HTML_TAG } from './html';
export { cleanPastedHtml, type CleanPastedHtmlOptions } from './paste';
export {
  $createInternalLinkNode,
  $isExternalLinkNode,
  $isInternalLinkNode,
  InternalLinkNode,
  type InternalLinkAttributes,
  type SerializedInternalLinkNode,
} from './nodes/InternalLinkNode';
export {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
  type SerializedHorizontalRuleNode,
} from './nodes/HorizontalRuleNode';
export {
  $createLanguageNode,
  $isLanguageNode,
  LanguageNode,
  type SerializedLanguageNode,
} from './nodes/LanguageNode';
export {
  $getLinkAtSelection,
  $selectionTouchesLink,
  $wrapSelectionInLink,
  $unlinkSelection,
  registerLinkBalloon,
  type BalloonActions,
} from './linkUtils';
export type {
  BalloonApi,
  HtmlOptions,
  Translate,
  ToolbarMenu,
  ToolbarMenuOption,
  EditorEventMap,
  EditorOptions,
  PluginAllows,
  PluginContext,
  PrimavistaEditor,
  PrimavistaPlugin,
  ToolbarApi,
  ToolbarButton,
  ToolbarItem,
  ToolbarItemContext,
  ToolbarSelect,
  ToolbarSelectOption,
} from './types';

/*
 * Lexical re-exports for plugin authors who consume the self-contained
 * Symfony UX build, where there is no bundler to resolve a subpath. Everyone
 * else imports from "@primavista/core/lexical" and its siblings, which hand
 * out the same instance.
 */
export * as lexical from 'lexical';
export * as lexicalLink from '@lexical/link';
export * as lexicalUtils from '@lexical/utils';
