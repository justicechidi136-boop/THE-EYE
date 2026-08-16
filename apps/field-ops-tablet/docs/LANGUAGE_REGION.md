# Field Ops Language & Region

Wave 5 localizes Field Ops tablet UI chrome for Nigeria operations.

## Supported Languages

- English (`en`)
- Hausa (`ha`)
- Yoruba (`yo`)
- Igbo (`ig`)
- Nigerian Pidgin (`pcm`)

Nigeria (`NG`) remains the only enabled Field Ops region in this wave.

## Locale Precedence

The tablet resolves locale in this order:

1. Authenticated officer account `preferredLocale`
2. Secure cached `preferredLocale`
3. Supported device locale
4. English fallback

## Authoritative API

Officer language is stored in `AdminUserPreference.preferredLocale`.

- Read: `GET /v1/admin/preferences`
- Write: `PATCH /v1/admin/preferences`
- Field session propagation: `/v1/field/auth/login`, `/v1/field/auth/refresh`, and `/v1/field/auth/session`

Field Ops does not write officer locale through `/v1/users/me`; that endpoint remains citizen-scoped.

## Offline Behavior

The app applies cached or newly selected language immediately. If the server update fails while offline, the local selection remains active and the UI shows a non-destructive sync warning. Future account refresh can reconcile to the authoritative server value.

## Source Data Boundary

Wave 5 translates application UI chrome only. It does not translate names, addresses, officer narratives, citizen reports, witness statements, incident descriptions, chat bodies, evidence captions, license plates, IDs, BOLO source text, or audit logs.

## Legal Text

No long legal, policy, or evidentiary text was translated in Wave 5. Any such text without approved translations remains authoritative English pending legal review.

## Wave 6 Boundary

Message/content translation, speech-to-text, text-to-speech, and narrative translation belong to Wave 6 and later runtime translation work.
