// @flow
/*
 * Reference adapter for Sulu Admin. Drop this file into
 * src/Sulu/Bundle/AdminBundle/Resources/js/containers/TextEditor/adapters/
 * and register it next to the CKEditor adapter:
 *
 *     textEditorRegistry.add('primavista', PrimavistaTextEditor);
 *
 * Then point the text_editor field type at it (containers/Form/fields/TextEditor.js,
 * prop `adapter`). It implements the same TextEditorProps contract as the
 * CKEditor adapter: value, onChange, onBlur, onFocus, disabled, locale,
 * options. Internal and external links open Sulu's own overlays from
 * linkTypeRegistry, so pages, media, articles and contacts work unchanged.
 *
 * Written against Sulu 3.0 (containers/CKEditor5 and containers/Link).
 */
import React, {Fragment} from 'react';
import {action, isArrayLike, observable} from 'mobx';
import {observer} from 'mobx-react';
import {
    alignment,
    Editor,
    formatting,
    headings,
    history,
    internalLinks,
    links,
    lists,
    stripParagraphs,
    suluPreset,
    tables,
    wrapParagraphs,
} from '@primavista/react';
import '@primavista/core/primavista.css';
import '@primavista/core/themes/sulu.css';
import linkTypeRegistry from '../../Link/registries/linkTypeRegistry';
import {ExternalLinkTypeOverlay} from '../../Link';
import {translate} from '../../../utils';
import type {IObservableArray, IObservableValue} from 'mobx/lib/mobx';
import type {TextEditorProps} from '../types';

const DEFAULT_FORMATS = ['h2', 'h3', 'h4', 'h5', 'h6'];
const DEFAULT_TARGET = '_self';

@observer
class PrimavistaTextEditor extends React.Component<TextEditorProps> {
    // Internal link overlay state, one overlay per registered link type.
    @observable openOverlay: ?string = undefined;
    @observable id: ?string | number = undefined;
    @observable query: ?string = undefined;
    @observable anchor: ?string = undefined;
    @observable target: ?string = DEFAULT_TARGET;
    @observable title: ?string = undefined;
    defaultText: ?string = undefined;
    internalDialog: ?Object = undefined;

    // External link overlay state.
    @observable externalOpen: boolean = false;
    @observable url: ?string = undefined;
    @observable rel: ?string = undefined;
    externalDialog: ?Object = undefined;

    plugins: Array<Object>;

    constructor(props: TextEditorProps) {
        super(props);
        this.plugins = this.createPlugins();
    }

    get enterMode(): 'p' | 'br' {
        const {options} = this.props;
        const value = options && options.enter_mode ? options.enter_mode.value : undefined;

        return value === 'br' ? 'br' : 'p';
    }

    get formats(): Array<string> {
        const {options} = this.props;
        const unvalidatedValues = options && options.formats ? options.formats.value : [];

        if (!isArrayLike(unvalidatedValues)) {
            throw new Error('The passed "formats" must be an array of strings');
        }
        // $FlowFixMe: flow does not recognize that isArrayLike(value) means that value is an array
        const values: Array<any> | IObservableArray<any> = unvalidatedValues;

        const names = values.map((format) => {
            if (typeof format.name !== 'string') {
                throw new Error('The name property of the passed "formats" must be strings!');
            }

            return format.name;
        });

        return names.length ? names : DEFAULT_FORMATS;
    }

    createPlugins(): Array<Object> {
        const providers = linkTypeRegistry.getKeys()
            .filter((key) => key !== 'external')
            .map((key) => ({key, label: linkTypeRegistry.getTitle(key)}));

        return [
            history(),
            formatting({
                formats: ['bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', 'code'],
            }),
            headings({levels: this.formats}),
            lists(),
            links({
                defaultTarget: DEFAULT_TARGET,
                openDialog: this.handleOpenExternalDialog,
            }),
            internalLinks({
                providers,
                defaultTarget: DEFAULT_TARGET,
                openDialog: this.handleOpenInternalDialog,
                describe: ({provider, href}) => `${linkTypeRegistry.getTitle(provider)}: ${href}`,
            }),
            alignment(),
            tables(),
        ];
    }

    // Value mapping: Sulu stores undefined for an empty editor and, with
    // enter_mode "br", paragraphs as comments plus <br>.

    toEditorValue(value: ?string): string {
        if (!value) {
            return '';
        }
        return this.enterMode === 'br' ? wrapParagraphs(value) : value;
    }

    handleChange = (html: string) => {
        const {onChange} = this.props;
        if (html === '') {
            onChange(undefined);
            return;
        }
        onChange(this.enterMode === 'br' ? stripParagraphs(html) : html);
    };

    handleFocus = () => {
        const {onFocus} = this.props;
        if (onFocus && this.editorElement) {
            onFocus({target: this.editorElement});
        }
    };

    editor: ?Object = undefined;
    editorElement: ?HTMLElement = undefined;

    handleReady = (editor: Object) => {
        this.editor = editor;
        this.editorElement = editor.contentElement;
    };

    // Internal links: Primavista asks for a dialog, Sulu's LinkTypeOverlay answers.

    @action handleOpenInternalDialog = (dialog: Object) => {
        this.internalDialog = dialog;
        this.openOverlay = dialog.provider;
        this.id = dialog.href;
        this.query = dialog.query;
        this.anchor = dialog.anchor;
        this.target = dialog.target || DEFAULT_TARGET;
        this.title = dialog.title;
        this.defaultText = undefined;
    };

    @action handleInternalConfirm = () => {
        const dialog = this.internalDialog;
        if (!dialog) {
            return;
        }
        if (this.id) {
            dialog.apply({
                href: this.id,
                query: this.query,
                anchor: this.anchor,
                target: this.target,
                title: this.title,
                text: this.defaultText,
            });
        } else {
            dialog.cancel();
        }
        this.openOverlay = undefined;
        this.internalDialog = undefined;
    };

    @action handleInternalCancel = () => {
        if (this.internalDialog) {
            this.internalDialog.cancel();
        }
        this.openOverlay = undefined;
        this.internalDialog = undefined;
    };

    @action handleHrefChange = (id: ?string | number, item: ?Object) => {
        this.id = id;
        this.defaultText = item ? item.title : undefined;
    };

    @action handleQueryChange = (query: ?string) => {
        this.query = query;
    };

    @action handleAnchorChange = (anchor: ?string) => {
        this.anchor = anchor;
    };

    @action handleTargetChange = (target: ?string) => {
        this.target = target;
    };

    @action handleTitleChange = (title: ?string) => {
        this.title = title;
    };

    // External links: same idea with Sulu's ExternalLinkTypeOverlay, which
    // also takes care of the mailto subject and body fields.

    @action handleOpenExternalDialog = (dialog: Object) => {
        this.externalDialog = dialog;
        this.url = dialog.url || undefined;
        this.target = dialog.target || DEFAULT_TARGET;
        this.title = dialog.title;
        this.rel = dialog.rel;
        this.externalOpen = true;
    };

    @action handleExternalConfirm = () => {
        const dialog = this.externalDialog;
        if (!dialog) {
            return;
        }
        if (this.url) {
            dialog.apply({url: this.url, target: this.target, title: this.title, rel: this.rel, text: this.url});
        } else {
            dialog.cancel();
        }
        this.externalOpen = false;
        this.externalDialog = undefined;
    };

    @action handleExternalCancel = () => {
        if (this.externalDialog) {
            this.externalDialog.cancel();
        }
        this.externalOpen = false;
        this.externalDialog = undefined;
    };

    @action handleUrlChange = (url: ?string | number) => {
        this.url = url === undefined || url === null ? undefined : String(url);
    };

    @action handleRelChange = (rel: ?string) => {
        this.rel = rel;
    };

    // Toolbar and form strings go through Sulu's translator. Missing keys fall
    // back to Primavista's English defaults, so nothing breaks before the
    // sulu_admin.primavista.* keys exist.
    translateLabel = (key: string, fallback: string): string => {
        const translationKey = 'sulu_admin.primavista.' + key;
        const translated = translate(translationKey);
        return translated === translationKey ? fallback : translated;
    };

    render() {
        const {disabled, locale, onBlur, value} = this.props;
        const localeBox: IObservableValue<string> = locale || observable.box('');

        return (
            <Fragment>
                <Editor
                    aria-label={translate('sulu_admin.text_editor')}
                    disabled={disabled}
                    onBlur={onBlur}
                    onChange={this.handleChange}
                    onFocus={this.handleFocus}
                    onReady={this.handleReady}
                    plugins={this.plugins}
                    translate={this.translateLabel}
                    value={this.toEditorValue(value)}
                    {...suluPreset()}
                />
                {linkTypeRegistry.getKeys().filter((key) => key !== 'external').map((key) => {
                    const LinkOverlay = linkTypeRegistry.getOverlay(key);

                    return (
                        <LinkOverlay
                            anchor={this.anchor}
                            href={this.openOverlay === key ? this.id : undefined}
                            key={key}
                            locale={localeBox}
                            onAnchorChange={this.handleAnchorChange}
                            onCancel={this.handleInternalCancel}
                            onConfirm={this.handleInternalConfirm}
                            onHrefChange={this.handleHrefChange}
                            onQueryChange={this.handleQueryChange}
                            onTargetChange={this.handleTargetChange}
                            onTitleChange={this.handleTitleChange}
                            open={this.openOverlay === key}
                            options={linkTypeRegistry.getOptions(key)}
                            query={this.query}
                            target={this.target}
                            title={this.title}
                        />
                    );
                })}
                <ExternalLinkTypeOverlay
                    href={this.url}
                    locale={localeBox}
                    onCancel={this.handleExternalCancel}
                    onConfirm={this.handleExternalConfirm}
                    onHrefChange={this.handleUrlChange}
                    onRelChange={this.handleRelChange}
                    onTargetChange={this.handleTargetChange}
                    onTitleChange={this.handleTitleChange}
                    open={this.externalOpen}
                    options={linkTypeRegistry.getOptions('external')}
                    rel={this.rel}
                    target={this.target}
                    title={this.title}
                />
            </Fragment>
        );
    }
}

export default PrimavistaTextEditor;
