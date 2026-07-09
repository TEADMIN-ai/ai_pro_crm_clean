# Torque Empire Corporate Identity Integration Report

## Scope

This sprint prepared the application to use a single canonical corporate identity layer for Torque Empire public website and email presentation. No DNS configuration, email sending, deployment, commit, or push was performed.

## Canonical Profile

- Company: Torque Empire (Pty) Ltd
- Tagline: Four Divisions. One Vision. Total Excellence.
- Website: https://www.torqueempire.net
- Telephone: 069 502 4909
- Service area: South Africa
- Logo source: /corporate/logo/torque-empire-primary.png

## Prepared Email Addresses

- General enquiries: info@torqueempire.net
- Director: chadwin@torqueempire.net
- Support: support@torqueempire.net
- Accounts: accounts@torqueempire.net
- Sales: sales@torqueempire.net

## Source Locations Integrated

- Public website shell, footer, contact page, and CTA mail links
- Global metadata base and application description
- Contractor onboarding email sender fallback
- Tender pack send sender fallback
- Vehicle finance notification sender fallback
- Reusable email signature generator
- Reusable QR placeholder component

## Document Integration Targets

The following document families should later consume the canonical profile once the production domain, telephone number, and QR target are confirmed:

- Torque Empire corporate profile generator
- Commercial proposal and quotation packs
- Tender pack PDFs and SBD cover material
- Hygiene division commercial documents
- Technology services commercial documents
- Government-ready company profile exports
- Email templates for contractor onboarding, tender pack delivery, vehicle finance notifications, and support workflows

Generated commercial documents were not modified in this sprint.

## QR Code Status

The QR component is prepared as a reusable placeholder only. Final QR generation should wait until the production website domain and landing target are formally confirmed.

## Remaining Launch Tasks

- Confirm DNS and mailbox provisioning for torqueempire.net.
- Production telephone number confirmed: 069 502 4909.
- Confirm official social profile URLs.
- Confirm final QR landing target.
- Update generated commercial documents through their source generators, not by editing generated output manually.
- Verify Resend sender/domain configuration before enabling production email.
