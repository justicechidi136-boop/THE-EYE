# Field Launcher QA

## Automated

```bash
cd apps/field-ops-tablet
flutter test test/field_launcher_test.dart
flutter analyze
```

```bash
cd apps/api
npm test -- --testPathPattern=field-launcher-policy
```

## Physical tablet matrix

| ID | Check |
| --- | --- |
| FL-001 | STANDARD_APP launches as normal app |
| FL-002 | Launcher build exposes HOME chooser entry |
| FL-003 | Launcher dashboard landscape 10" |
| FL-004 | Home/back returns to launcher dashboard |
| FL-005 | Approved Maps opens; unaapproved package blocked |
| FL-006 | Missing approved app shows friendly message |
| FL-007 | Role modules (patrol vs checkpoint vs supervisor) |
| FL-008 | Revoked/lost device shows lock screen only |
| FL-009 | Supervisor maintenance escape (staging) audited |
| FL-010 | Policy refresh updates tiles without reinstall |
| FL-011 | Offline cached policy boots launcher shell |
| FL-012 | Panic / backup / emergency call always visible |
| FL-013 | Portrait fallback readable |
| FL-014 | Dark theme contrast |
| FL-015 | Managed kiosk Lock Task (Device Owner lab only) |

**Do not mark PASS without physical tablet evidence.**
