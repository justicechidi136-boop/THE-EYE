# THE EYE Text-to-Speech Foundation

Wave 7 implements the provider-neutral TTS request shape from the shared language/AI contract for local watch spoken alerts.

## Contract

TTS consumes:

- `text`
- `locale`
- `purpose`
- `priority`
- `contentId`

It does not decide how text was translated. It does not replace an original voice recording. Generated speech is always provenance `SYNTHESIZED_SPEECH`.

## Watch Safety Path

Watch danger alerts continue to use deterministic trusted templates from alert codes. Uncontrolled user-generated text is not spoken as a loud critical alert.

The watch uses local Android TTS through `flutter_tts` for offline-first critical safety delivery. The provider layer records:

- requested locale
- applied locale
- fallback reason
- provider
- synthesized-speech provenance

Pidgin currently maps to the approved Nigerian English local voice fallback when a native Pidgin device voice is unavailable. Hausa, Yoruba, and Igbo are requested only when the device reports those locales as available.

## Mobile And Field Ops

Mobile and Field Ops do not gain new cloud/provider TTS in this wave. They should consume the same request shape and fallback metadata when spoken safety UX is enabled later. Emergency warnings must not depend exclusively on external AI.

## Boundaries

This wave does not implement:

- STT
- transcription
- translation engine
- notification template generation
- cloud TTS credentials or provider integration
