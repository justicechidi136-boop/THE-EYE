# Account Language and Region Foundation

Wave 1 adds stable account-level language and region identifiers without enabling translation, transcription, text-to-speech, or UI localization.

## Canonical Country Values

| Code | Name | Status |
| --- | --- | --- |
| `NG` | Nigeria | Enabled |

`countryCode` is additive and nullable. Existing free-text `country` values remain intact for backward compatibility.

## Canonical Preferred Locale Values

| Locale | Name | Status |
| --- | --- | --- |
| `en` | English | Enabled |
| `ha` | Hausa | Enabled |
| `yo` | Yoruba | Enabled |
| `ig` | Igbo | Enabled |
| `pcm` | Nigerian Pidgin | Enabled |

Unsupported or missing account locale values resolve to `effectivePreferredLocale = en`.

## Speech Capability Flags

The registry exposes reserved capability flags for speech-to-text, translation, and text-to-speech. All flags are `false` in Wave 1. A later translation/voice wave can enable providers and runtime behavior behind explicit product and infrastructure work.

## Smartwatch Compatibility

Account locale values are not the same as smartwatch spoken-language tags. Smartwatch DTOs continue using values such as `ha-NG`; account preferences use stable locale IDs such as `ha`.

## Backfill Strategy

No data backfill is performed in Wave 1. Existing rows keep nullable values until a user updates their profile or a later dedicated migration safely maps deterministic records, for example Nigeria-only profiles to `countryCode = NG`.
