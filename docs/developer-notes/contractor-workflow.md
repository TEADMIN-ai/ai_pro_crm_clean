# Contractor Workflow

Date: 2026-06-11

## Contractor Onboarding Lifecycle

```text
Admin/Manager creates contractor
  -> POST /api/contractors
  -> Firebase Auth user created
  -> Firebase password reset onboarding link generated
  -> contractors/{uid} created
  -> users/{uid} created
  -> contractor role custom claims assigned
  -> contractor auth linkage verified
  -> onboarding link persisted
  -> Resend onboarding email attempted
  -> creation response returned
```

Required response flags:

- `contractorCreated`
- `onboardingLinkGenerated`
- `emailSent`

Failure handling:

- If email dispatch fails, contractor creation still succeeds.
- The onboarding link is returned as `passwordResetLink`.
- Admin/Manager UI shows the onboarding link for manual recovery.
- Email status fields are persisted to the contractor record when possible.

## Staff Review Workflow

```text
Contractor uploads documents
  -> document metadata stored
  -> document execution or analysis runs
  -> compliance data updated
  -> staff reviews extracted status
  -> staff approves, rejects, or requests re-upload
  -> audit/compliance trail is retained
```

Staff should verify:

- Document type is correct.
- Extracted fields match the uploaded document.
- Expiry dates are valid.
- Document status matches the real review outcome.

## Compliance Approval Workflow

```text
Required documents complete
  -> compliance recalculation
  -> staff/manager review
  -> approve contractor compliance
  -> complianceApproved = true
  -> contractor becomes eligible for tender pack generation when readiness is READY
```

Approval must only occur after source documents are reviewed. This sprint does not modify approval logic.

## Tender Generation Workflow

```text
Deal linked to contractor
  -> staff/manager requests tender pack
  -> route recalculates compliance
  -> readiness gate evaluates score, missing docs, expired docs, lock status, approval
  -> pack generation blocked or proceeds
  -> PDF sections rendered and merged
  -> tender pack metadata returned/stored
```

Operational rule:

- If generation is blocked, resolve compliance gaps rather than bypassing readiness checks.

## Validation Checklist

- Create contractor as Admin.
- Create contractor as Manager.
- Confirm Firebase Auth user exists.
- Confirm `users/{uid}` exists with `role: contractor`.
- Confirm `contractors/{uid}` exists with `authUid`, `userId`, and `contractorId`.
- Confirm custom claims include `role: contractor` and `contractorId`.
- Confirm onboarding email sent or manual recovery link surfaced.
- Confirm contractor can set password and log in.
