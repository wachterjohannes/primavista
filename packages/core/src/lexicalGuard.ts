import { DecoratorNode, ElementNode, TextNode } from 'lexical';
import type { Klass, LexicalNode } from 'lexical';
import type { PrimavistaPlugin } from './types';

declare const __LEXICAL_VERSION__: string;

/** The Lexical version this build of the core was made with. */
export const LEXICAL_VERSION: string = __LEXICAL_VERSION__;

/*
 * Lexical exports no value for its root `LexicalNode`, so check the three
 * base classes every custom node extends.
 */
const isOurNode = (node: Klass<LexicalNode>): boolean =>
  node.prototype instanceof ElementNode ||
  node.prototype instanceof TextNode ||
  node.prototype instanceof DecoratorNode;

/** The error for a plugin whose node classes come from a second copy of Lexical, or null. */
export function foreignLexicalError(plugin: PrimavistaPlugin): Error | null {
  for (const node of plugin.nodes ?? []) {
    if (isOurNode(node)) continue;
    return new Error(
      `Primavista: plugin "${plugin.name}" registers the node class "${node.name}" from a different copy of Lexical ` +
        `than @primavista/core uses (${LEXICAL_VERSION}). ` +
        `Import Lexical from "@primavista/core/lexical" and remove "lexical" from the extension's dependencies.`,
    );
  }
  return null;
}

/**
 * A node class from a second copy of Lexical does not extend our
 * base classes. Lexical itself fails later and far from the cause, so fail
 * here and say what to change. `createEditor` does not throw for this, it
 * skips the plugin and reports it through `onPluginError`.
 */
export function assertSameLexical(plugins: ReadonlyArray<PrimavistaPlugin>): void {
  for (const plugin of plugins) {
    const error = foreignLexicalError(plugin);
    if (error) throw error;
  }
}
