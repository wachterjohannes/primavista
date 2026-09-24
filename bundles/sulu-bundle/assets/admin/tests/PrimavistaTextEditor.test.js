// @flow
import React from 'react';
import {observable} from 'mobx';
import {mount} from 'enzyme';
import {lexical} from '@primavista/core';
import {linkTypeRegistry} from 'sulu-admin-bundle/containers';
import {localizationStore} from 'sulu-admin-bundle/stores';
import PrimavistaTextEditor from '../PrimavistaTextEditor';

const {$getRoot, $isTextNode, $isElementNode} = lexical;

jest.mock('sulu-admin-bundle/utils/Translator', () => ({
    translate: jest.fn((key) => key === 'sulu_admin.primavista.toolbar.bold' ? 'Fett' : key),
}));

class PageOverlay extends React.Component<Object> {
    render() {
        return null;
    }
}

class MediaOverlay extends React.Component<Object> {
    render() {
        return null;
    }
}

const linkOptions = {
    displayProperties: ['title'],
    resourceKey: 'pages',
    targets: ['_blank', '_self'],
};

beforeEach(() => {
    linkTypeRegistry.clear();
    linkTypeRegistry.add('page', PageOverlay, 'sulu_page.page', linkOptions);
    linkTypeRegistry.add('media', MediaOverlay, 'sulu_media.media', linkOptions);
    linkTypeRegistry.add('external', () => null, 'sulu_admin.external_link', linkOptions);
});

function selectAll(editor) {
    editor.lexical.update(() => {
        const texts = [];
        const walk = (node) => {
            if ($isTextNode(node)) {
                texts.push(node);
            }
            if ($isElementNode(node)) {
                node.getChildren().forEach(walk);
            }
        };
        walk($getRoot());
        const first = texts[0];
        const last = texts[texts.length - 1];
        const selection = first.select(0, 0);
        selection.focus.set(last.getKey(), last.getTextContentSize(), 'text');
    }, {discrete: true});
}

function typeText(editor, text) {
    editor.lexical.update(() => {
        $getRoot().selectEnd().insertText(text);
    }, {discrete: true});
}

function mountEditor(props: Object = {}) {
    const wrapper = mount(
        // $FlowFixMe: the spread makes the props inexact for flow, the test controls what goes in
        <PrimavistaTextEditor
            disabled={false}
            locale={observable.box('en')}
            onBlur={jest.fn()}
            onChange={jest.fn()}
            options={{}}
            value={undefined}
            {...props}
        />
    );

    const editor = wrapper.instance().editor;

    return {wrapper, editor, element: editor.element};
}

test('Render the Sulu toolbar with the sulu theme and translated labels', () => {
    const {element} = mountEditor({value: '<p>Hello</p>'});

    expect(element).toHaveClass('pv-theme-sulu');
    expect(element.querySelector('.pv-content').innerHTML).toContain('Hello');

    const ids = Array.from(element.querySelectorAll('[data-pv-item]')).map((item) => item.getAttribute('data-pv-item'));
    expect(ids).toEqual(expect.arrayContaining([
        'bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', 'code',
        'block-type', 'bullet-list', 'numbered-list', 'link', 'internal-link',
        'align-left', 'align-center', 'align-right', 'align-justify', 'insert-table', 'table-merge-cells',
    ]));
    expect(element.querySelector('[data-pv-item="bold"]')).toHaveAttribute('aria-label', 'Fett');
    expect(element.querySelector('[data-pv-item="italic"]')).toHaveAttribute('aria-label', 'Italic');

    const headings = Array.from(element.querySelectorAll('[data-pv-item="block-type"] option'))
        .map((option) => option.value);
    expect(headings).toEqual(['paragraph', 'h2', 'h3', 'h4', 'h5', 'h6']);
});

test('Respect the formats option', () => {
    const {editor, element} = mountEditor({
        options: {formats: {name: 'formats', value: [{name: 'h1'}, {name: 'h2'}]}},
        value: '<h3>Three</h3>',
    });
    const headings = Array.from(element.querySelectorAll('[data-pv-item="block-type"] option'))
        .map((option) => option.value);
    expect(headings).toEqual(['paragraph', 'h1', 'h2']);
    expect(editor.getHtml()).toBe('<p>Three</p>');
});

test('Call onChange with HTML and with undefined when empty', () => {
    const changeSpy = jest.fn();
    const {editor} = mountEditor({onChange: changeSpy, value: '<p>Hi</p>'});

    typeText(editor, '!');
    expect(changeSpy).toHaveBeenLastCalledWith('<p>Hi!</p>');

    editor.lexical.update(() => {
        $getRoot().clear();
    }, {discrete: true});
    expect(changeSpy).toHaveBeenLastCalledWith(undefined);
});

test('Take the text editor config of Sulu 3.1 and offer the localizations as languages', () => {
    localizationStore.setLocalizations([
        {country: '', default: '1', language: 'en', locale: 'en', shadow: ''},
        {country: 'AT', default: '0', language: 'de', locale: 'de_AT', shadow: ''},
    ]);
    const changeSpy = jest.fn();
    const {editor, element} = mountEditor({
        config: {attributes: ['lang'], enterMode: 'br', tags: ['a', 'strong', 'i']},
        onChange: changeSpy,
        value: 'one two',
    });

    const ids = Array.from(element.querySelectorAll('[data-pv-item]')).map((item) => item.getAttribute('data-pv-item'));
    expect(ids).toEqual(['undo', 'redo', 'bold', 'italic', 'link', 'internal-link', 'language']);

    selectAll(editor);
    element.querySelector('[data-pv-item="language"]').click();
    const languages = Array.from(element.querySelectorAll('.pv-menu [data-pv-option]'))
        .map((option) => option.getAttribute('data-pv-option'));
    expect(languages).toEqual(['en', 'de-AT', 'remove']);
    element.querySelector('.pv-menu [data-pv-option="de-AT"]').click();
    // A single paragraph with inline markup keeps the comment markers, as Sulu's utils.js wrote them.
    expect(changeSpy).toHaveBeenLastCalledWith('<!--p--><span lang="de-AT">one two</span><!--/p-->');
});

test('Convert paragraphs for enter_mode br', () => {
    const changeSpy = jest.fn();
    const {editor} = mountEditor({
        onChange: changeSpy,
        options: {enter_mode: {name: 'enter_mode', value: 'br'}},
        value: '<!--p-->one<!--/p--><br></br><!--p-->two<!--/p-->',
    });

    expect(editor.getHtml()).toBe('<p>one</p><p>two</p>');
    typeText(editor, '!');
    expect(changeSpy).toHaveBeenLastCalledWith('<!--p-->one<!--/p--><br></br><!--p-->two!<!--/p-->');
});

test('Open the Sulu overlay for an internal link and insert a sulu-link', () => {
    const changeSpy = jest.fn();
    const {wrapper, editor, element} = mountEditor({onChange: changeSpy, value: '<p>Contact</p>'});

    selectAll(editor);
    element.querySelector('[data-pv-item="internal-link"]').click();
    element.querySelector('.pv-menu [data-pv-option="page"]').click();
    wrapper.update();

    const overlay = wrapper.find(PageOverlay);
    expect(overlay.prop('open')).toBe(true);
    expect(wrapper.find(MediaOverlay).prop('open')).toBe(false);
    expect(overlay.prop('target')).toBe('_self');
    expect(overlay.prop('options')).toEqual(linkOptions);

    overlay.prop('onHrefChange')('uuid-1', {title: 'Home'});
    overlay.prop('onAnchorChange')('team');
    overlay.prop('onTitleChange')('Home page');
    overlay.prop('onConfirm')();
    wrapper.update();

    expect(wrapper.find(PageOverlay).prop('open')).toBe(false);
    expect(editor.getHtml()).toBe(
        '<p><sulu-link href="uuid-1#team" provider="page" target="_self" title="Home page">Contact</sulu-link></p>'
    );
    expect(changeSpy).toHaveBeenLastCalledWith(
        '<p><sulu-link href="uuid-1#team" provider="page" target="_self" title="Home page">Contact</sulu-link></p>'
    );

    selectAll(editor);
    expect(element.querySelector('[data-pv-item="internal-link"]').disabled).toBe(true);
    expect(element.querySelector('[data-pv-item="link"]').disabled).toBe(true);
    expect(element.querySelector('.pv-balloon').hidden).toBe(false);
});

test('Open the external link overlay and write target and title', () => {
    const {wrapper, editor, element} = mountEditor({value: '<p>Sulu</p>'});

    selectAll(editor);
    element.querySelector('[data-pv-item="link"]').click();
    wrapper.update();

    const overlay = wrapper.find('ExternalLinkTypeOverlay');
    expect(overlay.prop('open')).toBe(true);
    overlay.prop('onHrefChange')('https://sulu.io');
    overlay.prop('onTargetChange')('_blank');
    overlay.prop('onTitleChange')('Sulu');
    overlay.prop('onRelChange')('nofollow');
    overlay.prop('onConfirm')();
    wrapper.update();

    expect(editor.getHtml())
        .toBe('<p><a href="https://sulu.io" target="_blank" rel="nofollow" title="Sulu">Sulu</a></p>');
});

test('Write CKEditor compatible table markup and keep stored internal links', () => {
    const stored = '<figure class="table"><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>'
        + '<sulu-link href="42" provider="media" sulu-validation-state="unpublished">file</sulu-link>'
        + '</td></tr></tbody></table></figure>';
    const {editor, element} = mountEditor({value: stored});

    expect(editor.getHtml()).toBe(stored);
    expect(element.querySelector('a.pv-internal-link'))
        .toHaveAttribute('data-validation-state', 'unpublished');
});

test('Toggle disabled and pass blur', () => {
    const blurSpy = jest.fn();
    const {wrapper, element} = mountEditor({onBlur: blurSpy, value: '<p>x</p>'});
    const content = element.querySelector('.pv-content');

    expect(content).toHaveAttribute('contenteditable', 'true');
    content.dispatchEvent(new FocusEvent('blur'));
    expect(blurSpy).toHaveBeenCalled();

    wrapper.setProps({disabled: true});
    expect(content).toHaveAttribute('contenteditable', 'false');
});
