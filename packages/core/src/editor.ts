import {
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  createEditor as createLexicalEditor,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  FOCUS_COMMAND,
  FORMAT_TEXT_COMMAND,
  HISTORIC_TAG,
  type Klass,
  type LexicalNode,
} from 'lexical';
import { registerRichText } from '@lexical/rich-text';
import { mergeRegister } from '@lexical/utils';
import { createBalloon } from './balloon';
import { $insertHtml, $isDocumentEmpty, $loadHtml, $serializeToHtml, createExportMap, SET_HTML_TAG } from './html';
import { defaultPlugins } from './plugins';
import { collectAllowed } from './plugins/allowed';
import { InternalLinkNode, registerInternalLinkClass } from './nodes/InternalLinkNode';
import { matchSelector } from './nodes/match';
import { collectSchema } from './plugins/schema';
import { collectThemeClassNames, defaultTheme, mergeThemes } from './theme';
import { createToolbar } from './toolbar';
import { $readSelection, sameSelection } from './selection';
import { assertSameLexical } from './lexicalGuard';
import { findDiscarded } from './discard';
import type { DiscardedElement, EditorEventMap, EditorOptions, HtmlOptions, PrimavistaEditor, PrimavistaPlugin, SelectionInfo } from './types';

/**
 * Mounts an editor into `container`. The container stays untouched apart from
 * the `.pv-editor` element that is appended to it and removed on `destroy()`.
 */
export function createEditor(container: HTMLElement, options: EditorOptions = {}): PrimavistaEditor {
  const plugins: ReadonlyArray<PrimavistaPlugin> = options.plugins ?? defaultPlugins();
  assertUniquePluginNames(plugins);

  const theme = mergeThemes(defaultTheme, ...plugins.map((p) => p.theme), options.themeClasses);
  const htmlOptions: Required<HtmlOptions> = {
    tableWrapper: options.html?.tableWrapper ?? null,
    tableHeadSection: options.html?.tableHeadSection ?? false,
    emptyParagraph: options.html?.emptyParagraph ?? 'br',
  };
  const themeClassNames = collectThemeClassNames(theme);
  const nodes = dedupeNodes(plugins.flatMap((p) => p.nodes ?? []));
  assertSameLexical(plugins);
  const schema = collectSchema(plugins);
  const inlineTags = schema.elements
    .filter((element) => element.kind === 'inline')
    .map((element) => matchSelector({ tag: element.tag, className: element.className, requires: element.requires }));

  const lexical = createLexicalEditor({
    namespace: options.namespace ?? 'primavista',
    nodes,
    theme,
    editable: options.editable ?? true,
    html: { export: createExportMap(htmlOptions) },
    onError:
      options.onError ??
      ((error) => {
        throw error;
      }),
  });
  for (const node of nodes) {
    if (node.prototype instanceof InternalLinkNode) registerInternalLinkClass(lexical, node as typeof InternalLinkNode);
  }

  const element = document.createElement('div');
  element.className = 'pv-editor';
  if (options.theme) element.classList.add(`pv-theme-${options.theme}`);

  const toolbarHost = document.createElement('div');
  toolbarHost.className = 'pv-toolbar-host';
  element.appendChild(toolbarHost);

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'pv-content-wrapper';
  element.appendChild(contentWrapper);

  const contentElement = document.createElement('div');
  contentElement.className = 'pv-content';
  contentElement.setAttribute('role', 'textbox');
  contentElement.setAttribute('aria-multiline', 'true');
  if (options.ariaLabel) contentElement.setAttribute('aria-label', options.ariaLabel);
  if (options.ariaLabelledBy) contentElement.setAttribute('aria-labelledby', options.ariaLabelledBy);
  if (options.ariaDescribedBy) contentElement.setAttribute('aria-describedby', options.ariaDescribedBy);
  contentWrapper.appendChild(contentElement);

  const placeholder = document.createElement('div');
  placeholder.className = 'pv-placeholder';
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.textContent = options.placeholder ?? '';
  placeholder.hidden = !options.placeholder;
  contentWrapper.appendChild(placeholder);

  container.appendChild(element);

  const listeners: { [K in keyof EditorEventMap]: Set<EditorEventMap[K]> } = {
    change: new Set(),
    selectionchange: new Set(),
    focus: new Set(),
    blur: new Set(),
  };
  const emit = <K extends keyof EditorEventMap>(event: K, ...args: Parameters<EditorEventMap[K]>): void => {
    for (const listener of listeners[event]) {
      (listener as (...a: Parameters<EditorEventMap[K]>) => void)(...args);
    }
  };

  const serialize = (): string => lexical.read(() => $serializeToHtml(lexical, { themeClassNames, html: htmlOptions }));
  let lastHtml = '';
  let lastSelection: SelectionInfo | null = null;

  let discarded: DiscardedElement[] = [];
  const setHtml = (html: string): void => {
    lexical.update(() => $loadHtml(lexical, html, inlineTags), { discrete: true, tag: [SET_HTML_TAG, HISTORIC_TAG] });
    lastHtml = serialize();
    updatePlaceholder();
    const before = JSON.stringify(discarded);
    discarded = findDiscarded(html, lastHtml);
    // Only when the list changed, a form that sets the same value again must not repeat the report.
    if (JSON.stringify(discarded) !== before) options.onDiscard?.(discarded);
  };

  const updatePlaceholder = (): void => {
    if (!options.placeholder) return;
    placeholder.hidden = !lexical.read(() => $isDocumentEmpty());
  };

  setHtml(options.initialHtml ?? '');
  lexical.setRootElement(contentElement);

  const toolbarItems = plugins.flatMap((p) => p.toolbar ?? []);
  const translate = options.translate ?? ((_key: string, fallback: string) => fallback);
  const toolbar = createToolbar(lexical, toolbarItems, toolbarHost, translate);
  toolbarHost.hidden = toolbarItems.length === 0;
  const balloon = createBalloon(contentWrapper);

  const applyEditableState = (): void => {
    const editable = lexical.isEditable();
    contentElement.setAttribute('contenteditable', editable ? 'true' : 'false');
    element.classList.toggle('pv-editor--readonly', !editable);
    contentElement.setAttribute('aria-readonly', String(!editable));
  };
  applyEditableState();

  const unregisterCore = mergeRegister(
    registerRichText(lexical),
    lexical.registerUpdateListener(({ dirtyElements, dirtyLeaves, tags }) => {
      updatePlaceholder();
      if (listeners.selectionchange.size > 0) {
        const selection = lexical.read(() => $readSelection(lexical));
        if (!sameSelection(selection, lastSelection)) {
          lastSelection = selection;
          emit('selectionchange', selection);
        }
      }
      if (tags.has(SET_HTML_TAG)) return;
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
      const html = serialize();
      if (html === lastHtml) return;
      lastHtml = html;
      emit('change', html);
    }),
    lexical.registerEditableListener(applyEditableState),
    lexical.registerCommand(
      FOCUS_COMMAND,
      () => {
        element.classList.add('pv-editor--focused');
        emit('focus');
        return false;
      },
      COMMAND_PRIORITY_LOW,
    ),
    lexical.registerCommand(
      BLUR_COMMAND,
      () => {
        element.classList.remove('pv-editor--focused');
        emit('blur');
        return false;
      },
      COMMAND_PRIORITY_LOW,
    ),
  );

  const allowed = collectAllowed(plugins);
  const pluginCleanups: Array<() => void> = [];
  const failedPlugins: string[] = [];

  let destroyed = false;

  const api: PrimavistaEditor = {
    lexical,
    element,
    contentElement,
    toolbar,
    balloon,
    getHtml: () => serialize(),
    getDiscarded: () => discarded,
    failedPlugins,
    setHtml,
    isEmpty: () => lexical.read(() => $isDocumentEmpty()),
    insertText: (text) => {
      lexical.update(
        () => {
          const selection = $getSelection();
          // Without a selection the text goes to the end, like `insertHtml`.
          if ($isRangeSelection(selection)) selection.insertText(text);
          else $getRoot().selectEnd().insertText(text);
        },
        { discrete: true },
      );
    },
    insertHtml: (html) => {
      lexical.update(() => $insertHtml(lexical, html, inlineTags), { discrete: true });
    },
    getSelection: () => lexical.read(() => $readSelection(lexical)),
    getSelectedText: () =>
      lexical.read(() => {
        const selection = $getSelection();
        return $isRangeSelection(selection) ? selection.getTextContent() : '';
      }),
    toggleFormat: (format) => {
      lexical.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    },
    focus: () => lexical.focus(undefined, { defaultSelection: 'rootEnd' }),
    blur: () => lexical.blur(),
    setEditable: (editable) => lexical.setEditable(editable),
    isEditable: () => lexical.isEditable(),
    on(event, listener) {
      const set = listeners[event] as Set<typeof listener>;
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const cleanup of pluginCleanups.reverse()) cleanup();
      balloon.destroy();
      toolbar.destroy();
      unregisterCore();
      lexical.setRootElement(null);
      element.remove();
      for (const set of Object.values(listeners)) set.clear();
    },
  };

  for (const plugin of plugins) {
    try {
      const cleanup = plugin.register?.({ editor: lexical, primavista: api, translate, container: element, contentElement, toolbar, balloon, allowed, schema });
      if (cleanup) pluginCleanups.push(cleanup);
    } catch (error) {
      // One broken extension must not take the editor and its content down.
      failedPlugins.push(plugin.name);
      const reported = error instanceof Error ? error : new Error(String(error));
      (options.onPluginError ?? ((name, cause) => console.error(`Primavista: plugin "${name}" failed to register and was skipped.`, cause)))(plugin.name, reported);
    }
  }
  toolbar.refresh();

  return api;
}

function assertUniquePluginNames(plugins: ReadonlyArray<PrimavistaPlugin>): void {
  const seen = new Set<string>();
  for (const plugin of plugins) {
    if (seen.has(plugin.name)) {
      throw new Error(`Primavista: plugin "${plugin.name}" is registered twice.`);
    }
    seen.add(plugin.name);
  }
}

function dedupeNodes(nodes: ReadonlyArray<Klass<LexicalNode>>): Array<Klass<LexicalNode>> {
  return Array.from(new Set(nodes));
}
