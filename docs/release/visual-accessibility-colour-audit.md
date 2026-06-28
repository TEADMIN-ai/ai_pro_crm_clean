# Visual Accessibility & Colour Audit

Status date: 2026-06-28

Release status: RC blocker until browser-based manual review is complete.

## Scope Audited

- TEX global tokens in `src/app/globals.css`.
- TEX primitives in `src/components/tex/ExecutivePrimitives.tsx`.
- Shared UI primitives: Badge, Card, Table, ReturnButton.
- Dashboard navigation and shell.
- Major module surfaces identified by route scan: Contractor, Deals/Tender, Hygiene, Vehicle Finance/Roar, QS, Governance, Intelligence, Profile/Settings.

## Problems Identified

- Mixed design eras: newer TEX light tokens coexist with older dark translucent Tailwind classes.
- Low-opacity slate text appears in metadata, labels, table cells, and KPI cards.
- Navigation active/inactive states relied on cyan-on-dark styles and were not tokenized.
- Vehicle Finance and Governance pages contain many dark-on-dark card/table combinations that need manual contrast review.
- Disabled buttons often used opacity, which can make text disappear instead of signalling disabled state.
- Table headers relied on muted text without a stable header background.
- Badge tones used colour as the primary signal, with weak background/border contrast in some states.
- `vehicle-finance` module accent strong was light amber globally, which is unsafe on light surfaces.

## Shared Fixes Applied

- Strengthened TEX muted/subtle text tokens.
- Added purpose-driven action tokens for primary, secondary, destructive, and disabled controls.
- Added table header and row hover tokens.
- Added nav text, muted, active, hover, and active-border tokens.
- Updated TEX action buttons to keep disabled controls readable.
- Added destructive action styling hook.
- Updated shared table headers and row hover surfaces.
- Updated dashboard workspace navigation to use TEX nav classes instead of hard-coded cyan/slate state combinations.
- Corrected light-mode vehicle finance accent contrast while preserving amber contrast in dark vehicle finance shells.
- Extended sanity smoke checks to cover protected module routes and connector health.

## Problem Components Requiring Manual Browser Review

- `DashboardWorkspaceNav` and mobile nav.
- Contractor list/detail dark cards and compliance panels.
- Vehicle Finance executive dashboard, inventory, listings, application detail, and training pages.
- Governance dashboard cards, chips, workflow buttons, and route risk heatmap.
- Deals dashboard and deal detail intelligence panels.
- QS commercial intelligence, supplier intelligence, estimate detail, and BOQ pages.
- Hygiene driver mobile job pages and evidence/signature surfaces.
- Profile/settings pages using older white/slate overrides.

## Hierarchy Standard

Use colour and weight consistently:

- Primary heading: `--tex-text-strong`, largest local heading size.
- Section heading: `--tex-text-strong`, medium heading size.
- Sub heading: `--tex-text`, semibold.
- Body: `--tex-text`.
- Helper text: `--tex-text-muted`.
- Metadata: `--tex-text-muted`, uppercase only where useful, not below practical contrast.

Do not use `opacity-*` for essential text.

## Button Standard

- Primary: `tex-action-button`, high-contrast action colour, immediate visual priority.
- Secondary: `tex-action-button tex-action-button--secondary`, visible border and readable text.
- Destructive: `tex-action-button tex-action-button--danger`, unmistakable red tone.
- Disabled: use native `disabled`; do not rely only on opacity.

## Table Standard

- Header row must have a stable surface and high-contrast label.
- Body text must use `--tex-text`, not faint metadata colours.
- Hover state must not reduce contrast.
- Badges inside tables must be readable without relying on hue alone.

## Remaining Colour Risks

- Hard-coded Tailwind colours are still present in older pages; these need gradual conversion to TEX primitives.
- Some pages rely on image/gradient backgrounds; manual screenshot review is required.
- Governance and Vehicle Finance dark cards may pass in dark contexts but fail if inherited light tokens are changed.
- AI recommendation panels must be checked with real recommendation text lengths.

## Screens Requiring Manual Review Before RC Approval

- `/dashboard`
- `/dashboard/contractors`
- `/dashboard/contractors/[contractorId]`
- `/dashboard/deals`
- `/dashboard/deals/[dealId]`
- `/dashboard/qs`
- `/dashboard/qs/estimates/[estimateId]`
- `/dashboard/qs/suppliers`
- `/dashboard/qs/commercial-intelligence`
- `/dashboard/hygiene`
- `/dashboard/hygiene/jobs/[collectionId]`
- `/dashboard/vehicle-finance`
- `/dashboard/vehicle-finance/inventory`
- `/dashboard/vehicle-finance/inventory/[vehicleId]`
- `/dashboard/governance`
- `/dashboard/intelligence`

## RC Decision

The shared token fixes reduce systemic risk, but they are not a substitute for browser-based contrast testing. v1.0 RC cannot be approved until the screens above are manually reviewed and any High/Critical contrast defects are fixed.

