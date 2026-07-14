# THE EYE Watch — Firebase

## Projects (strict isolation)

| Env | Project ID | Package |
|-----|------------|---------|
| development | `the-eye-29cff` | `com.theeye.watch.dev` |
| staging | `the-eye-2stg` | `com.theeye.watch.staging` |
| production | `the-eye-2pd-d0217` | `com.theeye.watch` |

Guards:

- `assertWatchFirebaseEnvMatchesFlavor` — Dart options `projectId` must match flavor.
- `initializeWatchFirebase` skips init when apiKey/appId still start with `REPLACE_WITH_`.

## Config locations

- Gradle: `android/app/src/{development,staging,production}/google-services.json` (gitignored)
- Dart: `lib/firebase_options_{development,staging,production}.dart`

Until real API keys are filled in Dart options **and** matching `google-services.json` is present, Firebase init returns degraded / uninitialized (boot continues offline for push).

## FCM

- `PushMessagingService` registers token with backend via `AlertService`.
- Background: `firebaseMessagingBackgroundHandler`
- Categories filtered by `PushMessageRouter` (watch-safe only)

## Do not

- Point staging builds at production Firebase/API (or the reverse)
- Commit real tokens / secrets into docs or git
