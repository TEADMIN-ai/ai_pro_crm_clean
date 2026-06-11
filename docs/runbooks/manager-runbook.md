# Manager Runbook

## Daily Tasks

- Review contractor onboarding throughput.
- Create contractor users when required.
- Check email failures and manual recovery links.
- Review staff compliance decisions.
- Approve operational exceptions only with evidence.
- Confirm tender packs are generated for eligible deals.

## Workflow Diagram

```text
Manager review
  -> Check contractor pipeline
  -> Create or verify contractor user
  -> Confirm onboarding invitation
  -> Review compliance status
  -> Assign staff follow-up
  -> Approve tender generation readiness
```

## Troubleshooting

Cannot create contractor:

- Confirm manager role claim is active.
- Sign out and back in to refresh token claims.
- Check duplicate Firebase Auth email.

Email failed:

- Use the displayed onboarding link to contact contractor manually.
- Ask engineering to verify Resend logs and sender domain.

Compliance disagreement:

- Review source documents and audit trail.
- Do not override readiness calculations.
- Escalate unclear cases to Admin.

## Escalation Paths

- Role/claim issue: Admin or engineering.
- Contractor cannot access onboarding: engineering with contractor email and UID.
- Compliance exception: Admin and business owner.
- Production outage: engineering and deployment owner.
