# THE EYE Language AI Contract

This contract is the shared baseline for Language Waves 6, 7, and 8. It defines wire semantics only. It does not introduce speech-to-text, translation, text-to-speech, notification delivery, or provider implementations.

## Authoritative Locale Registry

Supported locales come from the existing THE EYE language registry in `packages/shared/src/language-region.ts`.

Current Nigeria locales are:

- `en`
- `ha`
- `yo`
- `ig`
- `pcm`

Do not duplicate this list in provider-specific code. `preferredLocale` remains the account-level UI/output preference.

## Content Provenance

Generated content must preserve its relationship to source content.

- `ORIGINAL`: actual source material supplied by a citizen, officer, or system.
- `TRANSCRIPT`: AI-generated textual representation of original audio.
- `TRANSLATION`: AI-generated representation in another language.
- `SYNTHESIZED_SPEECH`: generated audio produced from text.

Original audio/text/media is immutable. AI transcript does not replace original audio. Translation does not replace transcript. Generated speech does not replace original voice.

## Language Metadata

Shared wire metadata may include:

- `sourceLocale`
- `targetLocale`
- `preferredLocale`
- `detectedLocale`
- `languageConfidence`
- `fallbackLocale`

Payloads are not required to include every field. For spoken-language detection, do not assume `preferredLocale` is the spoken language.

## Processing Status

Transcription, translation, and TTS should reuse these states where applicable:

- `PENDING`
- `PROCESSING`
- `COMPLETED`
- `FAILED`
- `UNSUPPORTED`

## Generated Content Metadata

Generated outputs should include provider-neutral metadata when available:

- `provider`
- `model`
- `generatedAt`
- `sourceContentId`
- `sourceHash`
- `confidence`
- `status`

No generated content should lose the relationship to its source.

## Translation Identity

A translation is identified by:

- `sourceContentId`
- `sourceLocale`
- `targetLocale`

Translation must never overwrite original text/audio. Multiple target locales must coexist for the same source content.

## TTS Request Semantics

Provider-neutral TTS requests use:

- `text`
- `locale`
- `purpose`
- `priority`
- `contentId`

Supported purposes:

- `danger_alert`
- `notification`
- `message`
- `accessibility`
- `general`

Wave 7 owns provider selection and actual TTS implementation.

## Notification Localization

Notification localization input uses:

- `templateKey`
- `recipientPreferredLocale`
- `fallbackLocale`
- `parameters`
- `originalContentReference`

Templates should use structured parameters. Do not make arbitrary pre-translated strings the primary architectural contract when structured templates are available.

## Fallback

Canonical output fallback:

1. Recipient `preferredLocale`
2. Supported effective locale
3. English (`en`)

Unsupported or missing locale values resolve to English.

## Shared Locations

TypeScript/shared runtime contract:

- `packages/shared/src/language-ai-contract.ts`

Cross-client wire documentation:

- `docs/LANGUAGE_AI_CONTRACT.md`

Generated manifest:

- `packages/shared/dist/contracts.json`

Flutter clients should follow the documented wire shapes and continue using the shared Flutter locale catalog for UI locale resolution.
