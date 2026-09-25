import type { PluginAllows, PrimavistaPlugin } from '../types';

const KEYS = ['headings', 'lists', 'formats', 'alignments'] as const;

/** Merges what the given plugins declared in `allows`. A key stays undefined when no plugin declared it. */
export function collectAllowed(plugins: ReadonlyArray<PrimavistaPlugin>): PluginAllows {
  const result: { -readonly [K in keyof PluginAllows]: PluginAllows[K] } = {};
  for (const plugin of plugins) {
    if (!plugin.allows) continue;
    for (const key of KEYS) {
      const values = plugin.allows[key];
      if (!values) continue;
      (result as Record<string, ReadonlyArray<string>>)[key] = [...(result[key] ?? []), ...values];
    }
  }
  return result;
}
