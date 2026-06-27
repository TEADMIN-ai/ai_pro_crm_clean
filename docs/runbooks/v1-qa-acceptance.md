# v1.0 QA Acceptance Environment

This runbook creates controlled QA support data for the Torque Empire AI Pro CRM v1.0 acceptance pass.

The scripts are intentionally conservative:

- They only write deterministic records marked `qa: true`, `safeToDelete: true`, `qaNamespace: "v1"`, `environment`, `createdBy`, and `createdAt`.
- They refuse to overwrite or delete records that do not have the expected QA metadata.
- They do not delete real production records.
- Firebase Auth users are optional and require explicit password environment variables.
- Production seeding requires an additional explicit production allow flag.

## QA Accounts

The seed supports these roles:

| QA account | Role claim | Default email |
| --- | --- | --- |
| Admin QA | `admin` | `qa-v1-admin@qa.torqueempire.local` |
| Manager QA | `manager` | `qa-v1-manager@qa.torqueempire.local` |
| Staff QA | `staff` | `qa-v1-staff@qa.torqueempire.local` |
| Driver QA | `driver` | `qa-v1-driver@qa.torqueempire.local` |
| Contractor QA | `contractor` | `qa-v1-contractor@qa.torqueempire.local` |
| Roar Cars staff QA | `ROAR_CARS_STAFF` | `qa-v1-roar@qa.torqueempire.local` |

Set `TE_QA_EMAIL_DOMAIN` to use a real controlled email domain.

The script always creates or updates matching Firestore `users/{uid}` records. Firebase Auth users are only created when `TE_QA_CREATE_AUTH_USERS=true`.

## Seeded QA Records

The seed supports these acceptance fixtures:

| Area | Records |
| --- | --- |
| Contractor Management | `qa-v1-contractor-incomplete`, `qa-v1-contractor-verified`, required document subcollection records, CSD/CIDB records |
| Hygiene Operations | QA hygiene client, site, bin asset, scheduled collection, generated manifest, driver log |
| Driver App | Hygiene collection assigned to the QA driver UID when Auth user creation is enabled |
| Vehicle Finance | QA customer, finance application, assessment |
| Roar Cars | QA inventory vehicle using the existing inventory collection and placeholder image |
| QS Engine | QA material and quote-ready estimate |
| Supplier Intelligence | QA supplier profile and supplier offer |

## Seed QA Data

Firestore-only seed:

```powershell
$env:TE_QA_ENVIRONMENT="staging"
$env:TE_QA_SEED_CONFIRM="seed-v1-qa"
npm run qa:seed
```

Seed with Firebase Auth users:

```powershell
$env:TE_QA_ENVIRONMENT="staging"
$env:TE_QA_EMAIL_DOMAIN="qa.example.com"
$env:TE_QA_CREATE_AUTH_USERS="true"
$env:TE_QA_SEED_CONFIRM="seed-v1-qa"
$env:TE_QA_ADMIN_PASSWORD="<secure password>"
$env:TE_QA_MANAGER_PASSWORD="<secure password>"
$env:TE_QA_STAFF_PASSWORD="<secure password>"
$env:TE_QA_DRIVER_PASSWORD="<secure password>"
$env:TE_QA_CONTRACTOR_PASSWORD="<secure password>"
$env:TE_QA_ROAR_PASSWORD="<secure password>"
npm run qa:seed
```

Production requires the same confirmation plus:

```powershell
$env:TE_QA_ENVIRONMENT="production"
$env:TE_QA_ALLOW_PRODUCTION="true"
```

Use production seeding only for a controlled admin-approved QA pass.

## Cleanup QA Data

Firestore-only cleanup:

```powershell
$env:TE_QA_ENVIRONMENT="staging"
$env:TE_QA_SEED_CONFIRM="cleanup-v1-qa"
npm run qa:cleanup
```

Cleanup including Firebase Auth users:

```powershell
$env:TE_QA_ENVIRONMENT="staging"
$env:TE_QA_DELETE_AUTH_USERS="true"
$env:TE_QA_SEED_CONFIRM="cleanup-v1-qa"
npm run qa:cleanup
```

Auth user deletion is blocked unless the user has the expected QA custom claims.

## Acceptance Pass

After seeding:

1. Log in with each QA account.
2. Confirm role routing:
   - Admin, Manager, Staff: `/dashboard`
   - Driver: `/dashboard/hygiene/jobs`
   - Contractor: `/dashboard/contractor`
   - Roar Cars staff: `/dashboard/vehicle-finance`
3. Contractor Management:
   - Open `qa-v1-contractor-incomplete`; approval must be blocked with missing/review-required details.
   - Open `qa-v1-contractor-verified`; readiness should be 100% and approval should transition to `Approved / Compliant`.
4. Hygiene:
   - Open the QA collection and driver job.
   - Run assignment, manifest, evidence, signature, and completion checks.
5. Vehicle Finance / Roar Cars:
   - Open `qa-v1-vf-application`.
   - Open `qa-v1-roar-vehicle` from inventory.
6. QS / Supplier Intelligence:
   - Open `qa-v1-qs-estimate`.
   - Confirm supplier recommendations can use `qa-v1-supplier` and `qa-v1-supplier-offer`.

Run the release validation suite after seeding and again after any critical fix:

```powershell
npm run typecheck
npm run lint
npm test
npm run route:integrity
npm run build
npm run sanity
npx --no-install tsx src/lib/entityCheck.ts
```

## Playwright Credential Placeholders

Do not commit real credentials. For browser acceptance, pass credentials through environment variables or a secret store:

```powershell
$env:TE_QA_BASE_URL="https://<deployment-url>"
$env:TE_QA_ADMIN_EMAIL="qa-v1-admin@qa.example.com"
$env:TE_QA_ADMIN_PASSWORD="<secure password>"
$env:TE_QA_MANAGER_EMAIL="qa-v1-manager@qa.example.com"
$env:TE_QA_MANAGER_PASSWORD="<secure password>"
$env:TE_QA_STAFF_EMAIL="qa-v1-staff@qa.example.com"
$env:TE_QA_STAFF_PASSWORD="<secure password>"
$env:TE_QA_DRIVER_EMAIL="qa-v1-driver@qa.example.com"
$env:TE_QA_DRIVER_PASSWORD="<secure password>"
$env:TE_QA_CONTRACTOR_EMAIL="qa-v1-contractor@qa.example.com"
$env:TE_QA_CONTRACTOR_PASSWORD="<secure password>"
$env:TE_QA_ROAR_EMAIL="qa-v1-roar@qa.example.com"
$env:TE_QA_ROAR_PASSWORD="<secure password>"
```

Use `output/playwright/` for screenshots and traces.
