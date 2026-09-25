import { $insertDataTransferForRichText } from '@lexical/clipboard';
import { CodeNode } from '@lexical/code-core';
import { LinkNode } from '@lexical/link';
import { ListNode } from '@lexical/list';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableNode } from '@lexical/table';
import { $getSelection, COMMAND_PRIORITY_LOW, PASTE_COMMAND, PASTE_TAG, type PasteCommandType } from 'lexical';
import { HorizontalRuleNode } from '../nodes/HorizontalRuleNode';
import { InternalLinkNode } from '../nodes/InternalLinkNode';
import { LanguageNode } from '../nodes/LanguageNode';
import { cleanPastedHtml, type CleanPastedHtmlOptions } from '../paste';
import type { PrimavistaPlugin } from '../types';

/**
 * Cleans pasted HTML from Word, Google Docs, LibreOffice and web pages with
 * `cleanPastedHtml` before Lexical imports it. Headings, lists, links,
 * internal links, tables and language spans survive when their plugin is
 * registered, inline formats, list types and alignments as the plugins
 * declare them in `allows`. Plain text and content copied inside Primavista
 * take Lexical's usual path.
 */
export function pasteCleanup(): PrimavistaPlugin {
  return {
    name: 'paste-cleanup',
    register: ({ editor, allowed }) => {
      const schema: CleanPastedHtmlOptions = {
        formats: allowed.formats ?? [],
        headings: editor.hasNodes([HeadingNode]),
        lists: editor.hasNodes([ListNode]) ? (allowed.lists ?? true) : false,
        links: editor.hasNodes([LinkNode]),
        tables: editor.hasNodes([TableNode]),
        language: editor.hasNodes([LanguageNode]),
        alignment: allowed.alignments ?? [],
        blockquote: editor.hasNodes([QuoteNode]),
        codeBlock: editor.hasNodes([CodeNode]),
        horizontalRule: editor.hasNodes([HorizontalRuleNode]),
      };
      if (editor.hasNodes([InternalLinkNode])) {
        schema.internalLink = { tag: InternalLinkNode.tagName, validationAttribute: InternalLinkNode.validationAttribute };
      }
      // Runs before the rich text handler (COMMAND_PRIORITY_EDITOR) and does
      // what it does, with the cleaned HTML in place of the original.
      return editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          const clipboardData = clipboardDataOf(event);
          const html = clipboardData?.getData('text/html');
          if (!clipboardData || !html || $getSelection() === null) return false;
          // Lexical treats HTML that equals the plain text as an iOS paste and
          // imports the text, the cleaner must not hide that equality.
          if (html === clipboardData.getData('text/plain')) return false;
          const cleaned = cleanPastedHtml(html, schema);
          event.preventDefault();
          editor.update(
            () => {
              const selection = $getSelection();
              if (selection) $insertDataTransferForRichText(withHtml(clipboardData, cleaned), selection, editor);
            },
            { tag: PASTE_TAG },
          );
          return true;
        },
        COMMAND_PRIORITY_LOW,
      );
    },
  };
}

function clipboardDataOf(event: PasteCommandType): DataTransfer | null {
  return 'clipboardData' in event ? event.clipboardData : null;
}

/**
 * The clipboard's `DataTransfer` is read-only, so Lexical gets a view that
 * answers `text/html` with the cleaned markup and passes everything else
 * through. Lexical only calls `getData`.
 */
function withHtml(data: DataTransfer, html: string): DataTransfer {
  return {
    getData: (type: string) => (type === 'text/html' ? html : data.getData(type)),
    get types() {
      return data.types;
    },
    get files() {
      return data.files;
    },
  } as DataTransfer;
}
