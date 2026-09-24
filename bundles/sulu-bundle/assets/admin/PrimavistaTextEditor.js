// @flow
/*
 * The Primavista adapter for Sulu's TextEditor container, registered by
 * index.js under the key "primavista". It implements the same contract as
 * the CKEditor adapter: value, onChange, onBlur, onFocus, disabled, locale,
 * options. Internal and external links open Sulu's own overlays from
 * linkTypeRegistry, so pages, media, articles and contacts work unchanged.
 * Everything Sulu-specific about the editor itself (toolbar, sulu-link,
 * preset, theme, enter_mode) comes from @primavista/sulu.
 *
 * Works with Sulu 3.0 (deprecated "formats" and "enter_mode" params) and
 * with the text editor configs of Sulu 3.1 (sulu/sulu#9091), which arrive
 * as the "config" prop.
 */
import React, {Fragment} from 'react';
import {action, isArrayLike, observable} from 'mobx';
import {observer} from 'mobx-react';
import {Editor} from '@primavista/react';
import {
    htmlToSuluValue,
    SULU_DEFAULT_TARGET,
    suluConfigFromLegacyOptions,
    suluPlugins,
    suluPreset,
    suluTranslationKey,
    suluValueToHtml,
} from '@primavista/sulu';
import '@primavista/core/primavista.css';
import '@primavista/sulu/sulu.css';
import {linkTypeRegistry} from 'sulu-admin-bundle/containers';
import {ExternalLinkTypeOverlay} from 'sulu-admin-bundle/containers/Link';
import {localizationStore} from 'sulu-admin-bundle/stores';
import {translate} from 'sulu-admin-bundle/utils';
import type {IObservableArray, IObservableValue} from 'mobx/lib/mobx';
import type {TextEditorProps} from 'sulu-admin-bundle/containers/TextEditor/types';

type TextEditorConfig = {
    attributes: Array<string>,
    enterMode: 'p' | 'br',
    tags: Array<string>,
};

// Sulu 3.1 passes the resolved text editor config, Sulu 3.0 only the schema options.
type Props = {...TextEditorProps, config?: TextEditorConfig};

const DEFAULT_TARGET = SULU_DEFAULT_TARGET;

@observer
class PrimavistaTextEditor extends React.Component<Props> {
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

    constructor(props: Props) {
        super(props);
        this.plugins = this.createPlugins();
    }

    get config(): TextEditorConfig {
        const {config} = this.props;
        if (config) {
            return config;
        }

        return suluConfigFromLegacyOptions({formats: this.formats, enterMode: this.legacyEnterMode});
    }

    get enterMode(): 'p' | 'br' {
        return this.config.enterMode;
    }

    get legacyEnterMode(): ?('p' | 'br') {
        const {options} = this.props;
        const value = options && options.enter_mode ? options.enter_mode.value : undefined;

        return value === 'br' || value === 'p' ? value : undefined;
    }

    // The languages the "lang" attribute offers: the system's localizations.
    get languages(): Array<{code: string, label: string}> {
        return localizationStore.localizations.map((localization) => ({
            code: localization.locale.replace('_', '-'),
            label: localization.locale,
        }));
    }

    get formats(): ?Array<string> {
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

        return names.length ? names : undefined;
    }

    createPlugins(): Array<Object> {
        const providers = linkTypeRegistry.getKeys()
            .filter((key) => key !== 'external')
            .map((key) => ({key, label: linkTypeRegistry.getTitle(key)}));

        return suluPlugins({
            config: this.config,
            providers,
            languages: this.languages,
            openInternalLinkDialog: this.handleOpenInternalDialog,
            openExternalLinkDialog: this.handleOpenExternalDialog,
            describeInternalLink: ({provider, href}) => `${linkTypeRegistry.getTitle(provider)}: ${href}`,
        });
    }

    // Value mapping: Sulu stores undefined for an empty editor and, with
    // enter_mode "br", paragraphs as comments plus <br>.

    toEditorValue(value: ?string): string {
        return suluValueToHtml(value, this.enterMode);
    }

    handleChange = (html: string) => {
        const {onChange} = this.props;
        onChange(htmlToSuluValue(html, this.enterMode));
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
        const translationKey = suluTranslationKey(key);
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
