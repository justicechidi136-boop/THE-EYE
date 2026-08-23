# Mobile QA New Bug(1) Delta

Audit date: 2026-08-23

## Baseline and sources

- `origin/staging`: `b41a7a83ce596ceefa7afcfa53c70df520349093` (PR #172 merged).
- Working branch / PR: `fix/mobile-qa-defect-closeout` / PR #173 at audit start.
- PR #173 audit head: `71a71a2268d14ebef89a87253d802c0d288ac14d`.
- Previous closeout source: `docs/MOBILE_QA_NEW_BUG_CLOSEOUT.md`.
- The two named DOCX files were not present in the supplied attachment locations. This matrix uses the complete New Bug(1) requirements supplied in the task, the previous closeout, current source, tests, Git history, and recorded device QA.

## Branch decision

Continue on PR #173. The new delta is part of the same mobile QA closeout and depends on PR #173's unmerged evidence and Broadcast Comments repairs. Splitting from `origin/staging` would omit those fixes; stacking another PR on PR #173 would add review and merge-order risk. No merge or deployment is authorized by this decision.

## Requirement matrix

| QA ID | Classification at audit | Requirement | Previous implementation / fix | Current source and automated evidence | Runtime status | Additional code required |
| --- | --- | --- | --- | --- | --- | --- |
| UI-001 | ALREADY FIXED | Safety Broadcast header | Recorded complete in the previous closeout | Shared page-header implementation and existing mobile UI tests remain present | Previously engineering-verified | No, unless regression testing fails |
| UI-002 | ALREADY FIXED | Secondary headers | Recorded complete in the previous closeout | Shared `EyePageHeader` remains in use; PR #173 preserves it | Previously engineering-verified | No |
| UX-001 | ALREADY FIXED | Notification templates | Recorded complete in the previous closeout | Citizen notification presenter and tests remain present | Previously engineering-verified | No |
| UX-002A | ENGINEERING FIXED / RUNTIME QA PENDING | Voice evidence | Existing evidence architecture; preserved by PR #173 | Shared evidence picker/collection and focused evidence tests | Real-device voice certification is not complete | No code unless device QA proves a defect |
| UX-002B | ENGINEERING FIXED / RUNTIME QA PENDING | Video preview and playback | PR #173 `344d969f` | `evidence_video_thumbnail.dart`, `evidence_viewer_screen.dart`, and shared evidence tests | Device playback remains pending | No code unless device QA proves a defect |
| UX-003A | ENGINEERING FIXED / RUNTIME QA PENDING | Compact Evidence section | PR #173 `344d969f` | Shared evidence components and widget tests | Device QA remains pending | No |
| UX-003B | ENGINEERING FIXED / RUNTIME QA PENDING | All Evidence | PR #173 `344d969f` | `all_evidence_screen.dart` and shared evidence tests | Device QA remains pending | No |
| UX-008 | ENGINEERING FIXED / RUNTIME QA PENDING | Human-readable location | PR #173 `caf2c436` | `citizen_location_details.dart`, reverse geocoding, and location tests | Device/network geocoding QA remains pending | No |
| UX-009 | ENGINEERING FIXED / RUNTIME QA PENDING | Archived incident terminal status | PR #173 `caf2c436` | Archive contract/screen and API lifecycle coverage | Device QA remains pending | No |
| UX-010A | ENGINEERING FIXED / RUNTIME QA PENDING | Saved vehicle photo reuse | PR #159, preserved in staging | Saved garage photos are loaded into `CarProfile` and reused by Stolen Vehicle creation | End-to-end device upload/reuse not yet certified | No for the old requirement; UX-013 adds new work |
| UX-010B | ENGINEERING FIXED / RUNTIME QA PENDING | Saved vehicle selection UX | PR #159, preserved in staging | Stolen Vehicle choice/saved/manual modes and mobile vehicle tests | Device QA remains pending | No |
| UX-011 | ENGINEERING FIXED / RUNTIME QA PENDING | Broadcast role actions | PR #159, preserved in staging | Broadcast action policy and detail tests | Device QA remains pending | No |
| UX-012 | PARTIAL | Broadcast cards and privacy-safe plate presentation | PR #159 improved cards | Current cards/details and public share mapper redact private fields; compact-card masking policy needs focused regression proof | Not re-certified against New Bug(1) | Tests and any minimal display correction only if audit proves unsafe summary output |
| AUTH-001 | ENGINEERING FIXED / RUNTIME QA PENDING | Forgot Password and Recover Account | PR #161, preserved by PR #172 | Existing auth flows and tests remain present | Full external email/deep-link runtime QA pending | No |
| AUTH-002 | ENGINEERING FIXED / RUNTIME QA PENDING | Return to mobile after recovery | Existing fix plus PR #173 auth return regression coverage | `citizen_auth_return_listener.dart` and tests | Device return-flow QA pending | No |
| FUNC-001 | ENGINEERING FIXED / RUNTIME QA PENDING | Long-idle authentication/session continuity | PR #163 and PR #172 (`a3488fa2`) | Persistent session/authenticated request implementation and tests | Long-idle physical QA pending | No |
| UX-013 | PARTIAL | Dedicated Vehicle Photos flow for Saved Vehicles and Stolen Vehicle creation | Saved Vehicles already support up to 8 photos, Camera/Gallery, thumbnails, full view, remove, retry, ordering, and Firebase signed upload. Stolen Vehicle has a separate Vehicle Photos section and preserves saved-photo association | `main.dart` vehicle editor/Stolen Vehicle screen; `CitizenVehiclePhoto`; `/me/vehicles/:id/photos/*`; vehicle tests | Existing upload path not fully device-certified | Yes: angle selection/display/persistence is missing; replace generic primary UI in Stolen Vehicle with the purpose-built angle/source flow while reusing storage |
| UX-013 model/API | PARTIAL | Multiple photos, ID, angle/category, order, thumbnail, saved association | `CitizenVehiclePhoto` already supplies ID, object key, sort order, and vehicle association; signed GET supplies preview | Prisma schema and vehicle photo controller/service paths | Runtime pending | Angle/category is absent and needs the smallest additive metadata change; no second media/storage model |
| UX-014 | PARTIAL | Approved Neighborhood Watch Home structure | Location-aware Home, Current Area, Safety Summary, nearby content, tabs, and creation paths already exist | `nw_home_screen.dart` and Neighborhood Watch tests | Not certified against the new layout | Yes: remove duplicate action/dashboard/navigation tiles, retain real-data summary/nearby empty state, expose one floating creation action |
| UX-014 architecture | ALREADY FIXED | Location determines default area; membership controls private community access | Existing Neighborhood Watch context architecture | Dynamic-area/context services and mobile/API tests | Previously engineering-verified | No; preserve during UI change |
| UX-015 | PARTIAL | Approved Neighborhood Watch Feed structure | Feed already has All/Discussions/Tips/Traffic filters, post cards/interactions, empty/error states, and local authorization | `CommunityFeedScreen` in `main.dart`; Neighborhood Watch feed/service tests | Not certified against the new layout | Yes: remove the extra action dashboard, place active notice immediately after filters, retain one floating creation action, and align empty copy |
| FUNC-002 | PARTIAL | Distinguishing Features survives Stolen Vehicle create/read/detail | Form and DTO/service persistence already exist | Stolen Vehicle payload sends `distinguishingFeatures`; API DTO/service reads it; Flutter detail field lookup exists | QA reports it missing in Vehicle/Broadcast Detail | Yes: trace returned contract and render a clearly labeled complete value; add create/read/UI regression tests |
| FUNC-003 basic | ENGINEERING FIXED / RUNTIME QA PENDING | Scrollable Comments list, name, body, timestamp, input/send, empty state | PR #172 repaired access/session path; PR #173 `2c382433` repaired blank layout | `BroadcastCommentsScreen`; service/controller tests and mobile broadcast tests | Physical create/back flow passed after PR #173 APK; backend staging still lacks unmerged PR #173 changes where applicable | No unless regression tests fail |
| FUNC-003 replies | ALREADY FIXED | Reply to an accessible comment | Existing API `parentId` and mobile reply UI | Controller/service validates parent within the same Broadcast; tests exist but need expanded security assertions | Not physically re-certified | Tests may be expanded; no duplicate implementation |
| FUNC-003 reactions | PARTIAL | React/unreact and duplicate-safe behavior | Reaction upsert and mobile Helpful/Thanks actions exist | API has unique `(commentId,userId,reaction)` constraint and upsert; mobile renders counts | Unreact behavior is not currently exposed/proven | Yes: audit and implement toggle/removal if absent; add duplicate/toggle tests |
| FUNC-003 edit own | ALREADY FIXED | Edit only own comment | Existing API and mobile edit dialog | Service enforces `authorUserId === actor.sub`; mobile only shows action for current author | Not physically re-certified | Security regression tests only |
| FUNC-003 delete own | ALREADY FIXED | Delete only own comment | Existing API and mobile delete confirmation | Service enforces ownership and soft-hides; mobile only shows action for current author | Not physically re-certified | Security regression tests only |
| FUNC-003 security | PARTIAL | Access control, reply integrity, author integrity, IDOR prevention | Ownership and same-Broadcast comment lookups exist; author comes from JWT | Broadcast service/controller and Prisma constraints | Runtime security QA not applicable; automated proof incomplete | Add focused authorization, cross-Broadcast reply, spoofing, and reaction-deduplication tests; make only proven server correction |
| FUNC-004 native | ENGINEERING FIXED / RUNTIME QA PENDING | Native OS Broadcast share sheet | PR #172 lifecycle fix | `share_plus`, `BroadcastShareScreen`, and share tests | Physical Android share sheet passed | No |
| FUNC-004 deep link | PARTIAL | Stable installed-app Broadcast deep link | Payload carries `/broadcasts/:id` | Public share mapper/service tests cover route field | Android app-link/universal-link routing is not fully certified | Yes if manifest/router audit shows the URL is not an install-aware stable link |
| FUNC-004 public web | PARTIAL | Unauthenticated public Broadcast fallback | Public API controller and redacted public share service exist | `/public/broadcasts/:id/share` contract and redaction tests; current `shareUrl` may be relative and no confirmed public detail web page exists | Not runtime-certified | Yes: define stable public URL and add/verify a public-safe web detail route without private signed evidence |
| FUNC-004 share text | PARTIAL | User-friendly type-specific public share message | Existing share text builder and API payload | Redaction tests exist | Native share passed, content not fully certified | Improve only where current output lacks approved title/last-seen/location/link structure |
| National Broadcast independence | ALREADY FIXED | Broadcast remains country-wide and independent of Neighborhood Watch | PR #172 | `listCountryWide` is used separately from Neighborhood Watch context | Engineering-verified | No; add preservation regression coverage where useful |

## Regressions found at audit start

- No confirmed regression in an item previously classified complete.
- Physical evidence upload still fails against the current staging backend because PR #173's incident-media BigInt serialization fix (`71a71a22`) is not merged/deployed. This is an environment/version gap, not a regression in the branch implementation.
- New Bug(1)'s report that Distinguishing Features is absent from detail is classified PARTIAL pending create/read/render tracing.

## New or expanded New Bug(1) scope

- UX-013 angle-aware, purpose-built Vehicle Photos workflow.
- UX-014 Neighborhood Watch Home layout reduction and single floating creation action.
- UX-015 Neighborhood Watch Feed layout reduction, notice placement, and exact empty state.
- FUNC-002 end-to-end Distinguishing Features rendering.
- FUNC-003 reaction toggle plus expanded comment security proof.
- FUNC-004 install-aware deep link and unauthenticated public web fallback.

This file is the pre-implementation classification. Statuses must be updated with final code, test, build, CI, and physical QA evidence before closeout.

## Post-implementation status

### Implemented delta

- **UX-013:** Added a dedicated, eight-photo Vehicle Photos component for Saved Vehicles and Stolen Vehicle creation. The flow is angle (Front/Rear/Side/Other), then Camera/Gallery. It preserves thumbnail, full preview, remove, order, Firebase signed upload/read, and saved-vehicle association. `CitizenVehiclePhoto.angle` is an additive field constrained to the four approved values.
- **UX-014:** Reduced Neighborhood Watch Home to the approved tab shell, Current Area, real Safety Summary, What's happening nearby, and one floating creation action. Removed duplicate action and navigation dashboards without changing location or membership authorization.
- **UX-015:** Reduced Neighborhood Watch Feed to the approved filters, optional real Community Notice, posts/empty state, and one floating creation action. Existing Like, Comment, Share, location, and membership behavior remains intact.
- **FUNC-002:** Preserved `distinguishingFeatures` through create/read and rendered it as a separately labeled, multiline-safe Broadcast Detail section.
- **FUNC-003:** Preserved the repaired Comments lifecycle, reply/edit/delete ownership checks, and added duplicate-safe reaction toggle/unreact behavior plus cross-Broadcast and ownership regression coverage.
- **FUNC-004:** Preserved the native OS share sheet and added a stable HTTPS share URL, redacted public API contract, public Admin-Web fallback page, Android share-link route handling, and type-aware share text. No private evidence URL, reporter identity, exact private location, VIN, or internal metadata is returned publicly.

### Automated evidence

- API TypeScript: PASS.
- API full suite: PASS, 934/934.
- Mobile analyze: PASS with warnings/infos non-fatal.
- Mobile focused delta suite: PASS, 50/50 after the final Vehicle Photos test addition.
- Mobile full suite: PASS, 595/595 before the final isolated Vehicle Photos test addition; the changed test then passed 3/3.
- Admin-Web tests: PASS, 52/52.
- Admin-Web compile/typecheck/static generation: PASS through all 44 pages. Local standalone packaging is blocked on Windows by `EPERM` symlink creation; Linux CI remains the packaging authority.
- Prisma client generation: PASS.
- Secret scan: PASS, 2,105 tracked files.
- `git diff --check`: PASS (line-ending notices only).
- Staging Android debug APK: PASS (`assembleStagingDebug`).
- V2322 install/launch smoke: PASS using `adb install -r`; existing app data was not cleared, the staging activity remained resumed, a visible authenticated Home frame rendered, and targeted immediate-crash logcat was clear.

### Runtime status and blockers

- Physical-device certification of the new screens, saved-photo upload/reuse, comment interaction, and installed-app share routing remains pending. The branch APK is installed and launch-smoke verified, but no claim is made for flows the owner has not manually exercised.
- The existing staging backend does not contain PR #173 or this delta. End-to-end upload, persistence, public fallback, reaction toggle, and the additive vehicle-photo migration cannot be certified against staging without a later authorized merge/deploy/migration.
- Android intent routing is implemented. Verified automatic Android App Link ownership still requires the deployed public host to serve an approved `assetlinks.json` for the actual staging/release signing certificate. No certificate fingerprint was guessed or committed.
- No deployment, migration execution, production change, secret change, stash operation, or destructive database command was performed.

### Final engineering classification

| Requirement | Engineering status | Runtime status |
| --- | --- | --- |
| UX-013 Vehicle Photos | PASS | QA pending |
| UX-014 Neighborhood Watch Home | PASS | QA pending |
| UX-015 Neighborhood Watch Feed | PASS | QA pending |
| FUNC-002 Distinguishing Features | PASS | Staging create/read QA pending |
| FUNC-003 Comments basic/reply/react/edit/delete | PASS | Staging interaction QA pending |
| FUNC-004 native share | PASS (preserved) | Previously passed; regression QA pending |
| FUNC-004 public web fallback | PASS | Deploy/runtime QA pending |
| FUNC-004 verified installed-app deep link | PARTIAL | Public-host association file/config pending |
| Neighborhood Watch location architecture | PASS | Preserved |
| National Broadcast independence | PASS | Preserved |
