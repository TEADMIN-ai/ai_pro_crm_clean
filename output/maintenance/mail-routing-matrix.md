# Torque Empire Mail Routing Matrix

Date: 2026-07-09

## Canonical Mailboxes

| Mailbox | Purpose | Used by | Priority | Future owner | Fallback behaviour |
| --- | --- | --- | --- | --- | --- |
| info@torqueempire.net | General corporate, website, government, supplier, and partnership enquiries | Public contact page, corporate footer, legacy tender/invoice email fallback, PDF brand block | High | Corporate administration | If a specific recipient is missing, general outbound builders fall back to this mailbox instead of placeholder recipient addresses. |
| chadwin@torqueempire.net | Director and executive stakeholder communication | Prepared in canonical profile and HTML director signature | High | Director | Not used as automated sender; should be used for direct executive correspondence after mailbox creation. |
| support@torqueempire.net | Operational support, platform assistance, contractor onboarding sender fallback, system notifications | Contractor onboarding, tender pack send route, vehicle finance sender fallback, hygiene fallback contact | Critical | Support desk / platform operations | If `RESEND_FROM_EMAIL` is not configured, live sender fallbacks use this mailbox identity through `getCorporateFromAddress("support")`. |
| accounts@torqueempire.net | Billing, supplier accounts, invoices, and payment administration | Prepared in canonical profile and accounts HTML signature | Medium | Finance / accounts administration | No automated billing sender is active yet; hold for future invoice workflows. |
| sales@torqueempire.net | Commercial discussions, service enquiries, and division-specific sales routing | Prepared in canonical profile and sales HTML signature | Medium | Sales / business development | Public enquiries currently route to info until sales mailbox ownership is confirmed. |

## Flow Routing

| Flow | Current route | Mailbox source | Notes |
| --- | --- | --- | --- |
| Contractor onboarding | Resend email to contractor | `getCorporateFromAddress("support")` fallback, or `RESEND_FROM_EMAIL` if configured | Uses Firebase password reset link generation before email dispatch. |
| Tender pack send | Resend email to provided recipient | `getCorporateFromAddress("support")` | Skips live send if Resend is not configured. |
| Vehicle finance application notification | Resend email to Roar Cars finance recipients | `getCorporateFromAddress("support")` fallback via notification config | Roar Cars recipient addresses remain dealership-specific config/fallbacks. |
| Public website contact | `mailto:` link | `getCorporateMailto("info")` | No contact form email send is active. |
| Corporate footer contact | `mailto:` link and displayed details | Canonical company profile | Telephone now resolves from the canonical company profile as `069 502 4909`. |
| Legacy invoice/tender email builders | Draft payload builders | `getCorporateEmail("info")` fallback recipient | Replaces `client@email.com` placeholder fallback. |
| Hygiene contact fallback | Data fallback only | `getCorporateEmail("support")` | Replaces `pending@example.com` placeholder fallback. |
| Password reset | Firebase Auth link generation | Recipient is the contractor/user email | Firebase sends/handles reset link flow; no Torque Empire mailbox sender configured in app code. |
| Manus notification workflow | Draft-only | No live mailbox | No live send; draft-only warning remains. |

## Non-production Placeholders Left Intentionally

The remaining `example.com`, `example.invalid`, `test@`, and `localhost` references are test fixtures, QA seed data, debug defaults, or cleanup heuristics. They are not production outbound mail routes.
