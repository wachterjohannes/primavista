import type { PluginSchema, PrimavistaPlugin, SchemaElement } from '../types';

/**
 * Merges the `schema` of the given plugins. Entries with the same tag, class
 * and required attributes unite their attributes.
 */
export function collectSchema(plugins: ReadonlyArray<PrimavistaPlugin>): Required<PluginSchema> {
  const byKey = new Map<string, { element: SchemaElement; attributes: Set<string> }>();
  for (const plugin of plugins) {
    for (const element of plugin.schema?.elements ?? []) {
      const key = JSON.stringify([element.tag, element.className ?? null, [...(element.requires ?? [])].sort()]);
      const entry = byKey.get(key) ?? { element, attributes: new Set<string>() };
      for (const name of element.attributes ?? []) entry.attributes.add(name);
      byKey.set(key, entry);
    }
  }
  const elements: SchemaElement[] = [...byKey.values()].map(({ element, attributes }) => ({
    tag: element.tag,
    attributes: [...attributes],
    ...(element.className ? { className: element.className } : {}),
    ...(element.requires ? { requires: element.requires } : {}),
  }));
  return { elements };
}

/**
 * The markup the given plugins declare, as plain JSON for hosts outside of
 * JavaScript, for example to configure a server-side sanitizer.
 */
export function getSchema(plugins: ReadonlyArray<PrimavistaPlugin>): Required<PluginSchema> {
  return collectSchema(plugins);
}
