# Torque Empire Email Production Audit

Date: 2026-07-09

## Executive Summary

The corporate email system is now prepared around the canonical Torque Empire company profile. Production-facing sender fallbacks and visible corporate contact surfaces now reference the central helper instead of temporary placeholders. No DNS changes, email sends, deployments, commits, or pushes were performed.

Production readiness score: 86/100

The remaining readiness work is external setup: create Hostinger mailboxes, configure DNS, verify Resend sender/domain records, and perform live mailbox receipt testing.

## Files Audited

- `src/lib/corporate/companyProfile.ts`
- `src/lib/email/corporateSignatures.ts`
- `src/lib/email/contractorOnboardingEmail.ts`
- `src/app/api/tender-pack/send/route.ts`
- `src/lib/vehicle-finance/config/notificationRecipients.ts`
- `src/lib/vehicle-finance/notifications/vehicleFinanceApplicationNotification.ts`
- `src/server/email.js`
- `src/components/pdf/Brand.jsx`
- `src/lib/hygiene/hygieneService.ts`
- `src/components/corporate/CorporateSite.tsx`
- `src/app/layout.tsx`
- `src/app/api/tender/email/route.ts`
- `src/app/api/contractors/route.ts`
- `src/app/api/vehicle-finance/applications/route.ts`
- `src/lib/manus/tools/emailTool.ts`
- `src/lib/manus/agents/notificationAgent.ts`
- `scripts/generateGovernmentEngagementPack.mjs`
- `scripts/generateTechnologyServicesQuotationTEQ073.mjs`
- `scripts/generateRoarCarsProfessionalTechnicalServicesInvoice.mjs`
- `scripts/qaAcceptanceSeed.ts`
- `src/__tests__/*` email-related fixtures

## Files Modified

- `src/server/email.js`
- `src/components/pdf/Brand.jsx`
- `src/lib/hygiene/hygieneService.ts`
- Prior identity wiring already present in:
  - `src/lib/email/contractorOnboardingEmail.ts`
  - `src/app/api/tender-pack/send/route.ts`
  - `src/lib/vehicle-finance/config/notificationRecipients.ts`
  - `src/components/corporate/CorporateSite.tsx`
  - `src/app/layout.tsx`

## Email Flows Discovered

| Flow | Live send? | Provider / mechanism | Status |
| --- | --- | --- | --- |
| Contractor onboarding | Yes, when configured | Resend | Uses canonical support sender fallback. |
| Tender pack delivery | Yes, when configured | Resend | Uses canonical support sender. |
| Vehicle finance application notification | Yes, when configured | Resend | Uses notification config and canonical support sender fallback. |
| Contractor password reset onboarding link | Indirect | Firebase Auth link generation | Recipient is contractor email; no app sender configured. |
| Public website contact | No direct send | `mailto:` | Uses canonical info mailbox. |
| Legacy invoice/tender email builders | Draft payload only | Internal builder | Placeholder fallback replaced with canonical info mailbox. |
| Hygiene contact fallback | No direct send | Data fallback | Placeholder fallback replaced with canonical support mailbox. |
| Manus notification workflow | No | Draft-only tool | No live mailbox routing. |
| `/api/tender/email` | No confirmed send | Readiness/preview response | Still reports readiness rather than SMTP/Resend delivery. |
| Roar Cars notifications | Yes for finance application path | Resend | Recipients remain dealership-specific configuration. |

## Issues Found

- `client@email.com` was used as a legacy fallback recipient in server email builders.
- `info@torqueempire.com` remained in the PDF brand component.
- `pending@example.com` was used as a hygiene contact fallback.
- Generated document scripts still contain `admin@torqueempire.net`; these are document generator references, not active outbound email sends.
- QA seed, test fixture, debug, and cleanup scripts intentionally retain placeholder domains for non-production data.
- `RESEND_FROM_EMAIL` and DNS/mailbox setup still require production environment configuration.

## Signature Audit

| Requirement | Result | Evidence |
| --- | --- | --- |
| Logo | Pass | Signatures reference canonical company website plus logo path. |
| Website | Pass | Uses canonical `https://www.torqueempire.net`. |
| Tagline | Pass | Uses canonical company profile tagline. |
| Legal disclaimer | Pass | Included in every generated signature. |
| Reply address | Pass | Role-specific mailbox per signature. |
| Colour consistency | Pass | Uses navy/blue/slate corporate styling. |
| Mobile responsiveness | Pass | Uses table-based email layout with max width and inline styles. |

## Placeholder Address Audit

Production-facing placeholders replaced:

- `client@email.com`
- `info@torqueempire.com`
- `pending@example.com`

Remaining placeholders are intentionally non-production:

- QA seed data under `scripts/qaAcceptanceSeed.ts`
- Jest fixtures under `src/__tests__`
- Debug default under `src/app/api/auth/debug/route.ts`
- Cleanup heuristic under `scripts/maintenance/productionDataCleanup.ts`
- Supplier sample CSV under `src/lib/qs/import/seeds`

## Remaining Manual Work

- Create Hostinger mailboxes.
- Configure MX, SPF, DKIM, and DMARC records.
- Verify Resend domain and sender identity.
- Set production `RESEND_FROM_EMAIL`.
- Execute controlled live send tests.
- Update generated commercial/government document scripts to consume a script-safe corporate identity helper in a later document sprint.
- Confirm production telephone number and social profile URLs.
