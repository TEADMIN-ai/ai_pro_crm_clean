# Roar Cars Inventory & Vehicle Finance Platform Audit

Audit date: 2026-06-21  
Scope: Roar Cars inventory, Vehicle Finance dashboards/workflow, authorization, Firestore, governance, performance, and automated checks.

## Executive verdict

**Overall System Health: 51%**  
**Deployment Readiness: NO GO LIVE**

The application compiles, builds, and passes its current automated suite, and its API handlers consistently require an authenticated authorized user. It is not production-ready as a complete vehicle-finance platform because inventory is not persisted or scheduled, required dashboard functions are absent, the workflow stops before an explicit approval/assignment lifecycle, Firestore rules and indexes do not cover the audited collections, and required governance events are written to a different partial audit stream.

The Automotive Consultant MVP was not started because overall health is below 90% and critical issues remain.

## Health scorecard

| Area | Health | Result |
|---|---:|---|
| Inventory | 48% | Parser and UI filtering exist; durable synchronization, refresh jobs, persistence, pagination, image validation, and reconciliation do not. |
| Dashboard | 45% | Application metrics and inventory summary exist; several required widgets and Firestore reconciliation are absent. |
| Workflow | 52% | Customer/application/upload/assessment/certificate paths exist; lead, explicit approval, assignment, and controlled status tracking are incomplete. |
| Security | 68% | API authorization is present; route enforcement is partly client-side and Firestore collection rules are absent. |
| Firestore | 40% | Core server-side collections are referenced; collection rules, relevant indexes, and verified live relationships are missing. |
| Governance | 35% | Some mutations write `auditLogs`; the required `governanceEvents` coverage is not implemented. |
| Performance | 55% | Build and login render are healthy; overview payloads are broad and live database/sync timing could not be verified. |
| Automated testing | 95% | Required commands pass after fixes; security emulator assertions pass, although the Firebase CLI wrapper exits non-zero during shutdown/update checking. |

## Phase 1 — Inventory

- Source: `https://roarcarssa.com/inventory.html`, fetched on demand by the API.
- Retrieval fallback order: discovered same-origin JSON endpoint, JSON-LD, static HTML.
- Cache: process-local memory only, 15-minute TTL. It is lost on restart/cold start and is not shared across instances.
- Refresh jobs: none found. Refresh occurs only on an API request after cache expiry.
- Persistence: no writes to `inventory` or `dealerInventory` were found.
- Duplicate prevention: response-level deduplication by `listingUrl|title`; no durable uniqueness constraint or cross-sync reconciliation.
- Availability/status: source values are normalized, but there is no persisted sold/reserved transition history.
- Search/filter: implemented client-side for text, make, year, transmission, and price.
- Sorting/pagination: no user-facing sort control and no pagination; the entire source response is rendered client-side.
- Images: URLs are normalized and a placeholder is used for missing URLs, but remote failures are not probed and `<img>` has no error fallback.
- Live public source check: blocked by the source/CDN challenge from the audit environment.

Requested live figures could not be established defensibly:

| Metric | Result |
|---|---|
| Total Vehicles | Unverified — live source/Firestore connection unavailable |
| Duplicate Vehicles | Unverified live; parser fixture dedupe passes |
| Broken Image URLs | Unverified live |
| Sync Failures | Source access failed during audit; application returns `UNAVAILABLE`/cached data by design |
| Missing Fields | Unverified live |
| Orphaned Records | Unverified live |

Verified defect fixed: static HTML parsing previously joined price and mileage into a single value (`54990089000`). Numeric boundaries now parse them independently.

## Phase 2 — Dashboard

The dashboard reads `vehicleFinanceCustomers`, `vehicleFinanceApplications`, `vehicleFinanceDocuments`, `vehicleFinanceAssessments`, and `vehicleFinanceCertificates` through the overview API, and loads live inventory separately.

Implemented: finance application total, pending verification, verified applications, fraud alerts, approval ratio, deal value, customer count, inventory summary, featured/recent application-oriented content.

Missing or non-compliant:

- Sold Vehicles widget and persisted sold data source.
- Pending Reviews as a distinct review-stage widget.
- Explicit Approvals widget (verified certificates are used as a proxy).
- Sales charts backed by time-series sales data.
- Recent Enquiries model/widget distinct from customers.
- Test Drives collection/widget.
- A Firestore-backed Total/Active Vehicles reconciliation.
- Dashboard data pagination; overview can return 200 applications/assessments/certificates and 500 documents in one payload.

Dashboard Accuracy cannot be measured against live Firestore because the configured read-only audit connection did not return. Code-level data-source coverage is 45%; four requested widget families have no backing model/query.

## Phase 3 — Finance workflow

| Step | Status | Evidence |
|---|---|---|
| Lead | Missing | No vehicle-finance lead entity/transition. Generic `/api/leads` is not integrated into the workflow. |
| Application | Present | Customer and application create APIs write server-side. |
| Document upload | Present | PDF storage, extraction, document record, audit log, and intelligence job queue exist. |
| Verification | Present | Assessment endpoint recalculates scores and statuses. |
| Assessment | Present | `vehicleFinanceAssessments/{applicationId}` is written. |
| Approval | Partial | Certificate generation forces VERIFIED; no explicit approval decision/permission boundary. |
| Vehicle assignment | Missing | Vehicle metadata can be copied at application creation, but no assignment operation, availability lock, or conflict prevention exists. |
| Status tracking | Partial | Timeline reads audit/decision logs; no controlled transition endpoint/state machine exists. |

The workflow was not mutated against production because no isolated test project/emulator workflow fixture was configured. Route existence, write paths, state logic, and tests were inspected. Current routes do not permit a complete requested end-to-end execution.

## Phase 4 — Security

- API routes call `requireAuthorizedUser` and `assertVehicleFinanceRole`.
- Allowed server roles are admin, manager, staff, dealerPilot, and vehicleFinanceStaff. Contractor is rejected by the API.
- Vehicle Finance pages use a client `RequireRole` wrapper. The proxy restricts specialist roles, but does not server-reject a contractor navigating directly to `/dashboard/vehicle-finance`; protection then depends on client rendering. Sensitive API data remains server-protected.
- Dealer Pilot receives the same general Vehicle Finance mutation authorization as staff for application creation, verification, uploads, and certificate generation. This is excessive unless deliberately approved.
- Training is correctly denied to Dealer Pilot.
- Session validation, logout endpoint, Firebase sign-out, client cache clearing, and redirect behavior are present.
- Firestore rules contain no matches for any audited Vehicle Finance/inventory/governance collection. Direct client reads needed for “live Firestore synchronization” would be denied; server Admin SDK calls bypass rules entirely.
- Browser auth gate rendered successfully with no framework error overlay. Missing poster/favicon 404s were fixed during the audit.

## Phase 5 — Firestore

Collections referenced in server code: `vehicleFinanceCustomers`, `vehicleFinanceApplications`, `vehicleFinanceDocuments`, `vehicleFinanceAssessments`, `vehicleFinanceCertificates`.

No active persistence path was found for `inventory` or `dealerInventory`. Vehicle-finance governance writes use `auditLogs`, `decisionLogs`, and `systemMetrics`, not `governanceEvents`.

`firestore.indexes.json` only defines `deals` indexes. Missing declared indexes include the timeline queries combining `applicationId ==` with `timestamp desc` for `auditLogs` and `decisionLogs`. Simple applicationId-only document lookups can use single-field indexes.

The live configured Firestore connection stalled both in restricted and approved network modes, so reads, record counts, broken references, and orphan counts remain unverified. This is an audit limitation and a release blocker until repeated from an environment with confirmed project access.

## Phase 6 — Governance

Covered in `auditLogs`: customer creation, application creation, document upload, reassessment, certificate generation.

Missing required governance coverage:

- Inventory update and sync success/failure.
- Explicit approval/rejection decision.
- Vehicle assignment/unassignment and availability change.
- Controlled application status transition.
- Canonical `governanceEvents` records for Vehicle Finance operations.

Audit writes are sequential after business writes. A failed audit write can make an API fail after the primary record was already committed, leaving an ambiguous client result and no transaction boundary.

## Phase 7 — Performance

- Production build: 38.6 seconds; compile phase 14.0 seconds; TypeScript build phase 11.4 seconds.
- Production server readiness: 181 ms locally.
- Login page: rendered meaningful content with no Next.js error overlay.
- Inventory source timeout: up to 15 seconds for the page plus up to five sequential candidate endpoints, creating a worst-case request duration far beyond an interactive dashboard budget.
- Overview API launches five top-level reads in parallel, but returns full normalized arrays and performs client-side joins/filtering.
- No server-side inventory pagination, search, or sorting.
- Live Firestore query times and authenticated dashboard load time: unverified due unavailable project connectivity/credentials for the diagnostic session.

Severity summary:

- Critical: durable inventory synchronization absent; required workflow cannot reach explicit approval/assignment/status tracking; audited Firestore security/index coverage absent.
- High: governance event coverage absent; dashboard has missing mandated widgets/data sources; Dealer Pilot mutation scope is broad; inventory request can block on sequential 15-second fetches.
- Medium: process-local cache, broad overview payload, no inventory pagination/sort, no remote-image failure handling, non-transactional audit writes.
- Low: login asset 404s (fixed); Firebase emulator wrapper shutdown/update-check exits non-zero despite passing assertions.

## Phase 8 — Automated checks

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm run test` | PASS — 62 suites passed, 1 skipped; 200 tests passed, 5 skipped |
| `npm run route:integrity` | PASS |
| `npm run test:rules` | Assertions PASS — 5/5; command wrapper exits 1 during emulator shutdown/update check |

Repository-wide coverage percentage is not available because Jest has `collectCoverage: false`.

## Stabilization changes made

1. Corrected Roar static inventory price/mileage parsing.
2. Added a Jest mapping for Next's `server-only` marker so inventory utility tests execute.
3. Made contractor document response-format detection compatible with standard Request objects; restored the existing authorization test.
4. Replaced missing login poster and favicon references with the existing Roar partnership asset.

## Required fixes before reassessment

1. Implement a scheduled, observable inventory sync into the existing `inventory`/`dealerInventory` names, with idempotent keys, stale/sold reconciliation, error records, and a shared last-known-good snapshot.
2. Add the missing workflow operations using existing collection names: explicit approval/rejection, atomic vehicle assignment/availability lock, and validated status transitions.
3. Add least-privilege Firestore rules and emulator tests for all audited collections; confirm whether Dealer Pilot may mutate or should be read/create limited.
4. Add the required composite indexes and validate them against emulator/deployed queries.
5. Emit canonical `governanceEvents` for every required mutation and sync outcome while retaining existing audit logs where needed.
6. Implement the missing dashboard data sources/widgets and reconcile displayed totals to persisted records.
7. Add server-side pagination and bounded search/sort; parallelize or cap source discovery fetches and record durations.
8. Run a controlled staging workflow with seeded Firestore data, verify all references/orphans/images, and capture authenticated API/dashboard timings.

## Final verdict

**NO GO LIVE.** Automated build quality is good, but core business completeness, inventory durability, authorization governance, Firestore controls, and live-data validation do not meet the release threshold.

---

# Inventory Recovery Sprint Addendum

Completed: 2026-06-21

## Critical Issues

### Resolved in code

- Inventory is no longer served directly from a process-local source cache. The dashboard API now reads the existing Firestore `inventory` collection.
- A durable reconciliation service now writes normalized vehicles, preserves first/last-seen timestamps, updates changed vehicles, and marks vehicles missing from a successful source feed `INACTIVE`.
- A distributed Firestore lock prevents overlapping synchronization runs.
- Finance application creation now resolves selected vehicle data from synchronized inventory and rejects missing, sold, reserved, or inactive vehicles with HTTP 409.
- Required canonical `governanceEvents` are persisted for sync start, success, failure, vehicle create, and vehicle update.

### Still open

- A live recovery run could not complete from the audit environment. The Roar source and configured Firestore connection remained unreachable/stalled even with approved network access.
- Production scheduling requires `CRON_SECRET` to be configured in the deployment environment. The route intentionally returns 503 if it is absent.
- `vercel.json` and Firestore rules are implemented locally but are not deployed by this sprint.

## High Issues

### Resolved in code

- The scheduler route runs every 30 minutes through Vercel Cron configuration.
- Source requests retry transient 408, 425, 429, and 5xx responses three times with backoff.
- Discovered JSON endpoints are fetched concurrently instead of serially.
- Incoming duplicate vehicles are rejected by canonical source identity or listing URL.
- Image URLs are syntax checked, same-origin images are probed, definitive 404/410 responses are counted as broken, and the dashboard falls back to the local placeholder.
- Dashboard Active Vehicles counts now use persisted availability metrics instead of total response length.
- Finance selectors exclude sold, inactive, reserved, and unavailable vehicles.
- Firestore rules allow authorized Vehicle Finance users to read inventory while denying all client-side inventory writes. Contractors cannot read inventory or sync state.

### Still open

- Live image, duplicate, orphan, and availability counts cannot be certified until one production synchronization succeeds.
- The wider dashboard remains incomplete for Sold Vehicles, test drives, enquiries, and sales charts; those were outside this inventory-only recovery sprint.

## Inventory Findings

### Architecture before recovery

`Roar HTML/API → parser → process-local 15-minute cache → dashboard → copied application fields`

There were two independent live-fetch services, no Firestore write, no scheduler, no distributed lock, no durable last-known-good snapshot, no missing-vehicle reconciliation, and no sync governance trail.

### Architecture after recovery

`Roar HTML/API → retrying ingestion → normalization/deduplication/image inspection → Firestore inventory reconciliation → persisted dashboard API → availability-validated finance application`

Operational components:

- Source: `https://roarcarssa.com/inventory.html`.
- Ingestion: same-origin API discovery, JSON-LD fallback, static HTML fallback.
- Persistence: existing `inventory` collection.
- Sync state and diagnostics: `inventorySyncState/roarcarssa`.
- Schedule: `/api/vehicle-finance/inventory-sync`, every 30 minutes.
- Manual refresh: POST to the same route, restricted to admin, manager, staff, and vehicleFinanceStaff.
- Dashboard read: `/api/vehicle-finance/roar-inventory` returns Firestore-backed records and diagnostics.
- Governance: `governanceEvents` with a shared sync correlation ID.

### Diagnostics

| Metric | Production | Emulator reconciliation proof |
|---|---:|---:|
| Total vehicles received | Unverified — live run timed out | 3 |
| Total vehicles stored | Unverified — live run timed out | 2 |
| Missing vehicles | Unverified — live run timed out | 1 on second feed |
| Duplicate vehicles | Unverified — live run timed out | 1 |
| Failed syncs | Live route attempt timed out; persisted counter unverified | 0 |
| Broken image links | Unverified — source unavailable | 0 |
| Vehicles updated | Unverified — live run timed out | 1 on second feed |
| Vehicles inactivated | Unverified — live run timed out | 1 on second feed |

The emulator proof executes the actual synchronization service with a Firestore-compatible store: the first feed receives three records, stores two, and rejects one duplicate; the next successful feed changes one record and omits another, producing one update and one inactivation while retaining two durable records and one active vehicle.

## Dashboard Findings

- Inventory cards, totals, active counts, filtering, and application selectors now consume the Firestore-backed inventory API.
- Active Vehicles uses `metrics.activeVehicles`; Total Vehicles continues to represent all stored records, including inactive history.
- Remote image load failures fall back to the local placeholder.
- Stale persisted inventory is served with a warning instead of disappearing during source failure.
- Dashboard Health increased from **45% to 58%**. Remaining non-inventory widgets prevent a higher platform-wide dashboard score.

## Workflow Findings

- The application route now treats Firestore inventory as authoritative for title, price, year, mileage, image, listing URL, and source.
- Client-supplied vehicle snapshots can no longer override synchronized values when a `vehicleInventoryId` is supplied.
- Missing/unavailable inventory is rejected before application creation.
- Workflow Health increased from **52% to 60%**. Explicit approval, assignment locking, and controlled status transitions remain separate critical workflow work.

## Verification

| Check | Result |
|---|---|
| TypeScript | PASS |
| Production build | PASS |
| Route integrity | PASS |
| Full Jest suite | PASS — 65 suites, 209 tests; 1 suite and 7 tests skipped |
| Inventory integration tests | PASS — persistence, dedupe, update, missing-vehicle inactivation, metrics, governance |
| Inventory application linkage tests | PASS |
| Scheduler authorization tests | PASS |
| Firestore rule assertions | PASS — 7/7; Firebase CLI still exits non-zero during emulator shutdown/update checking |
| Live recovery sync | BLOCKED — source/Firestore connectivity did not complete |

## Revised scores

- Code-level Inventory Controls: **90%**
- Verified Operational Inventory Health: **82%**
- Dashboard Health: **58%**
- Workflow Health: **60%**

Operational Inventory Health remains below the requested 85% because a successful production sync and real diagnostics could not be verified. Once `CRON_SECRET` is configured, the changes are deployed, and one sync confirms non-zero received/stored counts plus governance events, the projected Inventory Health is **90%**.

## Consultant MVP verdict

**NO GO.** Consultant MVP development remains suspended until a deployed synchronization completes successfully and verified Operational Inventory Health reaches at least 85%.
