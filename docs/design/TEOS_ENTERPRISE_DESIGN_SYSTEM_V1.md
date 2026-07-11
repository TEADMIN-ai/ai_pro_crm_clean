# TEOS Enterprise Design System v1.0

**Document Owner:** UX and Design Systems, Torque Empire (Pty) Ltd
**Author:** Codex Engineering Office
**Status:** Implementation Foundation
**Version:** 1.0.0
**Revision:** 2026-07-09
**Applies To:** Admin Dashboard, Hygiene Dashboard, Procurement, Vehicle Finance, Contractor Portal, Driver App, QS Engine

## 1. Purpose
TEOS Enterprise Design System v1.0 defines the shared visual language for every operational workspace. It is a foundation for future component consolidation only. It does not change business logic, routing, workspace permissions, or current page layouts.

The system prioritizes:

- Clear operational hierarchy.
- Dense but readable enterprise workflows.
- Consistent status language across workspaces.
- WCAG 2.1 AA contrast.
- Reusable design tokens before broad UI refactors.

## 2. Dashboard Audit Summary
The current dashboard surface uses several visual dialects that should converge over time.

| Workspace | Current Patterns Observed | Standardisation Need |
| --- | --- | --- |
| Admin Dashboard | Enterprise classes, KPI summaries, role and user administration patterns. | Align metric cards, table density, badge tones, and action buttons to shared tokens. |
| Hygiene Dashboard | Light operational pages plus high-contrast mobile driver workflow. | Preserve field usability while aligning status colours, step indicators, and panel spacing. |
| Procurement | QS/materials procurement workflows use dark panels, tables, supplier badges, and import states. | Normalize table styling, filters, badges, and procurement KPI cards. |
| Vehicle Finance | Midnight workspace shell, finance KPIs, workflow progress, Roar Cars branded inventory surfaces. | Keep workspace brand context but standardize core cards, statuses, buttons, forms, and tables. |
| Contractor Portal | Contractor cards, compliance summaries, onboarding forms, document upload states. | Standardize compliance cards, document status badges, form fields, and invite/action buttons. |
| Driver App | Mobile-first hygiene workflow with large controls, offline and queue states. | Use mobile-specific token sizes while sharing semantic colours and status language. |
| QS Engine | Dark intelligence panels, BOQ, estimates, materials, suppliers, and commercial impact tables. | Consolidate `tex-*` and Tailwind utility patterns into reusable table, panel, badge, and KPI standards. |

## 3. Design Tokens
Token names should be stable and semantic. Product code may map these values into CSS variables, Tailwind theme extensions, or exported TypeScript constants.

### 3.1 Colour Palette
| Token | Hex | Usage | Contrast Guidance |
| --- | --- | --- | --- |
| `primary.600` | `#0B63CE` | Primary actions, active navigation, focused enterprise controls. | Use white text. |
| `primary.700` | `#084C9E` | Primary hover/pressed states. | Use white text. |
| `secondary.600` | `#0F766E` | Secondary business actions and operational highlights. | Use white text. |
| `secondary.700` | `#115E59` | Secondary hover/pressed states. | Use white text. |
| `success.600` | `#15803D` | Completed, approved, valid, synced. | Use white text for fills or `success.700` text on `success.50`. |
| `warning.600` | `#B45309` | Pending, attention, partial completion. | Use on light warning surfaces. Avoid white text on amber fills below 700. |
| `danger.600` | `#DC2626` | Error, rejected, destructive action. | Use white text for fills or `danger.700` text on `danger.50`. |
| `info.600` | `#0369A1` | Informational state, in progress, generated insights. | Use white text for fills or `info.700` text on `info.50`. |
| `neutral.950` | `#020617` | Highest emphasis text and dark shells. | Use with light text in dark workspaces. |
| `neutral.900` | `#0F172A` | Page title text, primary body text. | Primary text on light backgrounds. |
| `neutral.700` | `#334155` | Body text and secondary labels. | Body text on white/light surfaces. |
| `neutral.500` | `#64748B` | Captions, helper text, metadata. | Do not use below 12px for critical content. |
| `neutral.200` | `#E2E8F0` | Borders and separators. | Non-text only. |
| `neutral.100` | `#F1F5F9` | Subtle panels and table headers. | Pair with `neutral.900` or `neutral.700`. |
| `neutral.50` | `#F8FAFC` | App backgrounds. | Pair with `neutral.900`. |
| `surface.white` | `#FFFFFF` | Cards, tables, modals, forms. | Pair with `neutral.900` and `neutral.700`. |

### 3.2 Semantic Status Colours
| Status | Surface | Border | Text | Dot |
| --- | --- | --- | --- | --- |
| Success | `#DCFCE7` | `#86EFAC` | `#166534` | `#16A34A` |
| Warning | `#FEF3C7` | `#FCD34D` | `#92400E` | `#D97706` |
| Danger | `#FEE2E2` | `#FCA5A5` | `#991B1B` | `#DC2626` |
| Info | `#E0F2FE` | `#7DD3FC` | `#075985` | `#0284C7` |
| Neutral | `#F1F5F9` | `#CBD5E1` | `#334155` | `#64748B` |

Dark workspace equivalents should keep the same semantic hue but use low-opacity fills and high-contrast text, for example `bg-sky-400/10`, `border-sky-400/25`, `text-sky-100`.

## 4. Typography Scale
Use the system sans-serif stack already established by TEOS. Typography must remain stable across workspaces and should not scale with viewport width.

| Role | Size | Line Height | Weight | Usage |
| --- | --- | --- | --- | --- |
| Page title | 28px | 36px | 700 | Workspace and primary page headings. |
| Page subtitle | 15px | 24px | 400 | Context below page titles. |
| Section heading | 18px | 28px | 650 | Card, panel, and table group headings. |
| Subsection heading | 15px | 22px | 650 | Compact panel headings. |
| KPI label | 12px | 16px | 700 | Uppercase or high-emphasis metric labels. Letter spacing max `0.08em`. |
| KPI value | 30px | 36px | 750 | Primary dashboard metrics. Use tabular numerals where possible. |
| Body text | 14px | 22px | 400 | Operational copy, table cells, form helper text. |
| Body strong | 14px | 22px | 600 | Row titles, card labels, important metadata. |
| Caption text | 12px | 16px | 500 | IDs, timestamps, low-emphasis metadata. |
| Button label | 14px | 20px | 650 | Standard buttons. |

Mobile driver surfaces may use 16px body text and 44px minimum touch targets for field reliability.

## 5. Spacing System
Use a 4px base scale.

| Token | Value | Usage |
| --- | --- | --- |
| `space.1` | 4px | Icon gaps, compact inline metadata. |
| `space.2` | 8px | Badge padding, dense table controls. |
| `space.3` | 12px | Form field gaps, compact card rows. |
| `space.4` | 16px | Card padding minimum, panel gaps. |
| `space.5` | 20px | Default card and panel padding. |
| `space.6` | 24px | Page section gaps, table wrappers. |
| `space.8` | 32px | Major page groups. |

Component spacing standards:

| Component | Standard |
| --- | --- |
| Cards | 20px padding desktop, 16px mobile, 16px internal gap. |
| Panels | 24px padding for full panels; 16px for nested operational panels. |
| Buttons | 12px horizontal, 8px vertical for compact; 16px horizontal, 10px vertical for standard. |
| Forms | 8px label-to-input gap, 16px field gap, 24px group gap. |
| Tables | 12px vertical cell padding, 16px horizontal cell padding, 44px minimum row height. |

## 6. Radius And Shadow
| Token | Value | Usage |
| --- | --- | --- |
| `radius.sm` | 6px | Inputs, badges, table controls. |
| `radius.md` | 8px | Buttons, compact cards, filters. |
| `radius.lg` | 12px | Standard cards and panels. |
| `radius.xl` | 16px | Mobile workflow cards and major panels only. |
| `radius.full` | 999px | Pills, status dots, avatars. |

Avoid adding new `rounded-2xl` and `rounded-3xl` usage unless a mobile touch workflow or established shell already requires it. The enterprise default card radius is 12px.

| Shadow | Value | Usage |
| --- | --- | --- |
| `shadow.sm` | `0 1px 2px rgba(15, 23, 42, 0.06)` | Tables, flat cards. |
| `shadow.md` | `0 8px 24px rgba(15, 23, 42, 0.08)` | Standard dashboard cards. |
| `shadow.lg` | `0 18px 48px rgba(15, 23, 42, 0.10)` | Modals, high-priority panels. |
| `shadow.focus` | `0 0 0 4px rgba(11, 99, 206, 0.18)` | Keyboard and active control focus. |

## 7. Dashboard Standards
Dashboard pages should use consistent hierarchy without changing route structure:

- Page header: title, short subtitle, optional workspace actions.
- KPI row: 3 to 5 metrics per row on desktop, 1 to 2 per row on mobile.
- Primary work area: tables, kanban, workflow panels, or intelligence panels.
- Secondary rail or follow-up panels only when the workflow needs it.
- Empty, loading, and error states must use the same panel structure as loaded states.

Workspace-specific brand treatments are allowed only in outer shells and hero/header areas. Cards, tables, buttons, forms, status badges, and KPI patterns should share the enterprise system.

## 8. KPI Card Specification
KPI cards should be reusable across Admin, Hygiene, Procurement, Vehicle Finance, Contractor Portal, Driver App, and QS Engine.

| Element | Standard |
| --- | --- |
| Container | `surface.white`, `neutral.200` border, `radius.lg`, `shadow.sm`, 20px padding. |
| Label | KPI label typography, `neutral.500`, max two lines. |
| Value | KPI value typography, `neutral.950`, tabular numerals. |
| Delta | 12px caption with success/warning/danger semantic tone and icon/text label. |
| Detail | Optional 12px caption below value. |
| Loading | Skeleton blocks matching label/value dimensions. |
| Error | Inline caption in danger tone; preserve card height. |

Dark workspace variant: use `neutral.950` surface, `white/10` border, `neutral.100` value, and semantic low-opacity deltas.

## 9. Button Specification
Buttons must use semantic variants rather than local one-off colour classes.

| Variant | Usage | Surface | Text | Border |
| --- | --- | --- | --- | --- |
| Primary | Main page action, submit, continue. | `primary.600` | White | `primary.600` |
| Secondary | Alternative action, secondary submit. | `secondary.600` | White | `secondary.600` |
| Tertiary | Low-emphasis action. | White | `neutral.700` | `neutral.200` |
| Ghost | Toolbar/navigation action. | Transparent | `neutral.700` | Transparent |
| Danger | Destructive action. | `danger.600` | White | `danger.600` |
| Warning | Risk acknowledgement. | `warning.600` or warning surface | White or `warning.700` | `warning.600` |
| Disabled | Unavailable action. | `neutral.200` | `neutral.500` | `neutral.200` |

Button requirements:

- Minimum height 40px desktop, 44px mobile.
- Radius `radius.md`.
- Visible focus state using `shadow.focus` or equivalent ring.
- Loading state must preserve width and label context.
- Do not rely on colour alone for destructive or disabled states.

## 10. Badge And Status Indicator Specification
Status badges should include text and optional dot/icon. Use status words consistently.

| Status Family | Canonical Labels |
| --- | --- |
| Success | Completed, Approved, Valid, Synced, Active |
| Warning | Pending, Queued, Partial, Needs Review |
| Danger | Rejected, Failed, Blocked, Critical, Missing |
| Info | In Progress, Generated, Submitted, Assigned |
| Neutral | Draft, Not Started, Archived, Unknown |

Badge standard:

- Container: inline-flex, `radius.full`, 2px/10px padding, 12px text.
- Border: semantic border.
- Surface: semantic light surface or dark low-opacity surface.
- Text: semantic text token with AA contrast.
- Dot: 8px, semantic dot colour, never the only signal.

## 11. Form Specification
Forms must be readable, keyboard navigable, and consistent across onboarding, document upload, finance applications, hygiene jobs, QS imports, and administration.

| Element | Standard |
| --- | --- |
| Label | 14px, 600, `neutral.700`; required fields use text plus `aria-required`. |
| Input | 40px min height desktop, 44px mobile, 12px horizontal padding, `radius.md`, `neutral.200` border. |
| Helper text | 12px, `neutral.500`, below input. |
| Error text | 12px, `danger.600`, paired with `aria-describedby`. |
| Focus | `primary.600` border plus focus ring. |
| Disabled | `neutral.100` surface and `neutral.500` text. |
| Validation | Icon/text messaging; never colour only. |

File upload and signature controls must expose current state, accepted file types, upload progress, and retry/failure feedback.

## 12. Table Specification
Tables should be scan-friendly and consistent across deals, contractors, documents, vehicle finance, materials, suppliers, BOQ, and users.

| Element | Standard |
| --- | --- |
| Wrapper | `surface.white`, border `neutral.200`, `radius.lg`, horizontal overflow on small screens. |
| Header | `neutral.100`, 12px uppercase or title case labels, 600 weight. |
| Cell | 14px body text, 12px vertical and 16px horizontal padding. |
| Row | 44px minimum height, `neutral.100` divider. |
| Hover | `primary.50` or dark equivalent for interactive rows. |
| Numeric cells | Right align where comparison matters; use tabular numerals. |
| Empty state | Full-width row with neutral caption and next action when available. |
| Actions | Right aligned, icon or concise text, accessible label required. |

Tables must preserve column headings for screen readers and avoid div-only table replacements unless the content is not tabular.

## 13. Navigation Specification
Navigation must clarify workspace context and access without changing routes.

- Primary shell navigation: stable order, active state using primary or workspace accent.
- Workspace identity: show current workspace/module without replacing page title.
- Section tabs: use segmented or tab treatment, 40px minimum height.
- Mobile navigation: preserve touch targets at 44px minimum and keep labels visible for core workflows.
- Active state must include more than colour: border, weight, indicator, or `aria-current`.
- Navigation labels should be nouns or concise workflow destinations.

## 14. Accessibility Guidance
TEOS workspaces must meet WCAG 2.1 AA.

- Text contrast: at least 4.5:1 for normal text and 3:1 for large text.
- UI components and graphical objects: at least 3:1 against adjacent colours.
- Focus indicators: visible on every interactive element.
- Status: include text or icon in addition to colour.
- Touch targets: 44px minimum in mobile and field workflows.
- Motion: avoid non-essential motion; respect reduced motion preferences.
- Tables: keep semantic `<table>`, `<thead>`, `<tbody>`, `<th>`, and scope where applicable.
- Forms: labels must be programmatically associated with inputs.
- Loading states: use `role="status"` for meaningful async updates.
- Error states: give the user a clear next action and associate errors with fields.

High-priority contrast checks:

- Amber and yellow text on light surfaces can fail AA; use `warning.700` or darker.
- Slate/grey captions below 12px should be avoided.
- Cyan/sky text on dark backgrounds should use lighter text tokens such as `sky.100` or `cyan.100`.
- White text on `warning.500` may fail; use `warning.700` fill or dark warning text on a light warning surface.

## 15. Reusable Components To Share Eventually
The following components should be consolidated or promoted as shared primitives in future implementation phases:

| Component | Purpose |
| --- | --- |
| `EnterprisePageHeader` | Standard page title, subtitle, workspace actions, and breadcrumbs. |
| `EnterpriseKpiCard` | Shared KPI card with label, value, delta, detail, loading, and error states. |
| `EnterpriseKpiGrid` | Responsive KPI layout for 3 to 5 metrics. |
| `EnterprisePanel` | Standard card/panel wrapper with optional heading and actions. |
| `EnterpriseButton` | Primary, secondary, tertiary, ghost, danger, warning, disabled, loading variants. |
| `EnterpriseBadge` | Semantic badge and status dot system. |
| `EnterpriseTable` | Accessible table wrapper with density, empty, loading, and action cell states. |
| `EnterpriseFormField` | Label, helper, error, required state, and focus handling. |
| `EnterpriseTabs` | Workspace section navigation and segmented views. |
| `EnterpriseEmptyState` | Consistent no-data, blocked, and permission-aware states. |
| `EnterpriseProgress` | Workflow progress bars, step timelines, and status summaries. |
| `MobileWorkflowAction` | Driver and field workflow actions with 44px minimum touch targets. |

## 16. Implementation Rules
Future implementation should follow these rules:

1. Introduce tokens before replacing page-specific markup.
2. Migrate one shared component family at a time.
3. Preserve all current routes, auth checks, API contracts, and business logic.
4. Keep workspace-specific visual identity at the shell or header level.
5. Replace hard-coded hex values and one-off status classes with semantic tokens.
6. Verify each migrated component with typecheck, build, and visual review.

## 17. Cross References
- [TEOS Master Engineering Charter](../architecture/TEOS_MASTER_ENGINEERING_CHARTER.md)
- [TEOS UI Design System](../engineering/UI_DESIGN_SYSTEM.md)
- [Multi-Workspace Architecture](../architecture/MULTI_WORKSPACE_ARCHITECTURE.md)
