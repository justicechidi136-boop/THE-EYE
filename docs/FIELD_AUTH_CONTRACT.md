# Field Authentication Contract

**Project:** THE EYE — Phase 7 Sprint 1  
**JWT type:** `typ: "field"`

---

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/field/auth/login` | Device-bound officer login |
| POST | `/v1/field/auth/refresh` | Rotate access token |
| POST | `/v1/field/auth/logout` | End session |
| POST | `/v1/field/auth/lock` | Inactivity / remote lock |
| POST | `/v1/field/auth/unlock` | PIN/biometric re-entry (session preserved) |
| GET | `/v1/field/auth/session` | Session introspection |

---

## Login validation

Server validates:

- Officer account active
- Field-eligible admin role
- Device `Active`, not lost/revoked/suspended
- Device signature on challenge
- `tokenVersion` match
- Package name / environment
- Assigned user match (when pre-assigned)

---

## Access token claims

```json
{
  "typ": "field",
  "sub": "<adminUserId>",
  "fieldDeviceId": "<uuid>",
  "fieldRole": "PatrolOfficer",
  "agencyId": "<uuid>",
  "country": "NG",
  "state": "LA",
  "lga": "Ikeja",
  "assignedUnitId": "<uuid|null>",
  "sessionId": "<uuid>",
  "tokenVersion": 1,
  "authMode": "field_tablet"
}
```

---

## Refresh rules

- Bound to `publicDeviceId` + refresh token hash
- Rejected if device lost/revoked or `tokenVersion` mismatch
- Rejected if session revoked (`revokedAt` set)

---

## Officer Locale Preferences

Field Ops officers use the existing admin/officer preferences source:

- Storage: `AdminUserPreference.preferredLocale`
- Write contract: `PATCH /v1/admin/preferences` with `{ "preferredLocale": "ha" }`
- Read contract: `GET /v1/admin/preferences`
- Propagation: login, refresh, and session introspection return `preferredLocale` and `effectivePreferredLocale`

`/v1/users/me` is citizen-scoped and is not a Field Ops officer locale write contract.

---

## Session lock

- Configurable inactivity threshold (client policy)
- Lock preserves refresh token; unlock requires local PIN/biometric abstraction
- Remote force sign-out revokes server session

---

## Error codes

See `docs/FIELD_ROLE_PERMISSION_MATRIX.md` for FIELD-DEVICE-* and FIELD-AUTH-* codes.

---

## Implementation

- `apps/api/src/modules/field-operations/field-auth.service.ts`
- `apps/api/src/common/auth/resolve-auth-user.ts`
- `apps/field-ops-tablet/lib/auth/field_auth_service.dart`
