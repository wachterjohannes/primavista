// @flow
/*
 * Plugins a project adds to every Primavista text editor in Sulu Admin, the
 * way ckeditorPluginRegistry added CKEditor plugins. Sulu 3.0 has no text
 * editor config to name a tag in, so this is the place for blockquote(),
 * codeBlock(), horizontalRule() or a custom plugin. The server must allow
 * their markup too: primavista_sulu.tags in the bundle config. Plain inline
 * elements such as mark or abbr need no JavaScript, declare them in
 * primavista_sulu.elements.
 *
 *     import {primavistaPluginRegistry} from 'sulu-primavista-bundle';
 *     import {blockquote} from '@primavista/core';
 *     primavistaPluginRegistry.add(() => blockquote());
 */
// hasConfig is false in Sulu 3.0, which has no text editor config: config is then the default and its tags list says nothing.
type PluginContext = {config: Object, hasConfig: boolean, options: Object};
// A factory returns undefined to skip its plugin, for example when the text editor config does not list its tag.
type PluginFactory = (context: PluginContext) => ?Object;

class PrimavistaPluginRegistry {
    factories: Array<PluginFactory> = [];
    // Tags the server allows on top of the text editor config: primavista_sulu.tags and primavista_sulu.elements.
    serverTags: Set<string> = new Set();

    allowServerTags(tags: Array<string>) {
        tags.forEach((tag) => this.serverTags.add(tag));
    }

    add(factory: PluginFactory) {
        this.factories.push(factory);
    }

    clear() {
        this.factories = [];
        this.serverTags = new Set();
    }

    create(context: PluginContext): Array<Object> {
        return this.factories.map((factory) => factory(context)).filter((plugin) => plugin);
    }
}

export default new PrimavistaPluginRegistry();
