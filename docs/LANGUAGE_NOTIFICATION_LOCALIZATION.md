# THE EYE Recipient-Localized Notifications

Wave 8 localizes notification display text per recipient language while preserving routing and structured identifiers.

## Source Of Truth

Recipient language resolution uses account `preferredLocale`.

Fallback order:

- recipient `preferredLocale`
- supported effective locale
- English

Supported notification locales are `en`, `ha`, `yo`, `ig`, and `pcm`.

## Template Contract

Notifications prefer structured templates:

- `notificationTemplateKey`
- `notificationParams`
- recipient locale

Display text is rendered from trusted template grammar. Proper nouns and identifiers stay as parameters and are not translated, including names, street names, plate numbers, vehicle registrations, incident IDs, and officer names.

If a localized template is missing, delivery continues with English/original display text and records fallback metadata.

## Presentation Metadata

Notification rows and FCM data preserve routing identifiers such as:

- `notificationId`
- `incidentId`
- `broadcastId`
- `alertCode`
- `deepLink`
- `route`
- `destination`

Localized presentation metadata includes:

- `notificationLocale`
- `notificationTemplateKey`
- `notificationFallbackLocale`
- `notificationLocalizationMissingTemplate`

Mobile, watch, field tablet, and admin clients should use localized `title` and `body` for display while continuing to route from structured identifiers.

## Boundaries

This wave does not implement STT, translation providers, TTS providers, or arbitrary runtime translation of English notification strings.
