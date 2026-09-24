import { Controller } from '@hotwired/stimulus';
import * as core from '@primavista/core';
import { PrimavistaEditor, PrimavistaPlugin } from '@primavista/core';

interface PreConnectDetail {
    /** Mutate this array to add, remove or replace plugins before the editor mounts. */
    plugins: PrimavistaPlugin[];
    textarea: HTMLTextAreaElement;
    /**
     * The `@primavista/core` module, including the Lexical re-exports. Custom
     * plugins must use this instance, because the controller ships its own copy.
     */
    core: typeof core;
}
interface ConnectDetail {
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
declare class export_default extends Controller<HTMLTextAreaElement> {
    static values: {
        placeholder: StringConstructor;
        theme: StringConstructor;
    };
    readonly placeholderValue: string;
    readonly hasPlaceholderValue: boolean;
    readonly themeValue: string;
    readonly hasThemeValue: boolean;
    editor: PrimavistaEditor | null;
    private host;
    private wasRequired;
    private onTextareaFocus;
    connect(): void;
    disconnect(): void;
    private dispatchEvent;
}

export { type ConnectDetail, type PreConnectDetail, export_default as default };
