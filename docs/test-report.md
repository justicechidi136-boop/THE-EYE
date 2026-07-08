# THE EYE Test Report

Generated: 2026-07-06T22:11:06

| Check | Status | Exit | Seconds |
| --- | --- | ---: | ---: |
| Install dependencies | PASS | 0 | 1.63 |
| Lint | PASS | 0 | 12.96 |
| TypeScript checks | PASS | 0 | 11.34 |
| Backend tests | PASS | 0 | 6.71 |
| Mobile smoke tests | PASS | 0 | 2.06 |
| Backend API build | PASS | 0 | 20.66 |
| Admin dashboard build | PASS | 0 | 60.37 |
| Admin build smoke | PASS | 0 | 1.59 |
| Docker Compose config | FAIL | 1 | 4.07 |
| Docker Compose startup | FAIL | 1 | 0.14 |
| Docker Compose smoke | PASS | 0 | 1.58 |

## Install dependencies

Status: PASS

```text
Scope: all 4 workspace projects
Already up to date
Done in 1.2s using pnpm v11.7.0
```

## Lint

Status: PASS

```text
pnpm : $ pnpm -r run lint
At line:1 char:1
+ pnpm run lint 2>&1
+ ~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ($ pnpm -r run lint:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
Scope: 3 of 4 workspace projects
packages/shared lint$ tsc -p tsconfig.json --noEmit
packages/shared lint: Done
apps/admin-web lint$ tsc -p tsconfig.json --noEmit
apps/api lint$ tsc -p tsconfig.json --noEmit
apps/admin-web lint: Done
apps/api lint: Done
```

## TypeScript checks

Status: PASS

```text
Scope: 3 of 4 workspace projects
packages/shared lint$ tsc -p tsconfig.json --noEmit
packages/shared lint: Done
apps/admin-web lint$ tsc -p tsconfig.json --noEmit
apps/api lint$ tsc -p tsconfig.json --noEmit
apps/admin-web lint: Done
apps/api lint: Done
```

## Backend tests

Status: PASS

```text
pnpm : $ pnpm --filter @the-eye/api run test
At line:1 char:1
+ pnpm run test:backend 2>&1
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ($ pnpm --filter @the-eye/api run test:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
$ tsx src/test-runner.ts
PASS allows requests when all required permissions are present
PASS rejects requests missing a required permission
PASS allows open routes without permission metadata
PASS creates a tamper-evident hash chain
PASS reports a broken chain
PASS accepts valid emergency GPS updates
PASS rejects invalid GPS updates
PASS hides reporter identity for anonymous incidents in admin overlay
PASS blocks unauthorized admins from live location
PASS creates audit log when authorized admin opens signed live location
PASS creates a signed LiveKit access token with room grants
PASS joins a public community immediately
PASS approves a pending member and audits the moderator action
PASS creates a post and targets community notifications
PASS verifies a post with moderator confirmation
PASS converts a community post to an incident
PASS broadcasts a verified community alert
PASS blocks non-moderators from approving members
PASS creates a targeted notification through the API controller
PASS lists unread notifications for the actor
PASS creates location-targeted push and in-app notifications
PASS marks a notification read for the current actor
PASS parses a nearest station query with safe limits
PASS rejects invalid coordinates
PASS requires a provider and device id for pairing
PASS rejects invalid GPS coordinates
PASS requires a 3 second SOS long press and a supported emergency mode
PASS creates a P1 incident and SOS event from standalone smartwatch SOS
PASS fails over from paired mode to standalone when the phone is lost
PASS issues a standalone device login token when certificate and secret are valid
PASS scores high-confidence P1 incidents for immediate escalation
PASS requests crowd confirmation for uncertain incidents
PASS penalizes historical false report behavior
PASS records verification score and auto-escalates high-confidence P1 incidents
PASS requests nearby crowd confirmation for uncertain incidents
PASS keeps migration directories ordered and populated
PASS enables required geospatial, audit, notification, and smartwatch migrations
37/37 tests passed
```

## Mobile smoke tests

Status: PASS

```text
pnpm : $ node scripts/mobile-smoke-test.cjs
At line:1 char:1
+ pnpm run test:mobile:smoke 2>&1
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ($ node scripts/mobile-smoke-test.cjs:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
Mobile smoke test passed.
```

## Backend API build

Status: PASS

```text
pnpm : $ prisma generate && nest build
At line:1 char:1
+ pnpm --filter @the-eye/api run build 2>&1
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ($ prisma generate && nest build:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to 
a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config

Prisma schema loaded from prisma\schema.prisma

✔ Generated Prisma Client (v6.19.3) to .\..\..\node_modules\.pnpm\@prisma+client@6.19.3_prism_1d040ab5215f59f0e27ddee7f0cf082e\node_modules\@prisma\client in 981ms

Start by importing your Prisma Client (See: https://pris.ly/d/importing-client)

Tip: Need your database queries to be 1000x faster? Accelerate offers you that and more: https://pris.ly/tip-2-accelerate
```

## Admin dashboard build

Status: PASS

```text
pnpm : $ next build
At line:1 char:1
+ pnpm --filter @the-eye/admin-web run build 2>&1
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ($ next build:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
   ▲ Next.js 15.5.20

   Creating an optimized production build ...
 ✓ Compiled successfully in 8.6s
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/32) ...
   Generating static pages (8/32) 
   Generating static pages (16/32) 
   Generating static pages (24/32) 
 ✓ Generating static pages (32/32)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size  First Load JS
┌ ○ /                                      178 B         105 kB
├ ○ /_not-found                            987 B         103 kB
├ ○ /agencies                              217 B         106 kB
├ ○ /analytics                             217 B         106 kB
├ ○ /audit                                 217 B         106 kB
├ ○ /broadcasts                            217 B         106 kB
├ ○ /emergency                             178 B         105 kB
├ ○ /incidents                             178 B         105 kB
├ ƒ /incidents/[id]                        178 B         105 kB
├ ○ /jurisdictions                         217 B         106 kB
├ ○ /live-video                          3.89 kB         109 kB
├ ○ /login                                 217 B         106 kB
├ ○ /missing-persons                       178 B         105 kB
├ ○ /neighborhood-watch                    178 B         105 kB
├ ƒ /neighborhood-watch/[id]               217 B         106 kB
├ ○ /neighborhood-watch/analytics          217 B         106 kB
├ ○ /neighborhood-watch/approvals          217 B         106 kB
├ ○ /neighborhood-watch/map                217 B         106 kB
├ ○ /neighborhood-watch/patrols            217 B         106 kB
├ ○ /neighborhood-watch/posts              217 B         106 kB
├ ○ /neighborhood-watch/verification       217 B         106 kB
├ ○ /neighborhood-watch/volunteers         217 B         106 kB
├ ○ /notifications                         217 B         106 kB
├ ○ /police-stations                       217 B         106 kB
├ ○ /smartwatch                            217 B         106 kB
├ ƒ /smartwatch/[id]                       217 B         106 kB
├ ○ /smartwatch/firmware                   217 B         106 kB
├ ○ /smartwatch/health                     217 B         106 kB
├ ○ /smartwatch/live-tracking              217 B         106 kB
├ ○ /sos-monitor                           217 B         106 kB
├ ○ /stolen-vehicles                       178 B         105 kB
├ ○ /users                                 217 B         106 kB
└ ○ /verification                          217 B         106 kB
+ First Load JS shared by all             102 kB
  ├ chunks/558-239c31f73a257451.js       45.7 kB
  ├ chunks/567e3fde-8c71b67cb98676f3.js  54.2 kB
  └ other shared chunks (total)          1.99 kB


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

## Admin build smoke

Status: PASS

```text
pnpm : $ node scripts/admin-build-smoke.cjs
At line:1 char:1
+ pnpm run test:admin:smoke 2>&1
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ($ node scripts/admin-build-smoke.cjs:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
Admin build smoke passed.
```

## Docker Compose config

Status: FAIL

```text
Invoke-Expression : The term 'docker' is not recognized as the name of a cmdlet, function, script file, or operable 
program. Check the spelling of the name, or if a path was included, verify that the path is correct and try again.
At C:\Users\USER\Documents\the eye 2\scripts\verify-all.ps1:19 char:15
+     $output = Invoke-Expression "$Command 2>&1" | Out-String
+               ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : ObjectNotFound: (docker:String) [Invoke-Expression], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException,Microsoft.PowerShell.Commands.InvokeExpressionCommand
```

## Docker Compose startup

Status: FAIL

```text
Invoke-Expression : The term 'docker' is not recognized as the name of a cmdlet, function, script file, or operable 
program. Check the spelling of the name, or if a path was included, verify that the path is correct and try again.
At C:\Users\USER\Documents\the eye 2\scripts\verify-all.ps1:19 char:15
+     $output = Invoke-Expression "$Command 2>&1" | Out-String
+               ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : ObjectNotFound: (docker:String) [Invoke-Expression], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException,Microsoft.PowerShell.Commands.InvokeExpressionCommand
```

## Docker Compose smoke

Status: PASS

```text
pnpm : $ node scripts/docker-compose-smoke.cjs
At line:1 char:1
+ pnpm run test:docker:smoke 2>&1
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: ($ node scripts/docker-compose-smoke.cjs:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
Docker Compose smoke passed.
```

