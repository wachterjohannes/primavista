---
"@primavista/core": minor
"@primavista/sulu": minor
"@primavista/react": patch
---

Move everything Sulu-specific into the new package `@primavista/sulu` and add a `language` plugin. The core's `internalLinks` now stores `<internal-link>` with a `validation-state` attribute by default, `lists` takes `types`, toolbar menus can report an active state, and `language()` marks text parts as `<span lang>`. `@primavista/sulu` provides `suluLinks`, `suluPlugins` driven by Sulu's text editor configs, `suluConfigFromLegacyOptions`, `suluPreset`, the Sulu theme, the `enter_mode` helpers and `suluTranslationKey`.
