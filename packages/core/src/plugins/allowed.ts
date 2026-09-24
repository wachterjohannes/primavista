import type { HeadingTagType } from '@lexical/rich-text';
import type { PrimavistaPlugin } from '../types';
import type { InlineFormat } from './formatting';
import type { ListTag } from './lists';

/**
 * What a structural plugin offers, recorded against the plugin object.
 * `autoformat` reads it so a typed shortcut never produces markup the toolbar
 * does not offer, for example an `h5` when `headings` only lists `h2` and `h3`.
 */
export interface Allowed {
  headings?: ReadonlyArray<HeadingTagType>;
  lists?: ReadonlyArray<ListTag>;
  formats?: ReadonlyArray<InlineFormat>;
}

const registry = new WeakMap<PrimavistaPlugin, Allowed>();

export function declareAllowed<T extends PrimavistaPlugin>(plugin: T, allowed: Allowed): T {
  registry.set(plugin, allowed);
  return plugin;
}

/** Merges what the given plugins declared. A key stays undefined when no plugin declared it. */
export function collectAllowed(plugins: ReadonlyArray<PrimavistaPlugin>): Allowed {
  const result: Allowed = {};
  for (const plugin of plugins) {
    const allowed = registry.get(plugin);
    if (!allowed) continue;
    if (allowed.headings) result.headings = [...(result.headings ?? []), ...allowed.headings];
    if (allowed.lists) result.lists = [...(result.lists ?? []), ...allowed.lists];
    if (allowed.formats) result.formats = [...(result.formats ?? []), ...allowed.formats];
  }
  return result;
}
