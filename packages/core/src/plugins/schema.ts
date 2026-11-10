import type { PluginSchema, PrimavistaPlugin, SchemaElement } from '../types';

/** Merges the `schema` of the given plugins. The same tag from two plugins unites its attributes and keeps the first kind. */
export function collectSchema(plugins: ReadonlyArray<PrimavistaPlugin>): Required<PluginSchema> {
  const byTag = new Map<string, { kind: NonNullable<SchemaElement['kind']>; attributes: Set<string> }>();
  for (const plugin of plugins) {
    for (const element of plugin.schema?.elements ?? []) {
      const entry = byTag.get(element.tag) ?? { kind: element.kind ?? 'inline', attributes: new Set<string>() };
      for (const name of element.attributes ?? []) entry.attributes.add(name);
      byTag.set(element.tag, entry);
    }
  }
  const elements: SchemaElement[] = [...byTag].map(([tag, { kind, attributes }]) => ({ tag, kind, attributes: [...attributes] }));
  return { elements };
}

/**
 * The markup the given plugins declare, as plain JSON for hosts outside of
 * JavaScript, for example to configure a server-side sanitizer.
 */
export function getSchema(plugins: ReadonlyArray<PrimavistaPlugin>): Required<PluginSchema> {
  return collectSchema(plugins);
}
