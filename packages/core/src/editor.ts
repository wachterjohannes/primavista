import {
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  createEditor as createLexicalEditor,
  FOCUS_COMMAND,
  HISTORIC_TAG,
  type Klass,
  type LexicalNode,
} from 'lexical';
import { registerRichText } from '@lexical/rich-text';
import { mergeRegister } from '@lexical/utils';
import { createBalloon } from './balloon';
import { $isDocumentEmpty, $loadHtml, $serializeToHtml, createExportMap, SET_HTML_TAG } from './html';
import { defaultPlugins } from './plugins';
import { collectAllowed } from './plugins/allowed';
import { collectThemeClassNames, defaultTheme, mergeThemes } from './theme';
import { createToolbar } from './toolbar';
import type { EditorEventMap, EditorOptions, HtmlOptions, PrimavistaEditor, PrimavistaPlugin } from './types';

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

  const setHtml = (html: string): void => {
    lexical.update(() => $loadHtml(lexical, html), { discrete: true, tag: [SET_HTML_TAG, HISTORIC_TAG] });
    lastHtml = serialize();
    updatePlaceholder();
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
  for (const plugin of plugins) {
    const cleanup = plugin.register?.({ editor: lexical, translate, container: element, contentElement, toolbar, balloon, allowed });
    if (cleanup) pluginCleanups.push(cleanup);
  }
  toolbar.refresh();

  let destroyed = false;

  return {
    lexical,
    element,
    contentElement,
    toolbar,
    balloon,
    getHtml: () => serialize(),
    setHtml,
    isEmpty: () => lexical.read(() => $isDocumentEmpty()),
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
