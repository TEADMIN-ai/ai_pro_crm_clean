# v1.0 Acceptance Test Plan

This plan is evidence-based. A test passes only when the tester records role, environment, deployment URL, date/time, data used, and screenshots or trace notes where practical.

## Admin

Objective: confirm platform administration, contractor oversight, user visibility, and executive dashboards.

Prerequisites: seeded admin QA user, QA contractor records, QA deals, QA QS estimate, QA vehicle finance records.

Steps:

1. Log in as Admin.
2. Confirm `/dashboard` loads and role routing is correct.
3. Open Contractors, view incomplete and verified QA contractors.
4. Attempt approval on incomplete contractor; expect block with clear reasons.
5. Approve verified contractor if test environment permits mutation.
6. Open Deals and Tender Pack Requests.
7. Open QS dashboard, estimate detail, supplier intelligence, and commercial intelligence.
8. Open Vehicle Finance and Roar inventory.
9. Open Hygiene dashboards.
10. Open Governance/Intelligence pages.

Expected result: all admin routes load, protected data is visible, blocked actions explain why, and no unauthorized or raw-source data is exposed.

Pass/fail: fail is Critical if admin cannot log in or access core modules; High if a major module cannot load.

## Manager

Objective: confirm operational management without admin-only privileges.

Prerequisites: seeded manager QA user and QA records.

Steps:

1. Log in as Manager.
2. Confirm dashboard routing.
3. Review contractors and documents.
4. Review deals, tender readiness, and tender pack generation path.
5. Review QS estimates and suppliers.
6. Review hygiene operations and vehicle finance workspace.

Expected result: manager can supervise workflows but cannot access admin-only operations.

Pass/fail: Critical for permission bypass; High for blocked core workflow.

## Staff

Objective: confirm day-to-day CRM, procurement, document, QS, and vehicle finance workflows.

Prerequisites: seeded staff QA user.

Steps:

1. Log in as Staff.
2. Open deals and contractor records available to staff.
3. Upload or review allowed document workflow in staging.
4. Open QS estimate and supplier recommendation workflow.
5. Open vehicle finance application and Roar inventory.
6. Confirm unauthorized admin-only paths are denied or hidden.

Expected result: staff can perform assigned workflows and cannot access admin-only controls.

Pass/fail: Critical for permission bypass; High for workflow blocker.

## Driver

Objective: confirm mobile hygiene job execution path.

Prerequisites: seeded driver QA user and assigned hygiene collection.

Steps:

1. Log in as Driver on mobile-sized viewport.
2. Confirm routing to hygiene jobs.
3. Open assigned QA job.
4. Review job details, collection steps, manifest/evidence/signature surfaces.
5. Confirm non-driver modules are not available.

Expected result: driver sees assigned work clearly on mobile and cannot access unrelated modules.

Pass/fail: Critical if driver cannot log in or sees unauthorized data; High if assigned job is unusable.

## Contractor

Objective: confirm contractor portal, compliance status, and document visibility.

Prerequisites: seeded contractor QA user linked to verified contractor.

Steps:

1. Log in as Contractor.
2. Confirm contractor landing route.
3. Review compliance status and document checklist.
4. Verify contractor cannot access admin/staff contractor list or other contractors.
5. Download/view allowed own document links where staging supports it.

Expected result: contractor sees only own profile/documents and receives clear compliance guidance.

Pass/fail: Critical for cross-contractor data exposure; High for blocked contractor portal.

## Roar Cars Staff

Objective: confirm vehicle finance and inventory operations for Roar Cars staff.

Prerequisites: seeded ROAR_CARS_STAFF QA user, QA inventory vehicle, QA vehicle finance application.

Steps:

1. Log in as Roar Cars Staff.
2. Confirm routing to Vehicle Finance.
3. Open inventory, listings, and the QA vehicle detail page.
4. Confirm View Vehicle opens internal detail route.
5. Confirm external listing is secondary.
6. Review connector health display.
7. Confirm unauthorized non-Roar modules are denied or hidden.

Expected result: Roar Cars staff can view inventory and finance workflows without raw connector payloads.

Pass/fail: Critical for authorization/data exposure; High for inventory/detail route failure.

