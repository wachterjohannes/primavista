// @flow
/*
 * Wires Primavista into Sulu Admin. Import this file from the project's
 * assets/admin/app.js, after the Sulu bundles and before startAdmin().
 *
 * Sulu's own text_editor field hard-codes the ckeditor5 adapter, so the
 * field is replaced by one that picks the primavista adapter. Everything
 * else (link overlays, validation states, enter_mode, translations) goes
 * through Sulu's public registries and stores.
 */
import {inlineElement} from '@primavista/core';
import {fieldRegistry, textEditorRegistry} from 'sulu-admin-bundle/containers';
import {initializer} from 'sulu-admin-bundle/services';
import PrimavistaTextEditor from './PrimavistaTextEditor';
import TextEditor from './fields/TextEditor';
import primavistaPluginRegistry from './pluginRegistry';

const FIELD_TYPE_TEXT_EDITOR = 'text_editor';
const ADAPTER = 'primavista';

// Sulu fills its registries in its own "sulu_admin" update config hook once
// the admin config has loaded, not on import. This hook is appended to the
// same list, so it runs right after Sulu's registrations.
initializer.addUpdateConfigHook('sulu_admin', (config: Object, initialized: boolean) => {
    if (initialized) {
        return;
    }

    if (!textEditorRegistry.has(ADAPTER)) {
        textEditorRegistry.add(ADAPTER, PrimavistaTextEditor);
    }

    // The field registry refuses a second registration under the same key,
    // so Sulu's entry is dropped first.
    if (fieldRegistry.has(FIELD_TYPE_TEXT_EDITOR)) {
        delete fieldRegistry.fields[FIELD_TYPE_TEXT_EDITOR];
        delete fieldRegistry.options[FIELD_TYPE_TEXT_EDITOR];
    }
    fieldRegistry.add(FIELD_TYPE_TEXT_EDITOR, TextEditor);
});

// The elements of `primavista_sulu.elements` arrive under the key of
// PrimavistaAdmin. Each becomes an inline element plugin. With Sulu 3.1
// configs a config offers it only when it lists the tag, the sanitizer on the
// server follows the same rule.
initializer.addUpdateConfigHook('primavista', (config: ?Object, initialized: boolean) => {
    // Sulu calls the hook with undefined when no Admin class sends this key,
    // which is every project without primavista_sulu.elements.
    if (initialized || !config || !Array.isArray(config.elements)) {
        return;
    }

    config.elements.forEach(({tag, class: className, attributes, label}: {
        tag: string,
        class: ?string,
        attributes: Array<string>,
        label: string,
    }) => {
        const name = className ? tag + '-' + className : tag;
        primavistaPluginRegistry.add(({config: textEditorConfig}) => {
            if (textEditorConfig && Array.isArray(textEditorConfig.tags) && !textEditorConfig.tags.includes(tag)) {
                return undefined;
            }

            return inlineElement({
                name,
                tag,
                attributes,
                ...(className ? {className} : {}),
                toolbar: {label},
            });
        });
    });
});

export {ADAPTER, PrimavistaTextEditor, TextEditor, primavistaPluginRegistry};
