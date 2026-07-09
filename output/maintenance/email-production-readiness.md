# Email Production Readiness Checklist

Date: 2026-07-09

## DNS Records Required

### MX

- Confirm Hostinger mail service is active for `torqueempire.net`.
- Add the Hostinger-provided MX records exactly as shown in Hostinger DNS.
- Confirm priority values match Hostinger guidance.
- Verify with DNS lookup after propagation.

### SPF

- Add or update the domain TXT SPF record.
- Include Hostinger mail sending servers.
- Include Resend sending include/record only after the Resend domain is verified.
- Keep only one SPF TXT record for the domain.

### DKIM

- Enable DKIM in Hostinger for `torqueempire.net`.
- Add Resend DKIM records if Resend will send production application email.
- Verify DKIM status in both Hostinger and Resend before enabling production send.

### DMARC

- Start with monitoring mode: `p=none`.
- Send reports to a monitored mailbox once available.
- Move to stricter policy only after SPF/DKIM alignment is verified.

## Hostinger Setup Checklist

- Confirm `torqueempire.net` is attached to the Hostinger account.
- Create required mailboxes before switching production sender configuration.
- Enable spam protection and DKIM.
- Confirm mailbox webmail access.
- Confirm SMTP/IMAP hostnames, ports, TLS mode, and authentication method.
- Document recovery contacts and administrator access.

## Mailbox Creation Checklist

- `info@torqueempire.net` - general enquiries.
- `chadwin@torqueempire.net` - director correspondence.
- `support@torqueempire.net` - operational support and application sender fallback.
- `accounts@torqueempire.net` - accounts and billing.
- `sales@torqueempire.net` - commercial enquiries.

## Resend / SMTP Verification Checklist

- Verify the `torqueempire.net` sender domain in Resend.
- Confirm `RESEND_API_KEY` is present only in production secret storage.
- Set `RESEND_FROM_EMAIL` to an approved sender such as `Torque Empire <support@torqueempire.net>`.
- Send a controlled contractor onboarding email to an internal mailbox.
- Send a controlled tender pack email to an internal mailbox.
- Submit a controlled vehicle finance notification path and confirm receipt.
- Confirm SPF, DKIM, and DMARC alignment in message headers.
- Confirm bounce and suppression handling in Resend.

## Testing Checklist

- Confirm public contact links open `info@torqueempire.net`.
- Confirm contractor onboarding logs `EMAIL_SEND_SUCCESS` for a controlled test recipient.
- Confirm tender pack send route skips safely when Resend is not configured.
- Confirm vehicle finance notification retry queue captures failure if Resend is unavailable.
- Confirm HTML signatures render in desktop and mobile mail clients.
- Confirm legal disclaimer is visible in signatures.
- Confirm reply-to behavior for customer-submitted vehicle finance applications.

## Rollback Plan

- Keep previous `RESEND_FROM_EMAIL` value documented before changing production secrets.
- If delivery fails, restore the previous sender value in Vercel/production environment.
- If DNS causes deliverability issues, revert only the affected DNS records to the last known good values.
- Disable live send by removing `RESEND_API_KEY` only if operationally approved.
- Use application logs and Resend event logs to identify failed deliveries before retrying.

## Launch Blockers

- Mailboxes are not assumed to exist.
- DNS is not configured by this repository change.
- Production telephone number confirmed: 069 502 4909.
- Production sender domain verification must be completed before go-live.
