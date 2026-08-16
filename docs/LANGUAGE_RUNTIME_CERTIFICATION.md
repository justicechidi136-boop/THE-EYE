# Language Runtime Certification

This checklist is for staging after deployment of the integrated Language Waves 1-8 stack. It is not a deployment runbook by itself, and it must not be used to apply production credentials.

## Deployment Sequence

1. DevOps confirms Firebase Storage runtime proof PASS.
2. Confirm current staging SHA.
3. Confirm database backup and rollback readiness.
4. Deploy staging with `run_migrations=true`.
5. Confirm migration `20260816180000_language_wave6_speech_artifacts`.
6. Run health and readiness checks.
7. Run Firebase Storage proof.
8. Run language notification tests.
9. Run watch TTS tests.
10. Run real STT/translation tests only after an approved staging provider is configured.

## Language Coverage

Certify these enabled locales:

- English: `en`
- Hausa: `ha`
- Yoruba: `yo`
- Igbo: `ig`
- Nigerian Pidgin: `pcm`

## Mobile

- Account locale sync reads and writes the authenticated citizen preference.
- Restart persistence keeps the selected language after app restart.
- Localized UI appears for each enabled locale in the covered screens.
- Localized notifications render title/body in the recipient locale.

## Watch

- Language sync follows the account preference and local fallback order.
- SAFE status renders correctly.
- HIGH ALERT renders correctly.
- A specific DANGER type renders with the expected localized alert.
- Localized danger alert presentation uses trusted danger codes.
- Local TTS speaks critical alert text where device capability exists.
- Pidgin records approved fallback metadata when native voice is unavailable.
- Original audio is never replaced by synthesized speech.

## Field Ops

- Officer locale sync uses the admin/officer preference source.
- Language picker persists the selected locale.
- Login/session refresh reflects locale updates.
- Operational UI renders representative localized labels.
- Localized field notification preserves routing and identifiers.

## Wave 6 Voice

For each practical language:

- Upload original audio through the existing media/evidence contract.
- Confirm source media hash is recorded.
- Confirm transcription is queued without blocking submission.
- Confirm STT completes when a real staging provider is configured.
- Confirm `detectedLocale` is correct or reasonable for the sample.
- Confirm original transcript is stored separately from translations.
- Confirm recipient `preferredLocale` translation is generated on demand.
- Confirm same-language translation is skipped and marked completed.
- Confirm another target-language translation is cached separately.
- Confirm original audio hash/object remains unchanged.

## Wave 8 Notifications

- English recipient receives English display copy.
- Hausa recipient receives Hausa display copy.
- Yoruba recipient receives Yoruba display copy.
- Igbo recipient receives Igbo display copy.
- Pidgin recipient receives Pidgin display copy.
- Mixed-language broadcast groups recipients by effective locale.
- Proper nouns, plate numbers, names, and IDs remain unchanged.
- `deepLink` and route metadata are preserved.
- Missing localized template falls back to English without blocking send.

## Failure Behavior

- STT unavailable: original emergency/report submission still succeeds, audio remains intact, and processing is marked queued, failed, or unsupported according to runtime configuration.
- Translation unavailable: transcript remains available, failed target translation is isolated, and retries do not overwrite the transcript.
- TTS unavailable: visual alert still renders, fallback metadata is recorded, and critical safety delivery is not dependent exclusively on cloud AI.
- Notification localization fallback: send proceeds with English fallback.
- Original emergency/report flow still succeeds when language AI providers are unavailable.
