# THE EYE Voice-First Reporting

## Phase 1 — Forms audit matrix

| Workflow | Surface | Text | Image | Video | Audio | Location | Anonymous |
|---|---|---|---|---|---|---|---|
| Emergency reports | Mobile `ReportScreen` | Yes | Yes (figma) | Via evidence picker | **VoiceRecorder + file pick** | Yes | Yes |
| General crime | Mobile `ReportScreen` | Yes | Yes | Via evidence picker | **VoiceRecorder + file pick** | Yes | Yes |
| Missing person | Mobile dedicated screen | Yes | Yes | Via evidence picker | **VoiceRecorder + file pick** | Yes | Yes |
| Stolen vehicle | Mobile dedicated screen | Yes | Yes | Via evidence picker | **VoiceRecorder + file pick** | Yes | Yes |
| Anonymous reports | Mobile (anonymous toggle) | Optional | Yes | Yes | **Voice-only supported** | Yes | Yes |
| Incident follow-up updates | Mobile timeline | Yes | Partial | Partial | Stage 2 | Yes | Partial |
| Sightings | API/mobile partial | Yes | Partial | No | Stage 2 | Yes | Partial |
| Admin/police messages | Admin + API | Yes | No | No | Stage 2 | N/A | N/A |
| NW posts | Mobile `CreateCommunityPostScreen` | Optional with voice/media | Yes | No | **VoiceRecorder** | Optional | No |
| NW comments | Mobile `CommunityPostDetailScreen` | Optional with voice | No | No | **VoiceRecorder** | No | No |
| NW replies | Mobile comment reply | Optional with voice | No | No | **VoiceRecorder** | No | No |
| NW alerts | Broadcast system | Yes | No | No | Stage 2 | Geo | No |
| Evidence submissions | Shared `ManagedEvidenceSection` | N/A | Yes | Yes | **Yes** | Optional | N/A |

### Shared components extended (not duplicated)

- `ManagedEvidenceSection` / `EvidenceAttachmentPicker` — hosts `VoiceRecorder`
- `EvidenceCaptureController` — `addVoiceAttachment`
- `EvidenceUploadService` — voice metadata on confirm
- `IncidentMedia` / S3 presign — existing audio MIME support extended
- `IncidentSubmissionValidator` — voice OR text OR image/video

---

## Architecture (Stage 1)

1. Client records AAC/M4A (`record` package, 64kbps mono, max 300s).
2. Existing presign → PUT → confirm flow for incident media.
3. API creates incident **before** transcription; audio attached asynchronously.
4. BullMQ queue `the-eye-{env}-voice-transcription` with job ID `voice-transcription-{attachmentId}`.
5. **Stage 3:** OpenAI Whisper provider for English + Nigerian Pidgin (`TRANSCRIPTION_PROVIDER=openai`, `OPENAI_API_KEY`). Stub remains default for local dev.
6. Original audio retained permanently; transcript is additive.
7. Admin inline `<audio>` player + transcript panel with verification warning.

---

## Audio format and limits

| Setting | Value |
|---|---|
| Primary format | AAC/M4A (`audio/mp4`) |
| Alternate | Opus/WebM (`audio/webm`) via file pick |
| Sample rate | 44.1 kHz speech capture |
| Bitrate | 64 kbps mono |
| Max duration | 300 seconds |
| Max file size | 25 MB (voice), 100 MB (general evidence cap) |

---

## API endpoints (Stage 1)

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/incidents/:id/media/presign` | Upload authorization (existing) |
| POST | `/v1/incidents/:id/media/confirm` | Finalize attachment + queue transcription |
| GET | `/v1/incidents/:id/media/:mediaId/voice/playback` | Short-lived playback URL + transcript metadata |
| POST | `/v1/incidents/:id/media/:mediaId/voice/retry-transcription` | Admin retry |
| PUT | `/v1/incidents/:id/media/:mediaId/voice/transcript` | Admin manual correction |

---

## Prisma migration

`20260730160000_voice_attachments_transcription`

- Enums: `VoiceTranscriptionStatus`, `VoiceModerationStatus`
- Extended: `IncidentMedia`, `CommunityPostMedia` with duration, language, transcription, moderation, soft-delete fields

---

## BullMQ design

- Queue: `resolveVoiceTranscriptionQueueName(env)`
- Job name: `transcribe`
- Job ID: `voice-transcription-{attachmentId}` (no colons)
- States: Uploaded → Queued → Processing → Completed | LowConfidence | Failed
- Enqueue failures logged; **never block report submission**

---

## Languages (design)

English, Nigerian Pidgin, Hausa, Yoruba, Igbo, French, Swahili + auto-detect.  
Fields: `selectedLanguage`, `detectedLanguage`, `languageDetectionConfidence`, `translatedTranscript` (derived, separate from original).

---

## Offline behaviour

- Voice recorded locally via existing pending submission / evidence paths
- Same `clientAttachmentId` (`localId`) sent on confirm for idempotency
- Upload retried via `PendingRetryCoordinator` (existing emergency offline policy)

---

## Accessibility

- `VoiceRecorder` states: IDLE, RECORDING, PAUSED, RECORDED, PLAYING, UPLOADING, UPLOADED, FAILED, OFFLINE_PENDING
- Large mic control (88dp), timer, level indicator, haptics, Semantics labels
- Consent banner; voice-only submission without typed text

---

## Rollout (Phase 16)

| Stage | Scope |
|---|---|
| 1 | Emergency + general incident voice attachments (**PR #51**) |
| 2 | Neighborhood Watch voice posts, comments, and replies (**feat/voice-neighborhood-watch**) |
| 3 | Transcription EN + Nigerian Pidgin (**#53**) |
| 4 | Hausa, Yoruba, Igbo, French, Swahili (**feat/voice-transcription-stage4**) |
| 5 | Translation, moderation, analytics, TTS guidance |

---

## Stage 3 — OpenAI Whisper transcription

| Variable | Purpose |
|---|---|
| `TRANSCRIPTION_PROVIDER` | `stub` (default) or `openai` |
| `OPENAI_API_KEY` | Required when provider is OpenAI |
| `OPENAI_TRANSCRIPTION_MODEL` | Defaults to `whisper-1` |
| `TRANSCRIPTION_CONFIDENCE_THRESHOLD` | Marks `LowConfidence` below this score (default `0.55`) |

- English (`en`) sends a Whisper language hint.
- Nigerian Pidgin (`pcm`) and auto-detect omit the hint because Whisper has no Pidgin ISO code.
- `selectedLanguage` always reflects the user's choice; `detectedLanguage` comes from Whisper and is never upgraded to `pcm` automatically.
- Original audio is always retained; transcription failures only update media status.

## Stage 4 — Additional Whisper languages

Whisper ISO hints and detection normalization for:

| Code | Language |
|---|---|
| `ha` | Hausa |
| `yo` | Yoruba |
| `ig` | Igbo |
| `fr` | French |
| `sw` | Swahili |

No new env vars beyond Stage 3. Mobile language picker already exposes all codes; admin transcript panels now show human-readable language labels.

---

## Remaining risks

- Audio moderation async pipeline Stage 5
- iOS/Android microphone background/phone-call edge cases need device QA
- `record` / `just_audio` native deps require `flutter pub get` + platform permission strings
