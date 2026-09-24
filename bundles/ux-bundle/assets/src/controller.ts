import { Controller } from '@hotwired/stimulus';
import * as core from '@primavista/core';
import { createEditor, defaultPlugins, type EditorOptions, type PrimavistaEditor, type PrimavistaPlugin } from '@primavista/core';

export interface PreConnectDetail {
  /** Mutate this array to add, remove or replace plugins before the editor mounts. */
  plugins: PrimavistaPlugin[];
  textarea: HTMLTextAreaElement;
  /**
   * The `@primavista/core` module, including the Lexical re-exports. Custom
   * plugins must use this instance, because the controller ships its own copy.
   */
  core: typeof core;
}

export interface ConnectDetail {
  editor: PrimavistaEditor;
  textarea: HTMLTextAreaElement;
}

/**
 * Turns a `<textarea>` into a Primavista editor. The textarea stays in the
 * form and carries the HTML, so plain form posts and Live Components work
 * without extra wiring.
 *
 * Events: `primavista:pre-connect` (customize plugins), `primavista:connect`
 * (editor instance), `primavista:disconnect`.
 */
export default class extends Controller<HTMLTextAreaElement> {
  static override values = {
    placeholder: String,
    theme: String,
  };

  declare readonly placeholderValue: string;
  declare readonly hasPlaceholderValue: boolean;
  declare readonly themeValue: string;
  declare readonly hasThemeValue: boolean;

  editor: PrimavistaEditor | null = null;
  private host: HTMLDivElement | null = null;
  private wasRequired = false;
  private onTextareaFocus = (): void => this.editor?.focus();

  override connect(): void {
    const textarea = this.element;
    const plugins = defaultPlugins();
    this.dispatchEvent('pre-connect', { plugins, textarea, core } satisfies PreConnectDetail);

    const host = document.createElement('div');
    host.className = 'pv-host';
    textarea.insertAdjacentElement('afterend', host);
    this.host = host;

    const options: EditorOptions = {
      plugins,
      initialHtml: textarea.value,
      editable: !textarea.disabled && !textarea.readOnly,
    };
    if (this.hasPlaceholderValue && this.placeholderValue !== '') {
      options.placeholder = this.placeholderValue;
    }
    if (this.hasThemeValue && this.themeValue !== '') {
      options.theme = this.themeValue;
    }
    const labelId = labelIdFor(textarea);
    if (labelId) {
      options.ariaLabelledBy = labelId;
    }
    const editor = createEditor(host, options);
    this.editor = editor;

    editor.on('change', (html) => {
      textarea.value = html;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // A hidden required textarea blocks native form validation with an
    // "invalid form control is not focusable" error. Server-side validation
    // still applies.
    this.wasRequired = textarea.required;
    textarea.required = false;
    textarea.classList.add('pv-textarea');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.tabIndex = -1;
    textarea.addEventListener('focus', this.onTextareaFocus);

    this.dispatchEvent('connect', { editor, textarea } satisfies ConnectDetail);
  }

  override disconnect(): void {
    const textarea = this.element;
    this.editor?.destroy();
    this.editor = null;
    this.host?.remove();
    this.host = null;
    textarea.removeEventListener('focus', this.onTextareaFocus);
    textarea.required = this.wasRequired;
    textarea.classList.remove('pv-textarea');
    textarea.removeAttribute('aria-hidden');
    textarea.removeAttribute('tabindex');
    this.dispatchEvent('disconnect', { textarea });
  }

  private dispatchEvent(name: string, detail: object): void {
    this.dispatch(name, { detail, prefix: 'primavista' });
  }
}

function labelIdFor(textarea: HTMLTextAreaElement): string | undefined {
  const label = textarea.id ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(textarea.id)}"]`) : null;
  if (!label) return undefined;
  if (!label.id) label.id = `${textarea.id}_label`;
  return label.id;
}
