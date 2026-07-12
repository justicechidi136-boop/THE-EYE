# TD-02 Completion Report — Mobile Contract Sharing

**Date:** 2026-07-10  
**Debt item:** TD-02 — Mobile outside monorepo; no shared types  
**Status:** **Resolved** (contract layer; no new product features)

---

## Objective

Ensure the Flutter mobile app and NestJS backend share the same API contracts for enums, payload shapes, validation constants, and wired endpoints — without adding new API surfaces or mobile screens.

---

## What was done

### 1. Centralized canonical contracts (`@the-eye/shared`)

| Artifact | Purpose |
|----------|---------|
| `packages/shared/src/enums.ts` | All domain + smartwatch enums (single source) |
| `packages/shared/src/contracts.ts` | Mobile API endpoint specs, field metadata, validation constants |
| `packages/shared/src/permissions.ts` | RBAC maps (split to avoid circular imports) |
| `packages/shared/dist/contracts.json` | Generated manifest for CI contract tests |

Build now emits `contracts.json` via `generate-contract-manifest.ts`.

### 2. Backend DTO alignment

- `smartwatch.dto.ts` imports `SmartwatchConnectivityMode`, `SmartwatchEmergencyMode`, `SmartwatchPairingMethod`, `FirmwareSignatureStatus`, `SmartwatchOfflineEventType`, and `reportIncidentValidation` from `@the-eye/shared`
- Inline string unions removed from smartwatch DTOs
- Validation thresholds (`sosLongPressMinMs`, `offlineSyncMaxEvents`) reference shared constants

### 3. Flutter contract mirror (`apps/mobile/lib/contracts/`)

| File | Role |
|------|------|
| `the_eye_enums.dart` | Dart constants mirroring all shared enums + validation limits |
| `the_eye_api_paths.dart` | `/v1` path constants matching NestJS controllers |
| `the_eye_payloads.dart` | JSON builders matching DTO field names exactly |
| `the_eye_api_client.dart` | Typed HTTP client for 7 wired mobile endpoints |
| `report_type.dart` | UI `ReportType` → canonical `IncidentType` mapping |

### 4. Mobile app integration

- `main.dart` refactored to use `TheEyeApiClient` + `TheEyePayloads`
- Removed duplicate inline `_gpsPayload` maps and raw `http.post` calls
- Renamed conflicting `IncidentStatus` view model → `IncidentTrackingItem`
- `ReportType` maps to shared `IncidentType` via `ReportTypeContract`
- Smartwatch dropdowns and payloads use shared enum constants

### 5. Monorepo inclusion

- `apps/mobile` added to `pnpm-workspace.yaml` with `package.json` scripts for lint/test/smoke
- Root `test:integration` now runs `test:mobile:contracts` before smoke tests

### 6. Contract verification (CI)

| Test | Coverage |
|------|----------|
| `scripts/mobile-contract-test.cjs` | Dart enums ↔ `contracts.json`; payload fields; API client methods |
| `scripts/mobile-smoke-test.cjs` | Routes, screens, contract file presence |
| `apps/api/src/__tests__/mobile-contract.spec.ts` | 6 backend-side contract alignment checks |

---

## DTO audit summary

| Module | DTO file | Mobile wired? | Contract in manifest? |
|--------|----------|---------------|----------------------|
| live-video | `live-video.dto.ts` | Yes (2 endpoints) | Yes |
| smartwatch | `smartwatch.dto.ts` | Yes (5 endpoints) | Yes |
| incidents | `report-incident.dto.ts` | Payload ready | Yes (`incidents.report`) |
| auth | `auth.dto.ts` | No (UI prototype) | No |
| broadcasts | `broadcast.dto.ts` | No (mock UI) | No |
| notifications | `notification.dto.ts` | No (mock UI) | No |
| neighborhood-watch | `neighborhood-watch.dto.ts` | No (mock UI) | No |
| verification | `verification.dto.ts` | No | No |
| police-stations | `police-station.dto.ts` | No (mock UI) | No |
| escalation | `escalation-rule.dto.ts` | No | No |

**8 mobile endpoints** are contract-locked today. Remaining DTOs are documented for future wiring (TD-18).

---

## Enum consistency

| Enum | Shared TS | API DTO | Dart mirror | Status |
|------|-----------|---------|-------------|--------|
| `IncidentType` | `enums.ts` | `report-incident.dto.ts` | `the_eye_enums.dart` | Aligned |
| `IncidentStatus` | `enums.ts` | Prisma | `the_eye_enums.dart` | Aligned |
| `IncidentPriority` | `enums.ts` | incidents/broadcasts | `the_eye_enums.dart` | Aligned |
| `SmartwatchConnectivityMode` | `enums.ts` | `smartwatch.dto.ts` | `the_eye_enums.dart` | Aligned |
| `SmartwatchEmergencyMode` | `enums.ts` | `smartwatch.dto.ts` | `the_eye_enums.dart` | Aligned |
| `SmartwatchPairingMethod` | `enums.ts` | `smartwatch.dto.ts` | `the_eye_enums.dart` | Aligned |
| `SmartwatchOfflineEventType` | `enums.ts` | `smartwatch.dto.ts` | `the_eye_enums.dart` | Aligned |
| `FirmwareSignatureStatus` | `enums.ts` | `smartwatch.dto.ts` | `the_eye_enums.dart` | Aligned |

---

## Validation rule alignment

| Rule | Shared constant | API validator | Dart constant |
|------|-----------------|---------------|---------------|
| Description min length | `descriptionMinLength: 5` | `validateReportIncidentDto` | `TheEyeEnums.descriptionMinLength` |
| SOS long-press min | `sosLongPressMinMs: 3000` | `validateSmartwatchSosDto` | `TheEyeEnums.sosLongPressMinMs` |
| Offline sync max events | `offlineSyncMaxEvents: 100` | `validateOfflineSyncDto` | `TheEyeEnums.offlineSyncMaxEvents` |
| GPS latitude | `-90..90` | `assertCoordinate` | Payload builders use `Position` |
| Battery/signal | `0..100` | `validateSmartwatchStatusDto` | Payload builders pass int values |

---

## Files changed

### Shared package
- `packages/shared/src/enums.ts` *(new)*
- `packages/shared/src/contracts.ts` *(new)*
- `packages/shared/src/permissions.ts` *(new)*
- `packages/shared/src/generate-contract-manifest.ts` *(new)*
- `packages/shared/src/index.ts` *(refactored)*
- `packages/shared/package.json`

### API
- `apps/api/src/modules/smartwatch/dto/smartwatch.dto.ts`
- `apps/api/src/modules/smartwatch/__tests__/smartwatch.dto.spec.ts`
- `apps/api/src/modules/smartwatch/__tests__/smartwatch.service.spec.ts`
- `apps/api/src/__tests__/mobile-contract.spec.ts` *(new)*
- `apps/api/src/__tests__/integration-wiring.spec.ts`

### Mobile
- `apps/mobile/package.json` *(new)*
- `apps/mobile/lib/contracts/the_eye_enums.dart` *(new)*
- `apps/mobile/lib/contracts/the_eye_api_paths.dart` *(new)*
- `apps/mobile/lib/contracts/the_eye_payloads.dart` *(new)*
- `apps/mobile/lib/contracts/the_eye_api_client.dart` *(new)*
- `apps/mobile/lib/contracts/report_type.dart` *(new)*
- `apps/mobile/lib/main.dart`

### Monorepo / CI
- `pnpm-workspace.yaml`
- `package.json`
- `scripts/mobile-contract-test.cjs` *(new)*
- `scripts/mobile-smoke-test.cjs`

### Generated (build output)
- `packages/shared/dist/contracts.json`

---

## Verification results

| Command | Result |
|---------|--------|
| `pnpm run lint` | **PASS** (shared, api, admin-web, mobile) |
| `pnpm run build` | **PASS** (shared, api, admin-web) |
| `pnpm run test:backend` | **PASS** (94/94) |
| `pnpm run test:mobile:contracts` | **PASS** (8 endpoints, 11 enum groups) |
| `pnpm run test:mobile:smoke` | **PASS** |
| `pnpm run test:integration` | **PASS** |
| `flutter build` | **SKIPPED** — Flutter SDK not in PATH on CI machine |

---

## Remaining follow-ups (not TD-02)

| Item | Notes |
|------|-------|
| TD-18 | Wire `POST /incidents/report` — payload builder exists, auth not wired |
| OpenAPI codegen | Optional future step for full Dart client generation |
| Unwired DTOs | Auth, broadcasts, notifications, NW — still mock UI only |

---

## Governance going forward

1. **Enum changes** → update `packages/shared/src/enums.ts` first, then run `pnpm run test:mobile:contracts`
2. **New mobile API calls** → add endpoint to `contracts.ts`, Dart payload builder, API client method, and contract test
3. **Breaking DTO changes** → CI fails on `mobile-contract-test.cjs` or `mobile-contract.spec.ts`

TD-02 is resolved for all currently wired mobile↔API surfaces.
