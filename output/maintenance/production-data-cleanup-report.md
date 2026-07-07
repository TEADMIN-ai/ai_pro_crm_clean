# Production Data Cleanup Report

Mode: dry-run
Generated: 2026-07-07T18:40:03.924Z

## Summary

- Collections scanned: 23
- Records found: 679
- Recommended for deletion: 10
- Recommended to keep: 640
- Manual review: 29
- Potential integrity risks: 24
- Broken references: 0
- Storage leaks/missing objects: 4

## Collections Scanned

- users: 38
- contractors: 26
- documents: 5
- deals: 5
- dealNotes: 0
- tenderPacks: 44
- tenderPackRequests: 3
- vehicleFinanceCustomers: 3
- vehicleFinanceApplications: 5
- vehicleFinanceDocuments: 30
- vehicleFinanceAssessments: 4
- vehicleFinanceCertificates: 0
- vehicleFinanceWorkflowTasks: 0
- vehicleFinanceWorkflowTimeline: 0
- vehicleFinanceNotifications: 0
- vehicleFinanceApplicationEvents: 8
- vehicleFinanceNotificationQueue: 0
- auditLogs: 330
- decisionLogs: 10
- contractorActivity: 144
- contractorComplianceAudit: 1
- automationAlerts: 19
- inventory: 4

## Records Recommended For Deletion

- users/4AEUqmHRJ9WRNpvPv2qO8D1Qqrj1 (QA Driver)
  Reasons: matched /\bqa\b/i; matched /@qa\./i; matched /qa-v\d+/i; explicit test/mock/sample flag
- users/4tGDSPiGPSYsRwkRgMYiiqVddo52 (QA Admin)
  Reasons: matched /\bqa\b/i; matched /@qa\./i; matched /qa-v\d+/i; explicit test/mock/sample flag
- users/52dhyG1wjkfJfdM0X9wYRp5y2Ry1 (QA Staff)
  Reasons: matched /\bqa\b/i; matched /@qa\./i; matched /qa-v\d+/i; explicit test/mock/sample flag
- users/CWg6bLyMiNfiY96VVhxJcU58FCm2 (QA Manager)
  Reasons: matched /\bqa\b/i; matched /@qa\./i; matched /qa-v\d+/i; explicit test/mock/sample flag
- users/CgWVU9ePjCQpj7nQSAEN6IYwbz73 (QA admin prod-f3c185b-1782677481358)
  Reasons: matched /\bqa\b/i; matched /@qa\./i
- users/GXTrRmOBByg0lW0A2WXsBSmxQrX2 (QA Vehicle Finance Staff)
  Reasons: matched /\bqa\b/i; matched /@qa\./i; matched /qa-v\d+/i; explicit test/mock/sample flag
- users/bcjkMdsemiRjnGIz54UOYKdfdeY2 (QA Roar Cars Staff)
  Reasons: matched /\bqa\b/i; matched /@qa\./i; matched /qa-v\d+/i; explicit test/mock/sample flag
- contractors/qa-v1-contractor-incomplete (QA v1 Incomplete Documents Contractor)
  Reasons: matched /\bqa\b/i; matched /qa-v\d+/i; explicit test/mock/sample flag
- contractors/test-contractor-1 (test-contractor-1)
  Reasons: matched /\btest\b/i
- vehicleFinanceCustomers/qa-v1-vf-customer (qa-v1-finance@example.invalid)
  Reasons: matched /\bqa\b/i; matched /qa-v\d+/i; explicit test/mock/sample flag

## Manual Review

- users/72YwD2xe3US1nuQIZ8b073QvgCd2 (QA Contractor)
  Risk: medium
  Reasons: matched /\bqa\b/i; matched /@qa\./i; matched /qa-v\d+/i; explicit test/mock/sample flag
- users/CzEqgwRTDmT6u2XEtSJ20BVKR8B2 (TEST CONTRACTOR 02)
  Risk: medium
  Reasons: matched /\btest\b/i
- users/GqsT6LCH6wyIas8Meb8c (Test Contractor)
  Risk: medium
  Reasons: matched /\btest\b/i
- users/KLGcJzb3ZEGf2rNpHNVg (Test Contractor)
  Risk: medium
  Reasons: matched /\btest\b/i
- users/ND4HCW4KdEmXLGTDKMfF (Stability Check 1775308790400)
  Risk: medium
  Reasons: matched /example\.com/i
- users/a1CxFTpi5AatIkGXUXOkh50F1h93 (QA E2E Contractor 20260605100015)
  Risk: medium
  Reasons: matched /\bqa\b/i; matched /example\.com/i
- users/b2qz6m1aW2NNzVLjQg8K (Stability Check 1775307838)
  Risk: medium
  Reasons: matched /example\.com/i
- users/jxjgsfgHW0ouOJc2ZHYW (Test Contractor)
  Risk: medium
  Reasons: matched /\btest\b/i
- users/lkImwod6FgYrklknDS5T (Test Contractor)
  Risk: medium
  Reasons: matched /\btest\b/i
- users/m1EwzLOO115tWim5baab (Test Contractor)
  Risk: medium
  Reasons: matched /\btest\b/i
- users/qZTJeNRRviDlHFXq3cmF (Test Contractor)
  Risk: medium
  Reasons: matched /\btest\b/i
- users/sYEU6aqqiEV4Gvu6eTBSmovlJa12 (Pilot Contractor)
  Risk: medium
  Reasons: matched /example\.com/i
- users/vW511XxAZNSDe9BwTyFYeOjM04S2 (Test Contractor)
  Risk: medium
  Reasons: matched /\btest\b/i
- contractors/CzEqgwRTDmT6u2XEtSJ20BVKR8B2 (TEST CONTRACTOR 02)
  Risk: medium
  Reasons: matched /\btest\b/i
- contractors/GqsT6LCH6wyIas8Meb8c (Test Contractor)
  Risk: medium
  Reasons: matched /\btest\b/i
- contractors/KLGcJzb3ZEGf2rNpHNVg (Test Contractor)
  Risk: medium
  Reasons: matched /\btest\b/i
- contractors/ND4HCW4KdEmXLGTDKMfF (Stability Check 1775308790400)
  Risk: medium
  Reasons: matched /example\.com/i
- contractors/a1CxFTpi5AatIkGXUXOkh50F1h93 (QA E2E Contractor 20260605100015)
  Risk: medium
  Reasons: matched /\bqa\b/i; matched /example\.com/i
- contractors/b2qz6m1aW2NNzVLjQg8K (Stability Check 1775307838)
  Risk: medium
  Reasons: matched /example\.com/i
- contractors/jxjgsfgHW0ouOJc2ZHYW (Test Contractor)
  Risk: medium
  Reasons: matched /\btest\b/i
- contractors/lkImwod6FgYrklknDS5T (Test Contractor)
  Risk: medium
  Reasons: matched /\btest\b/i
- contractors/m1EwzLOO115tWim5baab (Test Contractor)
  Risk: medium
  Reasons: matched /\btest\b/i
- contractors/qZTJeNRRviDlHFXq3cmF (Test Contractor)
  Risk: medium
  Reasons: matched /\btest\b/i
- contractors/qa-v1-contractor-verified (QA v1 Verified Documents Contractor)
  Risk: medium
  Reasons: matched /\bqa\b/i; matched /@qa\./i; matched /qa-v\d+/i; explicit test/mock/sample flag
- contractors/sYEU6aqqiEV4Gvu6eTBSmovlJa12 (Pilot Contractor)
  Risk: medium
  Reasons: matched /example\.com/i
- contractors/vW511XxAZNSDe9BwTyFYeOjM04S2 (Test Contractor)
  Risk: medium
  Reasons: matched /\btest\b/i
- deals/9f6pkwHdf2ZURxyRyf8i (QA E2E Tender Pack Validation 20260605)
  Risk: medium
  Reasons: matched /\bqa\b/i
- vehicleFinanceApplications/qa-v1-vf-application (qa-v1-vf-application)
  Risk: medium
  Reasons: matched /\bqa\b/i; matched /qa-v\d+/i; explicit test/mock/sample flag
- vehicleFinanceAssessments/qa-v1-vf-application (qa-v1-vf-application)
  Risk: medium
  Reasons: matched /\bqa\b/i; matched /qa-v\d+/i; explicit test/mock/sample flag

## Potential Integrity Risks

- [high] documents/smoke-check: Would reference deleted record contractors/test-contractor-1 through contractorId
- [high] deals/SA2OfC91tynyZHJidLjP: Would reference deleted record contractors/test-contractor-1 through contractorId
- [high] vehicleFinanceApplications/eaf451e6-ed8e-40ab-9f89-2730df63b49b: Would reference deleted record vehicleFinanceCustomers/qa-v1-vf-customer through customerId
- [high] vehicleFinanceApplications/qa-v1-vf-application: Would reference deleted record vehicleFinanceCustomers/qa-v1-vf-customer through customerId
- [high] vehicleFinanceApplicationEvents/0bZlLS8e3MZ9nZioBP9s: Would reference deleted record users/GXTrRmOBByg0lW0A2WXsBSmxQrX2 through userId
- [high] vehicleFinanceApplicationEvents/Wgz7yLWtjVmbwajC20qw: Would reference deleted record users/GXTrRmOBByg0lW0A2WXsBSmxQrX2 through userId
- [high] vehicleFinanceApplicationEvents/mk2HWUjv4ryPjvHh83KX: Would reference deleted record users/GXTrRmOBByg0lW0A2WXsBSmxQrX2 through userId
- [high] vehicleFinanceApplicationEvents/yT7dgvcujOwcTXcom8zN: Would reference deleted record users/GXTrRmOBByg0lW0A2WXsBSmxQrX2 through userId
- [high] auditLogs/8bv5kaJSDIsattiLfJIE: Would reference deleted record users/GXTrRmOBByg0lW0A2WXsBSmxQrX2 through actorId
- [high] auditLogs/FRiWgIouUEfsYn5k37KD: Would reference deleted record users/GXTrRmOBByg0lW0A2WXsBSmxQrX2 through actorId
- [high] auditLogs/LLxpWDHNtQfP3TdnRMYf: Would reference deleted record users/GXTrRmOBByg0lW0A2WXsBSmxQrX2 through actorId
- [high] contractorActivity/1iQoFwsM2tn0QkGl2QOh: Would reference deleted record contractors/test-contractor-1 through contractorId
- [high] contractorActivity/93B6PhSlO9vrrEOR8unE: Would reference deleted record contractors/test-contractor-1 through contractorId
- [high] contractorActivity/ERfnxaoo1v70qkzBiZXd: Would reference deleted record contractors/test-contractor-1 through contractorId
- [high] contractorActivity/J6CRBmcCUBJP9yaY3JoL: Would reference deleted record contractors/test-contractor-1 through contractorId
- [high] contractorActivity/r5xAtlP3ckFmhOw4BTjN: Would reference deleted record contractors/test-contractor-1 through contractorId
- [high] automationAlerts/7Y2wbD6s3lc5s1txIzo7: Would reference deleted record contractors/test-contractor-1 through contractorId
- [high] automationAlerts/oatIo5I4FZYZpswS0krO: Would reference deleted record contractors/test-contractor-1 through contractorId
- [medium] documents/smoke-check: Storage URL requires manual leak verification: https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
- [medium] inventory/3af5debda40edb54942fdeb31463e6bfca91e322: Storage URL requires manual leak verification: http://roarcarssa.com/uploads/4e713ce84f96421cb0b2144f9af759a8.jpeg
- [medium] inventory/910e3cffe3519e68fd8e5fa80101f34b01461f83: Storage URL requires manual leak verification: http://roarcarssa.com/uploads/f2f0dddb0e3440848bdfc377f69e1496.jpeg
- [medium] inventory/qa-v1-roar-vehicle: Referenced storage object does not exist: images/roar-cars-placeholder.svg
- [medium] users/GqsT6LCH6wyIas8Meb8c, users/KLGcJzb3ZEGf2rNpHNVg, users/jxjgsfgHW0ouOJc2ZHYW, users/lkImwod6FgYrklknDS5T, users/m1EwzLOO115tWim5baab, users/qZTJeNRRviDlHFXq3cmF, users/vW511XxAZNSDe9BwTyFYeOjM04S2: Potential duplicate group: users:email:test@demo.com
- [medium] contractors/GqsT6LCH6wyIas8Meb8c, contractors/KLGcJzb3ZEGf2rNpHNVg, contractors/jxjgsfgHW0ouOJc2ZHYW, contractors/lkImwod6FgYrklknDS5T, contractors/m1EwzLOO115tWim5baab, contractors/qZTJeNRRviDlHFXq3cmF, contractors/vW511XxAZNSDe9BwTyFYeOjM04S2: Potential duplicate group: contractors:email:test@demo.com

## Apply Result

- Apply requested: false
- Deleted records: 0
- Skipped approved records: 0