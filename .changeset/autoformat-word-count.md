---
"@primavista/core": minor
"@primavista/sulu": minor
---

Add the `autoformat` and `wordCount` plugins. `autoformat()` turns Markdown typed at the start of a paragraph (`## `, `- `, `1. `) and inline (`**bold**`, `*italic*`, `~~strike~~`, `` `code` ``) into formatting, limited to what `headings`, `lists` and `formatting` offer, and is part of `defaultPlugins()`. `wordCount()` shows words and characters in a status bar below the content with an optional soft limit, `getWordCount(editor)` and `countText(text)` return the numbers. Plugins now see every plugin of the editor through `context.plugins`. `suluPlugins()` takes `autoformat: true` to switch the shortcuts on, the Sulu theme styles the status bar.
