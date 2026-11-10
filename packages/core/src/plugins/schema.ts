import type { PluginSchema, PrimavistaPlugin, SchemaElement } from '../types';

/** Merges the `schema` of the given plugins. The same tag from two plugins unites its attributes. */
export function collectSchema(plugins: ReadonlyArray<PrimavistaPlugin>): Required<PluginSchema> {
  const byTag = new Map<string, Set<string>>();
  for (const plugin of plugins) {
    for (const element of plugin.schema?.elements ?? []) {
      const attributes = byTag.get(element.tag) ?? new Set<string>();
      for (const name of element.attributes ?? []) attributes.add(name);
      byTag.set(element.tag, attributes);
    }
  }
  const elements: SchemaElement[] = [...byTag].map(([tag, attributes]) => ({ tag, attributes: [...attributes] }));
  return { elements };
}

/**
 * The markup the given plugins declare, as plain JSON for hosts outside of
 * JavaScript, for example to configure a server-side sanitizer.
 */
export function getSchema(plugins: ReadonlyArray<PrimavistaPlugin>): Required<PluginSchema> {
  return collectSchema(plugins);
}
