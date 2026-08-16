# Staging Speech Provider Handoff

This is the DevOps handoff after the provider-readiness PR merges. It does not authorize production configuration.

## Runtime Switch

Keep AI speech disabled until real staging credentials are available:

```text
LANGUAGE_AI_RUNTIME_ENABLED=false
```

When ready for real staging certification:

```text
LANGUAGE_AI_RUNTIME_ENABLED=true
SPEECH_STT_PROVIDER=openai|google
SPEECH_TRANSLATION_PROVIDER=openai|google
```

Do not set either provider to `stub` in staging when the runtime is enabled. Startup/preflight rejects that combination.

## OpenAI Staging Variables

Required when any selected provider is `openai`:

```text
OPENAI_API_KEY=<staging-secret>
```

Optional model selectors:

```text
OPENAI_STT_MODEL=gpt-4o-mini-transcribe
OPENAI_TRANSLATION_MODEL=gpt-4o-mini
```

Use a staging-owned key with the narrowest practical project/account scope. Do not log or commit the key.

## Google Staging Variables

Required when any selected provider is `google`:

```text
GOOGLE_CLOUD_ACCESS_TOKEN=<short-lived-token-or-managed-injection>
GOOGLE_CLOUD_PROJECT=<staging-project-id>
GOOGLE_CLOUD_LOCATION=us-central1
```

Optional model selectors:

```text
GOOGLE_STT_MODEL=chirp_2
GOOGLE_TRANSLATION_MODEL=general/nmt
```

Use a staging Google Cloud project and least-privilege credentials for Speech-to-Text and Translation only. Do not reuse broad Firebase credentials unless ownership and permissions are explicitly approved.

## Safe Preflight

Run the existing API environment validation in staging configuration before deployment. Expected behavior:

- `LANGUAGE_AI_RUNTIME_ENABLED=false`: API remains healthy; speech jobs do not generate fake AI transcripts.
- `LANGUAGE_AI_RUNTIME_ENABLED=true` with `stub`: rejected in staging.
- `LANGUAGE_AI_RUNTIME_ENABLED=true` with real provider but missing credentials: rejected.
- Credential values are never printed by validation errors.

## Safe Validation

After code merge and staging configuration, validate in this order:

1. Confirm database backup/rollback readiness.
2. Apply the Wave 6 migration only in the authorized deployment task.
3. Confirm API/worker startup with speech runtime enabled.
4. Run `node scripts/speech-provider-benchmark.cjs --dataset <approved-fixtures.json> --results <provider-results.json>`.
5. Review emergency semantic accuracy before marking speech runtime certified.

Use only synthetic or explicitly approved benchmark recordings. Do not use real citizen evidence.
