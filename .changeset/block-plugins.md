---
"@primavista/core": minor
"@primavista/sulu": minor
---

Add `blockquote()`, `codeBlock()` and `horizontalRule()`, three opt-in plugins that write `<blockquote><p>…</p></blockquote>`, `<pre><code>…</code></pre>` and `<hr>`, the markup CKEditor's BlockQuote, CodeBlock and HorizontalLine plugins produce. `autoformat` and paste cleanup follow them. `suluPlugins()` switches them on for the tags `blockquote`, `pre` and `hr` and takes `plugins` to append a project's own plugins.
