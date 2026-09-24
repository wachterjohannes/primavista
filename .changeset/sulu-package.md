---
"@primavista/core": minor
"@primavista/sulu": minor
"@primavista/react": patch
---

Move everything Sulu-specific into the new package `@primavista/sulu`. The core's `internalLinks` now stores `<internal-link>` with a `validation-state` attribute by default, `suluPreset`, the Sulu theme and the `enter_mode` helpers moved to `@primavista/sulu`, which also adds `suluLinks`, `suluPlugins`, `suluValueToHtml`, `htmlToSuluValue` and `suluTranslationKey`.
