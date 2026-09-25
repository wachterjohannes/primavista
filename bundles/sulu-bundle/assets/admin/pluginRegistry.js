// @flow
/*
 * Plugins a project adds to every Primavista text editor in Sulu Admin, the
 * way ckeditorPluginRegistry added CKEditor plugins. Sulu 3.0 has no text
 * editor config to name a tag in, so this is the place for blockquote(),
 * codeBlock(), horizontalRule() or a custom plugin. The server must allow
 * their markup too: primavista_sulu.tags in the bundle config.
 *
 *     import {primavistaPluginRegistry} from 'sulu-primavista-bundle';
 *     import {blockquote} from '@primavista/core';
 *     primavistaPluginRegistry.add(() => blockquote());
 */
type PluginContext = {config: Object, options: Object};
type PluginFactory = (context: PluginContext) => Object;

class PrimavistaPluginRegistry {
    factories: Array<PluginFactory> = [];

    add(factory: PluginFactory) {
        this.factories.push(factory);
    }

    clear() {
        this.factories = [];
    }

    create(context: PluginContext): Array<Object> {
        return this.factories.map((factory) => factory(context));
    }
}

export default new PrimavistaPluginRegistry();
