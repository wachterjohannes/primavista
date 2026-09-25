---
"@primavista/core": minor
"@primavista/sulu": minor
---

Add paste cleanup. `pasteCleanup()` cleans HTML pasted from Word, Google Docs, LibreOffice and web pages down to the markup the registered plugins produce and declare in `allows`, internal links included: inline styles become `strong`, `em`, `u`, `s`, `sup` and `sub`, Word's list paragraphs become real lists, classes, styles, `<font>`, `<o:p>`, comments and empty paragraphs disappear. It is part of `defaultPlugins()` and `suluPlugins()`, the cleaner is exported as `cleanPastedHtml(html, options)`.
