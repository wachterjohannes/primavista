// @flow
/*
 * Sulu's text_editor field with the adapter switched to primavista.
 * Mirrors sulu-admin-bundle/containers/Form/fields/TextEditor.js.
 */
import React from 'react';
import {observable} from 'mobx';
import {TextEditor as TextEditorContainer} from 'sulu-admin-bundle/containers';
import {userStore} from 'sulu-admin-bundle/stores';
import type {FieldTypeProps} from 'sulu-admin-bundle/containers/Form/types';

export default class TextEditor extends React.Component<FieldTypeProps<?string>> {
    handleFocus = (event: { target: EventTarget }) => {
        const {onFocus} = this.props;

        if (onFocus) {
            onFocus(event.target);
        }
    };

    render() {
        const {disabled, formInspector, onChange, onFinish, schemaOptions, value} = this.props;

        const locale = formInspector.locale ? formInspector.locale : observable.box(userStore.contentLocale);

        return (
            <TextEditorContainer
                adapter="primavista"
                disabled={!!disabled}
                locale={locale}
                onBlur={onFinish}
                onChange={onChange}
                onFocus={this.handleFocus}
                options={schemaOptions}
                value={value}
            />
        );
    }
}
