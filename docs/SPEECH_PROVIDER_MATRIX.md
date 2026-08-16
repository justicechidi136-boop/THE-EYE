# Speech Provider Matrix

This matrix supports staging evaluation for THE EYE speech-to-text and translation. It is not a production approval. Real selection requires a controlled benchmark with synthetic or explicitly approved test recordings.

## Implemented Providers

| Provider | STT adapter | Translation adapter | Credential mechanism |
| --- | --- | --- | --- |
| `stub` | Yes, dev/test only | Yes, dev/test only | None |
| `openai` | Yes | Yes | `OPENAI_API_KEY` |
| `google` | Yes | Yes | `GOOGLE_CLOUD_ACCESS_TOKEN`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` |

## Language Coverage

| Capability | OpenAI | Google |
| --- | --- | --- |
| STT English | Supported by adapter; benchmark required for Nigerian accents and emergency vocabulary | Supported with configured Google language code `en-US`; benchmark required for Nigerian accents |
| STT Hausa | Supported by adapter when provider accepts locale hint; benchmark required | Supported with `ha-NG` |
| STT Yoruba | Supported by adapter when provider accepts locale hint; benchmark required | Supported with `yo-NG` |
| STT Igbo | Supported by adapter when provider accepts locale hint; benchmark required | Supported with `ig-NG` |
| STT Nigerian Pidgin | Benchmark required; do not assume native support | Unsupported by adapter until provider documentation confirms native `pcm` STT |
| Translation English | Supported by adapter | Supported by adapter |
| Translation Hausa | Supported by adapter; benchmark required | Supported by adapter |
| Translation Yoruba | Supported by adapter; benchmark required | Supported by adapter |
| Translation Igbo | Supported by adapter; benchmark required | Supported by adapter |
| Translation Nigerian Pidgin | Supported by OpenAI adapter as model-generated text; must be benchmarked for accuracy | Unsupported by adapter until provider documentation confirms native `pcm` translation |

## Capability Factors

| Factor | OpenAI | Google |
| --- | --- | --- |
| Language detection | STT may return language metadata when available; adapter does not fabricate confidence | Google STT can return result language codes; adapter stores returned code |
| Confidence metadata | Not fabricated when unavailable | Alternative confidence is stored when returned |
| Max audio size/duration | Governed by provider API and THE EYE evidence size policy; benchmark harness records sample duration/bytes | Governed by provider API and THE EYE evidence size policy; benchmark harness records sample duration/bytes |
| Async/batch | Current adapter is synchronous per queued BullMQ job | Current adapter is synchronous per queued BullMQ job |
| Latency | Measure per provider/sample in benchmark | Measure per provider/sample in benchmark |
| Regional availability | Depends on account/project configuration | Depends on Google project location/model availability |
| Credential mechanism | Bearer API key, least-privilege project secret | Short-lived access token for this adapter; DevOps may later replace with stronger ADC/service account plumbing |
| Cost variables | Audio minutes, model, input/output text tokens | Audio duration, translation characters, model/location |
| Data retention/privacy | Must be reviewed against provider account settings before production approval | Must be reviewed against Google Cloud project data controls before production approval |
| Provider failure behavior | Auth, timeout, rate limit, empty result, and request failures map to bounded provider error codes | Auth, timeout, rate limit, unsupported language, empty result, and request failures map to bounded provider error codes |

## Selection Criteria

Rank providers by:

1. Emergency semantic accuracy.
2. Hausa, Yoruba, Igbo, and Nigerian Pidgin coverage.
3. Hallucination/addition rate.
4. Reliability and retry behavior.
5. Privacy/security posture.
6. Latency under staging conditions.
7. Cost at expected incident volume.

If no single provider handles all five enabled locales well, prefer explicit provider routing: a primary provider plus per-language fallback providers. Do not enable fallback routing until benchmark evidence justifies it.

## Documentation Basis

- OpenAI audio transcription and model behavior must follow the current OpenAI speech-to-text and audio transcription API documentation: https://platform.openai.com/docs/guides/speech-to-text and https://platform.openai.com/docs/api-reference/audio/createTranscription.
- OpenAI translation uses the Responses API contract: https://platform.openai.com/docs/api-reference/responses.
- Google STT language support must follow the current Cloud Speech-to-Text V2 supported languages table: https://docs.cloud.google.com/speech-to-text/v2/docs/speech-to-text-supported-languages.
- Google Translation language support must follow the current Cloud Translation supported languages table: https://cloud.google.com/translate/docs/languages.
- Provider privacy/data-retention claims must be rechecked against the active account terms before production approval.
