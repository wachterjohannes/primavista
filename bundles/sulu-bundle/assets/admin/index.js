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
import {fieldRegistry, textEditorRegistry} from 'sulu-admin-bundle/containers';
import {initializer} from 'sulu-admin-bundle/services';
import PrimavistaTextEditor from './PrimavistaTextEditor';
import TextEditor from './fields/TextEditor';

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

export {ADAPTER, PrimavistaTextEditor, TextEditor};
