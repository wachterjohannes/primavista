import type { EditorThemeClasses, Klass, LexicalEditor, LexicalNode } from 'lexical';

/**
 * A toolbar button. `isActive`, `isDisabled` and `isHidden` run inside
 * `editor.read()`, so `$getSelection()` and friends are available.
 */
export interface ToolbarButton {
  type?: 'button';
  id: string;
  label: string;
  /** Inline SVG markup or plain text. Falls back to `label`. */
  icon?: string;
  /** Items with different groups get a separator between them. */
  group?: string;
  shortcut?: string;
  isActive?: () => boolean;
  isDisabled?: () => boolean;
  isHidden?: () => boolean;
  onClick: (editor: LexicalEditor, context: ToolbarItemContext) => void;
}

export interface ToolbarSelectOption {
  value: string;
  label: string;
}

/** A native `<select>`. `getValue` runs inside `editor.read()`. */
export interface ToolbarSelect {
  type: 'select';
  id: string;
  label: string;
  group?: string;
  options: ToolbarSelectOption[];
  getValue: () => string;
  isDisabled?: () => boolean;
  isHidden?: () => boolean;
  onChange: (value: string, editor: LexicalEditor, context: ToolbarItemContext) => void;
}

export interface ToolbarMenuOption {
  value: string;
  label: string;
}

/** A button that opens a small list of options, for example one entry per link provider. */
export interface ToolbarMenu {
  type: 'menu';
  id: string;
  label: string;
  icon?: string;
  group?: string;
  options: ToolbarMenuOption[];
  isDisabled?: () => boolean;
  isHidden?: () => boolean;
  onSelect: (value: string, editor: LexicalEditor, context: ToolbarItemContext) => void;
}

export type ToolbarItem = ToolbarButton | ToolbarSelect | ToolbarMenu;

export interface ToolbarItemContext {
  /** The rendered control, useful for anchoring popovers. */
  element: HTMLElement;
  toolbar: ToolbarApi;
}

export interface ToolbarApi {
  readonly element: HTMLElement;
  /** Re-evaluates active, disabled and hidden states of all items. */
  refresh(): void;
  /**
   * Shows a secondary row below the main toolbar, for example a link form.
   * Only one panel is open at a time. Returns a function that closes it.
   */
  openPanel(render: (panel: HTMLElement, close: () => void) => void): () => void;
  closePanel(): void;
}

/**
 * A small floating panel anchored to an element inside the content, for
 * example the edit and unlink actions under a link. Only one is open at a time.
 */
export interface BalloonApi {
  show(anchor: HTMLElement, render: (balloon: HTMLElement, hide: () => void) => void): void;
  hide(): void;
  isOpen(): boolean;
  /** Recomputes the position, for example after the content scrolled. */
  reposition(): void;
}

/**
 * Looks up a UI string. `key` is stable (for example `toolbar.bold` or
 * `link.remove`), `fallback` is the English default. Hosts map keys to
 * their own translation system.
 */
export type Translate = (key: string, fallback: string) => string;

export interface PluginContext {
  editor: LexicalEditor;
  translate: Translate;
  /** The outer editor element (`.pv-editor`). */
  container: HTMLElement;
  /** The contenteditable element. */
  contentElement: HTMLElement;
  toolbar: ToolbarApi;
  balloon: BalloonApi;
}

/**
 * The extension point. Everything the editor can do is a plugin, including
 * bold and lists. Host systems such as Sulu register their own plugins for
 * internal links or media through the same interface.
 */
export interface PrimavistaPlugin {
  name: string;
  /** Lexical node classes this plugin needs. Registered before the editor is created. */
  nodes?: ReadonlyArray<Klass<LexicalNode>>;
  /** Theme classes merged into the editor theme. */
  theme?: EditorThemeClasses;
  /** Called once after the editor is mounted. Return a cleanup function. */
  register?: (context: PluginContext) => (() => void) | void;
  /** Toolbar items in display order. */
  toolbar?: ReadonlyArray<ToolbarItem>;
}

/** Knobs for the HTML the editor emits. Defaults match CKEditor's plain output. */
export interface HtmlOptions {
  /** Wrap tables in `<figure class="table">` like CKEditor 5 does. */
  tableWrapper?: 'figure' | null;
  /** Put leading header rows into `<thead>` instead of `<tbody>`. */
  tableHeadSection?: boolean;
  /** How an empty paragraph is written. CKEditor writes `&nbsp;`. */
  emptyParagraph?: 'br' | 'nbsp';
}

export interface EditorOptions {
  /** Defaults to `defaultPlugins()`. */
  plugins?: ReadonlyArray<PrimavistaPlugin>;
  initialHtml?: string;
  placeholder?: string;
  editable?: boolean;
  namespace?: string;
  /**
   * Visual theme. Adds `pv-theme-<name>` to the editor element, which the
   * theme stylesheet (for example `themes/sulu.css`) scopes its variables to.
   */
  theme?: string;
  /** Overrides individual Lexical theme classes. */
  themeClasses?: EditorThemeClasses;
  html?: HtmlOptions;
  /** Accessible name of the editing area. */
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  onError?: (error: Error) => void;
  /** Translates toolbar labels and form strings. Defaults to the English fallback. */
  translate?: Translate;
}

export type EditorEventMap = {
  change: (html: string) => void;
  focus: () => void;
  blur: () => void;
};

export interface PrimavistaEditor {
  readonly lexical: LexicalEditor;
  /** The outer element that was created inside the mount container. */
  readonly element: HTMLElement;
  readonly contentElement: HTMLElement;
  readonly toolbar: ToolbarApi;
  readonly balloon: BalloonApi;
  getHtml(): string;
  /** Replaces the document. Does not emit `change` and is not undoable. */
  setHtml(html: string): void;
  isEmpty(): boolean;
  focus(): void;
  blur(): void;
  setEditable(editable: boolean): void;
  isEditable(): boolean;
  on<K extends keyof EditorEventMap>(event: K, listener: EditorEventMap[K]): () => void;
  destroy(): void;
}
