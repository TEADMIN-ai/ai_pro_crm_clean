# Admin Runbook

## Daily Tasks

- Confirm production login works.
- Review contractor creation failures and onboarding email failures.
- Check audit logs for unexpected authorization or workflow events.
- Review governance alerts and unresolved risk items.
- Confirm Vercel production deployment status after releases.

## Workflow Diagram

```text
Start day
  -> Login as Admin
  -> Check dashboard health
  -> Review contractors and compliance exceptions
  -> Review audit logs and governance alerts
  -> Resolve or assign issues
  -> End-of-day evidence capture
```

## Troubleshooting

Authentication failure:

- Check Firebase public env vars and Admin env vars point to the same project.
- Check `/api/health/firebase` and `/api/auth/health`.
- Review `/api/auth/login` and `/api/me` logs.

Contractor creation failure:

- Confirm user has admin or manager role.
- Check Firebase Auth for duplicate email.
- Check Firestore write permission and Admin SDK health.

Onboarding email failure:

- Search logs for `EMAIL_SEND_FAILURE`.
- Confirm `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.
- Use surfaced onboarding link for manual recovery.

## Escalation Paths

- Authentication/Admin SDK issue: engineering owner.
- Email deliverability issue: engineering owner plus Resend/domain administrator.
- Data correction issue: engineering owner with Admin approval.
- Security incident: freeze deployments, preserve logs, rotate affected credentials, and escalate to business owner.
