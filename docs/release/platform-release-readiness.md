# Platform Release Readiness Inventory

Status date: 2026-06-28

Release posture: v1.0 RC preparation. QS Intelligence Engine Phase 3 Foundation is complete and feature-frozen except bug fixes, calibration, real supplier data population, performance improvements, UX polish, documentation, and acceptance testing.

## Module Inventory

| Module | Key routes | Key APIs | Firestore collections | Roles | Readiness | Blockers / risks | Coverage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Authentication & Role Routing | `/login`, `/dashboard`, `/portal/*` | `/api/auth/login`, `/api/auth/logout`, `/api/me`, `/api/sync-role`, `/api/auth/health` | `users`, Firebase Auth custom claims | admin, manager, staff, driver, contractor, ROAR_CARS_STAFF | RC candidate | Authenticated role walkthrough still required on deployed RC URL. | Unit tests for routing/auth fetch; sanity checks unauthenticated protection. |
| TEX Executive Experience | `/dashboard`, `/dashboard/executive`, `/dashboard/intelligence`, `/dashboard/governance` | `/api/dashboard/summary`, `/api/intelligence-center/*`, `/api/governance/*` | `governanceEvents`, `governanceCounters`, deals/contractor summaries | admin, manager, staff | Needs visual QA | Colour/accessibility audit is RC blocker until reviewed in browser. | Component/unit coverage partial. |
| Contractor Management | `/dashboard/contractors`, `/dashboard/contractors/[contractorId]`, `/dashboard/contractor` | `/api/contractors/*`, `/api/contractor-documents/*`, `/api/contractors/*/documents/*/download` | `contractors`, `contractors/{id}/documents`, `users`, `auditLogs` | admin, manager, staff, contractor | RC candidate | End-to-end document upload/download and approval checks required. | Strong service/authorization tests. |
| Procurement / Deals / Tender Pack | `/dashboard/deals`, `/dashboard/deals/[dealId]`, `/dashboard/tender-pack-requests` | `/api/deals/*`, `/api/tender-pack/*`, `/api/tender/*`, `/api/sbd4/generate` | `deals`, `dealDocuments`, `dealNotes`, `tenderPackRequests`, audit collections | admin, manager, staff, contractor limited | RC candidate | PDF generation and tender pack visual QA must be repeated on RC build. | PDF/unit coverage strong; E2E still manual. |
| Hygiene Operations | `/dashboard/hygiene/*`, driver job pages | `/api/hygiene/*` | hygiene clients, sites, assets, collections, manifests, evidence, driver logs | admin, manager, staff, driver | Needs acceptance pass | Driver mobile workflow needs device/browser QA. | Seed data exists; limited route smoke coverage. |
| Driver App | `/dashboard/hygiene/jobs`, `/dashboard/hygiene/jobs/[collectionId]` | `/api/hygiene/jobs`, evidence/signature routes through hygiene APIs | hygiene collections, evidence, manifests, driver logs | driver | Needs acceptance pass | Mobile layout, offline/poor network behaviour not certified. | QA seed supports driver role. |
| Vehicle Finance / Roar Cars | `/dashboard/vehicle-finance/*` | `/api/vehicle-finance/*` | `vehicleFinanceCustomers`, `vehicleFinanceApplications`, `vehicleFinanceDocuments`, `vehicleFinanceAssessments`, `inventory` | admin, manager, staff, ROAR_CARS_STAFF | RC candidate | Authenticated Roar Cars Staff workflow and document verification must pass. | Service and authorization tests present. |
| Roar Cars Inventory Connector | `/dashboard/vehicle-finance/inventory`, `/dashboard/vehicle-finance/listings`, `/dashboard/vehicle-finance/inventory/[vehicleId]` | `/api/vehicle-finance/roar-inventory`, `/api/vehicle-finance/inventory-sync`, `/api/vehicle-finance/inventory/connector/*` | `inventory`, `inventorySyncState`, `vehicleFinanceConnectors`, `vehicleInventorySyncRuns`, `vehicleInventoryHealth` | admin, manager, staff, ROAR_CARS_STAFF | Foundation complete | Vercel Connect token handoff not yet configured; live source reliability must be monitored. | Connector tests and durable sync tests present. |
| QS Engine | `/dashboard/qs/*` | `/api/qs/estimates`, `/api/qs/boq/*`, `/api/qs/material-price-observations` | `qsEstimates`, `qsBoqDocuments`, `qsMaterials`, import audit collections | admin, manager, staff | Phase 3 foundation complete, feature freeze | Needs real supplier/material data and authenticated acceptance calibration. | QS service tests present. |
| Supplier Intelligence | `/dashboard/qs/suppliers`, `/dashboard/qs/materials/suppliers` | `/api/qs/suppliers`, `/api/qs/supplier-offers`, `/api/qs/supplier-performance-ratings`, `/api/qs/supplier-decision-flags` | `qsSuppliers`, `qsSupplierOffers`, `qsSupplierPerformanceRatings`, `qsSupplierDecisionFlags` | admin, manager, staff | Foundation complete | Data quality and decision flag governance must be reviewed before GA. | Supplier intelligence tests present. |
| Commercial Impact Engine | `/dashboard/qs/commercial-intelligence`, estimate detail routes | `/api/qs/commercial-intelligence/summary`, `/api/qs/estimates/*/commercial-impact`, `/api/qs/commercial-feedback` | `qsCommercialFeedback`, `qsCommercialIntelligenceSnapshots`, estimate collections | admin, manager, staff | Foundation complete | Dashboard outputs depend on available data; no fake forecasting allowed. | Commercial intelligence tests present. |
| QA Seed Environment | Docs/runbook only | `npm run qa:seed`, `npm run qa:cleanup` | QA-labelled records across modules | QA role accounts | Ready for staging use | Production use requires explicit approval flag; credentials must come from secret store. | Script has safeguards; acceptance still manual. |
| System Health / Smoke Checks | Build/sanity scripts | `/api/auth/health`, `/api/health/firebase`, protected API probes | None beyond health reads | release manager/admin | Improved in this sprint | Smoke checks are non-mutating and unauthenticated; they do not replace authenticated E2E. | `npm run sanity`, route integrity, entity check. |

## v1.0 RC Checklist

- [ ] Authenticated role QA completed for admin, manager, staff, driver, contractor, ROAR_CARS_STAFF.
- [ ] End-to-end module QA completed for contractor, deals/tender pack, hygiene, vehicle finance, Roar inventory, QS.
- [ ] Data integrity checks completed against QA seed records.
- [ ] Permission checks completed for protected routes and mutation APIs.
- [ ] Firestore rule checks completed with emulator or staging project.
- [ ] Document upload/download checks completed for contractor and vehicle finance documents.
- [ ] PDF generation checks completed for tender packs and SBD documents.
- [ ] Connector health checks completed for Roar inventory connector.
- [ ] Mobile/responsive checks completed on at least one Android-sized viewport and one desktop viewport.
- [ ] Accessibility checks completed, including contrast, keyboard focus, labels, and navigation state visibility.
- [ ] Performance checks completed for dashboard, contractor list/detail, inventory, QS recommendations, and hygiene jobs.
- [ ] Backup/recovery process verified.
- [ ] Support readiness complete: escalation contacts, known issues, and troubleshooting runbook.
- [ ] Training readiness complete: admin/staff/contractor/driver/Roar/QS guides.
- [ ] Documentation readiness complete: release notes, rollback notes, QA evidence links.

RC cannot be marked approved until all authenticated acceptance tests have evidence.

## Bug Triage Framework

| Severity | Definition | Examples | Release action |
| --- | --- | --- | --- |
| Critical | Prevents core business operation, causes data loss, bypasses authorization, exposes sensitive data, or blocks login for a required role. | Contractor approval impossible; production data overwritten; private document downloadable by wrong role; finance applications disappear. | RC/GA blocker. Fix immediately and rerun full validation plus targeted E2E. |
| High | Major workflow broken or materially misleading, but no confirmed data loss/security bypass. | QS recommendation API fails; inventory sync cannot retry; tender pack PDF unusable; driver cannot complete assigned job. | RC blocker unless explicitly accepted with mitigation. |
| Medium | Workflow still possible but degraded, confusing, slow, or requires workaround. | Empty state unclear; table filtering inconsistent; non-critical dashboard metric stale; slow supplier comparison. | Fix before GA where practical; document known issue if deferred. |
| Low | Cosmetic or minor friction that does not alter decisions or block work. | Spacing inconsistency, minor label wording, icon alignment, non-critical visual polish. | Backlog unless it affects accessibility or trust. |

Accessibility note: low contrast text, unreadable badges, invisible focus states, or ambiguous disabled controls are at least High and may be Critical if they block a role workflow.

## Smoke Check Review

Existing sanity checks validate Firebase env/admin init, typecheck, Jest suite, route integrity, production build, and a small set of unauthenticated smoke probes.

This sprint extends smoke probes to include:

- Auth health and Firebase health.
- Contractor route/API protection.
- Vehicle Finance route protection.
- QS route/API protection.
- Hygiene route/API protection.
- Inventory connector health protection.
- Document API protection where route patterns exist.

These checks intentionally do not authenticate or mutate data. Authenticated smoke/E2E should be run through the QA acceptance plan.

## QA Seed Workflow Review

The QA seed workflow is release-friendly:

- QA records are labelled with `qa: true`, `safeToDelete: true`, `qaNamespace: "v1"`, environment, createdBy, createdAt.
- Cleanup refuses to delete records without expected QA metadata.
- Production seeding requires `TE_QA_ALLOW_PRODUCTION=true`.
- Auth user creation/deletion is explicit and guarded by password/env flags.
- Supported roles include admin, manager, staff, driver, contractor, and ROAR_CARS_STAFF.
- No secrets are committed; passwords are environment-only.

Gap: acceptance evidence capture is manual. Add a future Playwright authenticated flow only after credential handling is finalized.

## Performance / Query Risks

- Contractor readiness: list/detail pages may recompute or read document subcollections heavily as records scale.
- Dashboard summaries: executive and governance dashboards aggregate across several collections; watch cold-start and large-collection scans.
- Inventory sync: external source fetch, image checks, and Firestore reconciliation can be slow or source-dependent.
- QS supplier recommendations: scoring can become expensive with large supplier/offer datasets; pagination and indexed queries will matter.
- Hygiene jobs/evidence: image/evidence-heavy workflows need storage latency monitoring.
- PDF generation: tender pack and SBD generation can be CPU/memory heavy under concurrent use.

Do not rewrite these paths during RC unless validation identifies a confirmed blocker.

## UX Polish Backlog

Priority 0, release blocker:

- Complete visual accessibility and colour audit across major modules.
- Confirm nav active/inactive/hover/focus states in browser.
- Confirm badges, buttons, tables, KPI cards, AI panels, forms, placeholders, and breadcrumbs meet practical WCAG AA contrast.

Priority 1:

- Standardize remaining hard-coded Tailwind colour usage through TEX primitives.
- Improve empty/loading/error states on legacy pages.
- Verify all detail pages have clear return navigation.
- Add system health strips where users need operational confidence.

Priority 2:

- Reduce excessive gradients/transparency.
- Tune mobile spacing and dense dashboard tables.
- Normalize AI recommendation explanation layout and confidence badges.

