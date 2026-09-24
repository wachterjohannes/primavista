import {
  createEditor,
  type EditorOptions,
  type PrimavistaEditor,
  type HtmlOptions,
  type PrimavistaPlugin,
  type Translate,
} from '@primavista/core';
// Classic JSX runtime on purpose: React 17 hosts such as Sulu Admin bundle
// this file as strict ESM, where `react/jsx-runtime` does not resolve.
import * as React from 'react';
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';

export interface EditorProps {
  /** Controlled HTML value. Changes from outside replace the document. */
  value?: string;
  /** Initial HTML for uncontrolled use. */
  defaultValue?: string;
  onChange?: (html: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  /**
   * Plugins are read once when the editor mounts. Pass a `key` to remount
   * with a different set.
   */
  plugins?: ReadonlyArray<PrimavistaPlugin>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  /** Called with the editor instance right after mount. */
  onReady?: (editor: PrimavistaEditor) => void;
  /** Translates toolbar and form strings. Read once on mount. */
  translate?: Translate;
  /** Visual theme name, for example `sulu`. Read once on mount. */
  theme?: string;
  /** Output format knobs, see `HtmlOptions`. Read once on mount. */
  html?: HtmlOptions;
}

export interface EditorHandle {
  readonly editor: PrimavistaEditor | null;
  focus(): void;
  getHtml(): string;
  setHtml(html: string): void;
}

/**
 * Thin mount wrapper around `@primavista/core`. The contract matches what
 * Sulu's `fieldRegistry` expects: `value`, `onChange`, `onBlur`.
 */
export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(props, ref) {
  const {
    value,
    defaultValue,
    onChange,
    onBlur,
    onFocus,
    plugins,
    placeholder,
    disabled = false,
    className,
    id,
    onReady,
    translate,
    theme,
    html,
  } = props;

  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<PrimavistaEditor | null>(null);
  const lastHtmlRef = useRef<string>(value ?? defaultValue ?? '');
  const callbacksRef = useRef({ onChange, onBlur, onFocus });
  callbacksRef.current = { onChange, onBlur, onFocus };

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const options: EditorOptions = {
      initialHtml: lastHtmlRef.current,
      editable: !disabled,
    };
    if (plugins) options.plugins = plugins;
    if (placeholder !== undefined) options.placeholder = placeholder;
    if (translate) options.translate = translate;
    if (theme) options.theme = theme;
    if (html) options.html = html;
    if (props['aria-label']) options.ariaLabel = props['aria-label'];
    if (props['aria-labelledby']) options.ariaLabelledBy = props['aria-labelledby'];
    if (props['aria-describedby']) options.ariaDescribedBy = props['aria-describedby'];

    const editor = createEditor(host, options);
    editorRef.current = editor;
    lastHtmlRef.current = editor.getHtml();

    const unsubscribe = [
      editor.on('change', (html) => {
        lastHtmlRef.current = html;
        callbacksRef.current.onChange?.(html);
      }),
      editor.on('blur', () => callbacksRef.current.onBlur?.()),
      editor.on('focus', () => callbacksRef.current.onFocus?.()),
    ];
    onReady?.(editor);

    return () => {
      unsubscribe.forEach((fn) => fn());
      editor.destroy();
      editorRef.current = null;
    };
    // Plugins and initial content are intentionally read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || value === undefined) return;
    if (value === lastHtmlRef.current) return;
    editor.setHtml(value);
    lastHtmlRef.current = editor.getHtml();
  }, [value]);

  useEffect(() => {
    editorRef.current?.setEditable(!disabled);
  }, [disabled]);

  useImperativeHandle(
    ref,
    () => ({
      get editor() {
        return editorRef.current;
      },
      focus: () => editorRef.current?.focus(),
      getHtml: () => editorRef.current?.getHtml() ?? lastHtmlRef.current,
      setHtml: (html: string) => {
        editorRef.current?.setHtml(html);
        lastHtmlRef.current = editorRef.current?.getHtml() ?? html;
      },
    }),
    [],
  );

  return <div ref={hostRef} className={className} id={id} data-primavista-host="" />;
});
