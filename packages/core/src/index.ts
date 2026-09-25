export { createEditor } from './editor';
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
 * Symfony UX build and cannot import "lexical" themselves. Bundler users can
 * import from the Lexical packages directly, it is the same instance.
 */
export * as lexical from 'lexical';
export * as lexicalLink from '@lexical/link';
export * as lexicalUtils from '@lexical/utils';
