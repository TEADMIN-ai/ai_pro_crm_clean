# Production Data Integrity Report

Generated: 2026-07-07T13:59:24.075Z

## Executive Summary

- Source report: `output/maintenance/production-data-cleanup-report.json`
- Collections scanned: 23
- Records found: 655
- Records recommended for deletion: 10
- Manual review records: 17
- Broken references: 166
- Storage inconsistencies: 4
- Duplicate groups: 1
- Deletion performed: No

## Production Readiness Score

- Data Integrity Score: 74/100
- Reference Health Score: 75/100
- Storage Health Score: 95/100
- Production Readiness Score: 71/100
- QA Contamination Score: 96/100

## Integrity Classification

| Category |Issue Count |
| --- | --- |
| Users | 163 |
| Contractors | 0 |
| Applications | 3 |
| Documents | 0 |
| Notifications | 0 |
| Audit Logs | 0 |
| Storage | 4 |
| Workflow Records | 0 |
| Tender Records | 0 |
| Vehicle Finance | 0 |
| Other | 0 |

## Broken Reference Breakdown

### Applications

Records affected: 3

| Collection |Field |Missing Target |Records |Severity |Likely Cause |Repair |
| --- | --- | --- | --- | --- | --- | --- |
| vehicleFinanceApplications | vehicleId | inventory/140fdfcc3f4147c3aba6739585ba7644 | 2 | Medium | Legacy or test data uses a reference shape that no longer resolves to a canonical document. | Manual review required before cleanup. |
| vehicleFinanceApplications | vehicleId | inventory/BMW 320d M Sport | 1 | Medium | Legacy or test data uses a reference shape that no longer resolves to a canonical document. | Manual review required before cleanup. |

### Users

Records affected: 163

| Collection |Field |Missing Target |Records |Severity |Likely Cause |Repair |
| --- | --- | --- | --- | --- | --- | --- |
| users | contractorId | contractors/Gn5fIDMVQLRRR9wXRjavs0UvtSh1 | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| users | contractorId | contractors/HqabSqyhqDdYmvHch6RO6mWwJGK2 | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| users | contractorId | contractors/dLZ8CElXeoWDJSIidaDULKoejHr1 | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| users | contractorId | contractors/z0yX8cyt38hkfa60UEyNTOiX2812 | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | authUid | users/CzEqgwRTDmT6u2XEtSJ20BVKR8B2 | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | userId | users/CzEqgwRTDmT6u2XEtSJ20BVKR8B2 | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | authUid | users/GqsT6LCH6wyIas8Meb8c | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | authUid | users/KLGcJzb3ZEGf2rNpHNVg | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | authUid | users/ND4HCW4KdEmXLGTDKMfF | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | authUid | users/a1CxFTpi5AatIkGXUXOkh50F1h93 | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | userId | users/a1CxFTpi5AatIkGXUXOkh50F1h93 | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | authUid | users/b2qz6m1aW2NNzVLjQg8K | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | authUid | users/jxjgsfgHW0ouOJc2ZHYW | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | authUid | users/l2czruUhWdKiS4HJ9rft | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | authUid | users/lkImwod6FgYrklknDS5T | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | authUid | users/m1EwzLOO115tWim5baab | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | authUid | users/pdinEHoFvUWuMG5O1MCl9gGdzfz2 | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | userId | users/pdinEHoFvUWuMG5O1MCl9gGdzfz2 | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | authUid | users/qZTJeNRRviDlHFXq3cmF | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | authUid | users/sYEU6aqqiEV4Gvu6eTBSmovlJa12 | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | userId | users/sYEU6aqqiEV4Gvu6eTBSmovlJa12 | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | authUid | users/vOwPwNDdKwhvJLS9dl33AQ3bIBk1 | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | userId | users/vOwPwNDdKwhvJLS9dl33AQ3bIBk1 | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | authUid | users/vW511XxAZNSDe9BwTyFYeOjM04S2 | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| contractors | userId | users/vW511XxAZNSDe9BwTyFYeOjM04S2 | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| tenderPackRequests | requestedBy | users/vOwPwNDdKwhvJLS9dl33AQ3bIBk1 | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| auditLogs | userId | users/system | 116 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| auditLogs | userId | users/ekUvq3lC7HUEwICe5rcCQBWovSF3 | 3 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| auditLogs | userId | users/mIvgcVQzo4gdFyNHNIMn1SLElCp1 | 7 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| auditLogs | userId | users/weafIuxbamYoEoJaSytAvumVxK62 | 5 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| auditLogs | userId | users/0WhoPx5Y3wMWQ8Xn26CqDCueFnj2 | 5 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |
| auditLogs | userId | users/vOwPwNDdKwhvJLS9dl33AQ3bIBk1 | 1 | High | A record still points at a Firebase/user UID that is not present in users/ or was seeded outside the canonical user lifecycle. | Repair only if this is a real account; delete only approved QA users and dependent QA records together. |

## Manual Review Breakdown

| Document ID |Collection |Reason |Likely Real |Likely QA |Likely Duplicate |Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| 72YwD2xe3US1nuQIZ8b073QvgCd2 | users | matched /\bqa\b/i; matched /@qa\./i; matched /qa-v\d+/i; explicit test/mock/sample flag | No | Yes | No | REPAIR |
| CzEqgwRTDmT6u2XEtSJ20BVKR8B2 | contractors | matched /\btest\b/i | No | Yes | No | REPAIR |
| GqsT6LCH6wyIas8Meb8c | contractors | matched /\btest\b/i | No | Yes | Yes | REPAIR |
| KLGcJzb3ZEGf2rNpHNVg | contractors | matched /\btest\b/i | No | Yes | Yes | REPAIR |
| ND4HCW4KdEmXLGTDKMfF | contractors | matched /example\.com/i | Yes | No | No | KEEP |
| a1CxFTpi5AatIkGXUXOkh50F1h93 | contractors | matched /\bqa\b/i; matched /example\.com/i | No | Yes | No | REPAIR |
| b2qz6m1aW2NNzVLjQg8K | contractors | matched /example\.com/i | Yes | No | No | KEEP |
| jxjgsfgHW0ouOJc2ZHYW | contractors | matched /\btest\b/i | No | Yes | Yes | REPAIR |
| lkImwod6FgYrklknDS5T | contractors | matched /\btest\b/i | No | Yes | Yes | REPAIR |
| m1EwzLOO115tWim5baab | contractors | matched /\btest\b/i | No | Yes | Yes | REPAIR |
| qZTJeNRRviDlHFXq3cmF | contractors | matched /\btest\b/i | No | Yes | Yes | REPAIR |
| qa-v1-contractor-verified | contractors | matched /\bqa\b/i; matched /@qa\./i; matched /qa-v\d+/i; explicit test/mock/sample flag | No | Yes | No | REPAIR |
| sYEU6aqqiEV4Gvu6eTBSmovlJa12 | contractors | matched /example\.com/i | Yes | No | No | KEEP |
| vW511XxAZNSDe9BwTyFYeOjM04S2 | contractors | matched /\btest\b/i | No | Yes | Yes | REPAIR |
| 9f6pkwHdf2ZURxyRyf8i | deals | matched /\bqa\b/i | No | Yes | No | REPAIR |
| qa-v1-vf-application | vehicleFinanceApplications | matched /\bqa\b/i; matched /qa-v\d+/i; explicit test/mock/sample flag | No | Yes | No | REPAIR |
| qa-v1-vf-application | vehicleFinanceAssessments | matched /\bqa\b/i; matched /qa-v\d+/i; explicit test/mock/sample flag | No | Yes | No | REPAIR |

## Storage Analysis

| Storage Path |Firestore Reference |Exists |Referenced |Recommended Action |
| --- | --- | --- | --- | --- |
| https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf | documents/smoke-check | unknown | Yes | Manually verify external/URL storage reference; do not delete Firestore record until the storage owner and retention requirement are confirmed. |
| http://roarcarssa.com/uploads/4e713ce84f96421cb0b2144f9af759a8.jpeg | inventory/3af5debda40edb54942fdeb31463e6bfca91e322 | unknown | Yes | Manually verify external/URL storage reference; do not delete Firestore record until the storage owner and retention requirement are confirmed. |
| http://roarcarssa.com/uploads/f2f0dddb0e3440848bdfc377f69e1496.jpeg | inventory/910e3cffe3519e68fd8e5fa80101f34b01461f83 | unknown | Yes | Manually verify external/URL storage reference; do not delete Firestore record until the storage owner and retention requirement are confirmed. |
| images/roar-cars-placeholder.svg | inventory/qa-v1-roar-vehicle | false | Yes | Repair or remove the Firestore storage reference before deleting related records; verify whether the file was intentionally removed. |

## Deletion Risk Matrix

| Record |Why Selected |Inbound References |Creates Orphans |Repair First |Recommendation |
| --- | --- | --- | --- | --- | --- |
| users/4AEUqmHRJ9WRNpvPv2qO8D1Qqrj1 | matched /\bqa\b/i; matched /@qa\./i; matched /qa-v\d+/i; explicit test/mock/sample flag | 0 | No | No | SAFE TO DELETE AFTER APPROVAL |
| users/4tGDSPiGPSYsRwkRgMYiiqVddo52 | matched /\bqa\b/i; matched /@qa\./i; matched /qa-v\d+/i; explicit test/mock/sample flag | 0 | No | No | SAFE TO DELETE AFTER APPROVAL |
| users/52dhyG1wjkfJfdM0X9wYRp5y2Ry1 | matched /\bqa\b/i; matched /@qa\./i; matched /qa-v\d+/i; explicit test/mock/sample flag | 0 | No | No | SAFE TO DELETE AFTER APPROVAL |
| users/CWg6bLyMiNfiY96VVhxJcU58FCm2 | matched /\bqa\b/i; matched /@qa\./i; matched /qa-v\d+/i; explicit test/mock/sample flag | 0 | No | No | SAFE TO DELETE AFTER APPROVAL |
| users/CgWVU9ePjCQpj7nQSAEN6IYwbz73 | matched /\bqa\b/i; matched /@qa\./i | 0 | No | No | SAFE TO DELETE AFTER APPROVAL |
| users/GXTrRmOBByg0lW0A2WXsBSmxQrX2 | matched /\bqa\b/i; matched /@qa\./i; matched /qa-v\d+/i; explicit test/mock/sample flag | 7 | Yes | Yes | REPAIR DEPENDENCIES BEFORE DELETE |
| users/bcjkMdsemiRjnGIz54UOYKdfdeY2 | matched /\bqa\b/i; matched /@qa\./i; matched /qa-v\d+/i; explicit test/mock/sample flag | 0 | No | No | SAFE TO DELETE AFTER APPROVAL |
| contractors/qa-v1-contractor-incomplete | matched /\bqa\b/i; matched /qa-v\d+/i; explicit test/mock/sample flag | 0 | No | No | SAFE TO DELETE AFTER APPROVAL |
| contractors/test-contractor-1 | matched /\btest\b/i | 9 | Yes | Yes | REPAIR DEPENDENCIES BEFORE DELETE |
| vehicleFinanceCustomers/qa-v1-vf-customer | matched /\bqa\b/i; matched /qa-v\d+/i; explicit test/mock/sample flag | 2 | Yes | Yes | REPAIR DEPENDENCIES BEFORE DELETE |

## Recommended Cleanup Order

- 1. Freeze deletes until workspace migration and auth profile repair are complete.
- 2. Repair or classify broken references in real production records, starting with Users, Contractors, Vehicle Finance, and Documents.
- 3. Resolve duplicate contractor group for test@demo.com and choose canonical delete/keep records.
- 4. Verify four storage inconsistencies manually and repair missing object references before any record deletion.
- 5. Delete low-risk QA users with no inbound references only after an explicit approval file is prepared.
- 6. Delete QA contractor/deal/vehicle-finance chains only as grouped operations after dependent records are approved.
- 7. Rerun dry-run cleanup and confirm zero new broken references before any apply run.
