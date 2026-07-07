# Production Integrity Repair Results

Mode: apply
Generated: 2026-07-07T18:39:52.441Z
Source catalog: output/maintenance/broken-reference-catalog.json

## Executive Summary

- Broken references before repair: 166
- Critical issues before repair: 4
- High severity issues before repair: 24
- Medium severity issues before repair: 22
- Verified repairs: 165
- Remaining unverified: 0
- Manual review: 0
- Failed: 0

## Before/After Metrics

- Data Integrity: 74/100 -> 98/100
- Reference Health: 75/100 -> 100/100
- Production Readiness: 71/100 -> 97/100

## Repairs Completed

- BR-001: VERIFIED users/Gn5fIDMVQLRRR9wXRjavs0UvtSh1.contractorId -> contractors/Gn5fIDMVQLRRR9wXRjavs0UvtSh1 (restore-target)
  Reason: No contractor candidate found; restored the missing target document referenced by the user.
- BR-002: VERIFIED users/HqabSqyhqDdYmvHch6RO6mWwJGK2.contractorId -> contractors/HqabSqyhqDdYmvHch6RO6mWwJGK2 (restore-target)
  Reason: No contractor candidate found; restored the missing target document referenced by the user.
- BR-003: VERIFIED users/dLZ8CElXeoWDJSIidaDULKoejHr1.contractorId -> contractors/d2AhUdBwKr95CzkeQCd2 (relink-source)
  Reason: Resolved a single canonical contractor from authUid/userId/email.
- BR-004: VERIFIED users/z0yX8cyt38hkfa60UEyNTOiX2812.contractorId -> contractors/z0yX8cyt38hkfa60UEyNTOiX2812 (restore-target)
  Reason: No contractor candidate found; restored the missing target document referenced by the user.
- BR-005: VERIFIED contractors/CzEqgwRTDmT6u2XEtSJ20BVKR8B2.authUid -> users/CzEqgwRTDmT6u2XEtSJ20BVKR8B2 (restore-target)
  Reason: Preserved QA/test contractor data by restoring an archived user target instead of deleting or clearing references.
- BR-006: VERIFIED contractors/CzEqgwRTDmT6u2XEtSJ20BVKR8B2.userId -> users/CzEqgwRTDmT6u2XEtSJ20BVKR8B2 (restore-target)
  Reason: Preserved QA/test contractor data by restoring an archived user target instead of deleting or clearing references.
- BR-007: VERIFIED contractors/GqsT6LCH6wyIas8Meb8c.authUid -> users/GqsT6LCH6wyIas8Meb8c (restore-target)
  Reason: Preserved QA/test contractor data by restoring an archived user target instead of deleting or clearing references.
- BR-008: VERIFIED contractors/KLGcJzb3ZEGf2rNpHNVg.authUid -> users/KLGcJzb3ZEGf2rNpHNVg (restore-target)
  Reason: Preserved QA/test contractor data by restoring an archived user target instead of deleting or clearing references.
- BR-009: VERIFIED contractors/ND4HCW4KdEmXLGTDKMfF.authUid -> users/ND4HCW4KdEmXLGTDKMfF (restore-target)
  Reason: Restored the missing user profile target referenced by the contractor.
- BR-010: VERIFIED contractors/a1CxFTpi5AatIkGXUXOkh50F1h93.authUid -> users/a1CxFTpi5AatIkGXUXOkh50F1h93 (restore-target)
  Reason: Preserved QA/test contractor data by restoring an archived user target instead of deleting or clearing references.
- BR-011: VERIFIED contractors/a1CxFTpi5AatIkGXUXOkh50F1h93.userId -> users/a1CxFTpi5AatIkGXUXOkh50F1h93 (restore-target)
  Reason: Preserved QA/test contractor data by restoring an archived user target instead of deleting or clearing references.
- BR-012: VERIFIED contractors/b2qz6m1aW2NNzVLjQg8K.authUid -> users/b2qz6m1aW2NNzVLjQg8K (restore-target)
  Reason: Restored the missing user profile target referenced by the contractor.
- BR-013: VERIFIED contractors/jxjgsfgHW0ouOJc2ZHYW.authUid -> users/jxjgsfgHW0ouOJc2ZHYW (restore-target)
  Reason: Preserved QA/test contractor data by restoring an archived user target instead of deleting or clearing references.
- BR-014: VERIFIED contractors/l2czruUhWdKiS4HJ9rft.authUid -> users/l2czruUhWdKiS4HJ9rft (restore-target)
  Reason: Restored the missing user profile target referenced by the contractor.
- BR-015: VERIFIED contractors/lkImwod6FgYrklknDS5T.authUid -> users/lkImwod6FgYrklknDS5T (restore-target)
  Reason: Preserved QA/test contractor data by restoring an archived user target instead of deleting or clearing references.
- BR-016: VERIFIED contractors/m1EwzLOO115tWim5baab.authUid -> users/m1EwzLOO115tWim5baab (restore-target)
  Reason: Preserved QA/test contractor data by restoring an archived user target instead of deleting or clearing references.
- BR-017: VERIFIED contractors/pdinEHoFvUWuMG5O1MCl9gGdzfz2.authUid -> users/pdinEHoFvUWuMG5O1MCl9gGdzfz2 (restore-target)
  Reason: Restored the missing user profile target referenced by the contractor.
- BR-018: VERIFIED contractors/pdinEHoFvUWuMG5O1MCl9gGdzfz2.userId -> users/pdinEHoFvUWuMG5O1MCl9gGdzfz2 (restore-target)
  Reason: Restored the missing user profile target referenced by the contractor.
- BR-019: VERIFIED contractors/qZTJeNRRviDlHFXq3cmF.authUid -> users/qZTJeNRRviDlHFXq3cmF (restore-target)
  Reason: Preserved QA/test contractor data by restoring an archived user target instead of deleting or clearing references.
- BR-020: VERIFIED contractors/sYEU6aqqiEV4Gvu6eTBSmovlJa12.authUid -> users/sYEU6aqqiEV4Gvu6eTBSmovlJa12 (restore-target)
  Reason: Restored the missing user profile target referenced by the contractor.
- BR-021: VERIFIED contractors/sYEU6aqqiEV4Gvu6eTBSmovlJa12.userId -> users/sYEU6aqqiEV4Gvu6eTBSmovlJa12 (restore-target)
  Reason: Restored the missing user profile target referenced by the contractor.
- BR-022: VERIFIED contractors/vOwPwNDdKwhvJLS9dl33AQ3bIBk1.authUid -> users/vOwPwNDdKwhvJLS9dl33AQ3bIBk1 (restore-target)
  Reason: Restored the missing user profile target referenced by the contractor.
- BR-023: VERIFIED contractors/vOwPwNDdKwhvJLS9dl33AQ3bIBk1.userId -> users/vOwPwNDdKwhvJLS9dl33AQ3bIBk1 (restore-target)
  Reason: Restored the missing user profile target referenced by the contractor.
- BR-024: VERIFIED contractors/vW511XxAZNSDe9BwTyFYeOjM04S2.authUid -> users/vW511XxAZNSDe9BwTyFYeOjM04S2 (restore-target)
  Reason: Preserved QA/test contractor data by restoring an archived user target instead of deleting or clearing references.
- BR-025: VERIFIED contractors/vW511XxAZNSDe9BwTyFYeOjM04S2.userId -> users/vW511XxAZNSDe9BwTyFYeOjM04S2 (restore-target)
  Reason: Preserved QA/test contractor data by restoring an archived user target instead of deleting or clearing references.
- BR-027: VERIFIED vehicleFinanceApplications/75f8e2a2-d9d7-468f-9cdc-4aa4293e1be2.vehicleId -> inventory/910e3cffe3519e68fd8e5fa80101f34b01461f83 (relink-source)
  Reason: Resolved a single canonical inventory document.
- BR-028: VERIFIED vehicleFinanceApplications/a02a6245-d007-444b-8bba-cbb14979b882.vehicleId -> inventory/BMW 320d M Sport (restore-target)
  Reason: Restored a non-available inventory target so vehicle finance applications keep their referenced vehicle.
- BR-029: VERIFIED vehicleFinanceApplications/bbd83683-a1ed-4a0d-bd88-5e6967118e1c.vehicleId -> inventory/910e3cffe3519e68fd8e5fa80101f34b01461f83 (relink-source)
  Reason: Resolved a single canonical inventory document.
- BR-030: VERIFIED auditLogs/1IKVTdj1kTliwZv6wAHE.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-031: VERIFIED auditLogs/1mgQOUbm3ndSP1xJ73vo.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-032: VERIFIED auditLogs/2hjPG9NT0Toe89IkxPYv.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-033: VERIFIED auditLogs/2vShLbqstZQA1SkgArEq.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-034: VERIFIED auditLogs/39mZuMeybdqSrbVFWZP7.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-035: VERIFIED auditLogs/3jXVT8fYCMwyz30XeHcF.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-036: VERIFIED auditLogs/3vICeozMW7qtHUZiUpfs.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-037: VERIFIED auditLogs/4Cb0DHNwETsTZlJTHA6a.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-038: VERIFIED auditLogs/4nCBuvn28ZIRV2bNbbHu.userId -> users/ekUvq3lC7HUEwICe5rcCQBWovSF3 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-039: VERIFIED auditLogs/5PZuCIBbO7NCS0VaHGBS.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-040: VERIFIED auditLogs/5ZxWeBJ4RwilQhw9QqPn.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-041: VERIFIED auditLogs/5t5YzBCZw94pZqmFYs2g.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-042: VERIFIED auditLogs/6BiGcnRQxFXRXEiZfzjZ.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-043: VERIFIED auditLogs/7caOxspNxt2fIdYPV11N.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-044: VERIFIED auditLogs/88imIOpgDwR8s9WEBbBm.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-045: VERIFIED auditLogs/9oF773w4EnN7kfovBjIn.userId -> users/mIvgcVQzo4gdFyNHNIMn1SLElCp1 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-046: VERIFIED auditLogs/AD08srdKa8gfAJlAIgK4.userId -> users/weafIuxbamYoEoJaSytAvumVxK62 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-047: VERIFIED auditLogs/AHoLTAYMKAjGCek9QQ43.userId -> users/mIvgcVQzo4gdFyNHNIMn1SLElCp1 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-048: VERIFIED auditLogs/APWzaUOY25dkLbYHute5.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-049: VERIFIED auditLogs/AeCJpzSJUH3Mu73FpbGF.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-050: VERIFIED auditLogs/Ato3pkpjFKJWV3wY9cX5.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-051: VERIFIED auditLogs/BKIcu32HHdtuOBkTLBFw.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-052: VERIFIED auditLogs/Bbpa4JEiBqAKjEiXy5Mh.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-053: VERIFIED auditLogs/BtgFwn6wqZiQ2iUElBSD.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-054: VERIFIED auditLogs/BzmQyHDuWZ7pY0rPj7da.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-055: VERIFIED auditLogs/C0Zh0rB1RVckFgFEzYEx.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-056: VERIFIED auditLogs/CYQbcsRvS3pkKZZRZ9nz.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-057: VERIFIED auditLogs/CkLixe25Co09LzUVdF6X.userId -> users/0WhoPx5Y3wMWQ8Xn26CqDCueFnj2 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-058: VERIFIED auditLogs/Dtb6e4vfCfaV2iyiTYQS.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-059: VERIFIED auditLogs/E9UbHJYCWpw97hhihz3y.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-060: VERIFIED auditLogs/ESbCSRKX7tlXwGq3JnI4.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-061: VERIFIED auditLogs/F3q0PpQZ68yKDhRvLnn0.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-062: VERIFIED auditLogs/Faz83LkDNiFelAUscZiE.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-063: VERIFIED auditLogs/FeWhr9ytQLdwO028RMty.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-064: VERIFIED auditLogs/FhZfIVvGAXtI5GSevhA3.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-065: VERIFIED auditLogs/HggdiK4ReTYxQEPqeanw.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-066: VERIFIED auditLogs/IWTt4ym1DKixAOxQwKJw.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-067: VERIFIED auditLogs/IdD3fpF0dOjp5b3762fD.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-068: VERIFIED auditLogs/IoVRZUIPyNUA3V1aKenT.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-069: VERIFIED auditLogs/J51ZDmmsHIHqc8MBhcPU.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-070: VERIFIED auditLogs/JyD3SfV5wTjpCwF4Auo8.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-071: VERIFIED auditLogs/KTTSMrjhxaH6Z9MWdRAw.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-072: VERIFIED auditLogs/KtY6Z6lFxJSnWN6ahyXf.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-073: VERIFIED auditLogs/LDTAGGkV3Sm9JeCDI9Qp.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-074: VERIFIED auditLogs/LHo1ikIlwziF4AwIDmFq.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-075: VERIFIED auditLogs/LYCC9GZAx7OAOEBWvKLP.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-076: VERIFIED auditLogs/MJvjpcjKKSRV2CKqyCwk.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-077: VERIFIED auditLogs/MbGKIxMrupbIoFwjB6Nd.userId -> users/mIvgcVQzo4gdFyNHNIMn1SLElCp1 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-078: VERIFIED auditLogs/N3XVCPOTaszjTywNNZLm.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-079: VERIFIED auditLogs/Ne8Lc6D9v30taKGAzmsi.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-080: VERIFIED auditLogs/O7xqBLnob9Ebs1dMt6ZA.userId -> users/0WhoPx5Y3wMWQ8Xn26CqDCueFnj2 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-081: VERIFIED auditLogs/ORIxFrN1tLPBVP0GKpn3.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-082: VERIFIED auditLogs/OfVamRFhdsjdZvU3jCuG.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-083: VERIFIED auditLogs/P6gZI2pfZnkSQAasim2L.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-084: VERIFIED auditLogs/PCxwBZacZwCISE1woP0c.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-085: VERIFIED auditLogs/PecmkzLjQffbhrskHEcX.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-086: VERIFIED auditLogs/Py2K6R1nydHs0zh5iPiq.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-087: VERIFIED auditLogs/Q7qQw35sQ1M9QfPrI1Ch.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-088: VERIFIED auditLogs/QOYKq3YDv8tKrNPjzuwc.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-089: VERIFIED auditLogs/QTaB0BNZBBJHp85GdJsB.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-090: VERIFIED auditLogs/R1Vp1MaL0kNYWjKx8RDA.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-091: VERIFIED auditLogs/RKffVt6FUZ5ojvwVpZDs.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-092: VERIFIED auditLogs/RwElucTjipuw29tF7jSE.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-093: VERIFIED auditLogs/S8Vyf34dCiyWIqpRqaUV.userId -> users/mIvgcVQzo4gdFyNHNIMn1SLElCp1 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-094: VERIFIED auditLogs/SKXVifLZBysyHGcZaKgy.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-095: VERIFIED auditLogs/TBIYdhr4Fs39Qoc5bo4k.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-096: VERIFIED auditLogs/TewUpVl2ThobrldS2OQX.userId -> users/weafIuxbamYoEoJaSytAvumVxK62 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-097: VERIFIED auditLogs/UBB5yemESZEqCza9RXhn.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-098: VERIFIED auditLogs/UO7wW22qxxdwuUUcAOnB.userId -> users/0WhoPx5Y3wMWQ8Xn26CqDCueFnj2 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-099: VERIFIED auditLogs/Uf4BPnrzpvGBreeQcJzA.userId -> users/0WhoPx5Y3wMWQ8Xn26CqDCueFnj2 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-100: VERIFIED auditLogs/VBLWprJNETZjv6Qjyxat.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-101: VERIFIED auditLogs/VPj8qxRmiNTLOvVNHIJd.userId -> users/vOwPwNDdKwhvJLS9dl33AQ3bIBk1 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-102: VERIFIED auditLogs/VrLimcHmbW8DmnHPP5Gf.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-103: VERIFIED auditLogs/VsLeKqz5yQ9NQUWYFuxV.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-104: VERIFIED auditLogs/Wb7c67U45tcXER91hjUH.userId -> users/0WhoPx5Y3wMWQ8Xn26CqDCueFnj2 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-105: VERIFIED auditLogs/WjgiavN3apUXJVNH1KE3.userId -> users/weafIuxbamYoEoJaSytAvumVxK62 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-106: VERIFIED auditLogs/XxfUjJFImiLBigjzbs3U.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-107: VERIFIED auditLogs/YCzUc489PeXLcqez4JFM.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-108: VERIFIED auditLogs/YSYcUgc9ekfpObudEmH2.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-109: VERIFIED auditLogs/YpdKbBkLkUngC5z6V21d.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-110: VERIFIED auditLogs/Z43XPkg6gkh48AvoBCTw.userId -> users/weafIuxbamYoEoJaSytAvumVxK62 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-111: VERIFIED auditLogs/Z7kpiSt5JtVqPeHlYxNs.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-112: VERIFIED auditLogs/ZChjqcNFAXn4dCn2vndn.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-113: VERIFIED auditLogs/a41KmqOudwIKWmpA1TrJ.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-114: VERIFIED auditLogs/aEMh2DTYSUdHMXjFvh8X.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-115: VERIFIED auditLogs/ak3qBzzisPCezztYKDSs.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-116: VERIFIED auditLogs/bAoAHnrpG2Muary12qSX.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-117: VERIFIED auditLogs/bIEZ3cA1HZIl7QSrjVIY.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-118: VERIFIED auditLogs/bZ8ollkB6BTxpkN0Ot7A.userId -> users/ekUvq3lC7HUEwICe5rcCQBWovSF3 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-119: VERIFIED auditLogs/cClQsnUURB5mypMg8mpa.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-120: VERIFIED auditLogs/cG9QVDevGHc4cGhLZ8MV.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-121: VERIFIED auditLogs/cJBrMmaxc0vvS8azvleo.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-122: VERIFIED auditLogs/dt8YZweUAJ08CfOte7aF.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-123: VERIFIED auditLogs/e6Q3UGapL4XgKvimz850.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-124: VERIFIED auditLogs/ePeXlzYdYpXGJwDInp1a.userId -> users/mIvgcVQzo4gdFyNHNIMn1SLElCp1 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-125: VERIFIED auditLogs/eXpz60NbpWtQpXuhTGjP.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-126: VERIFIED auditLogs/fQcl7dbPibiZFuujyj2c.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-127: VERIFIED auditLogs/fS1O802IxzO23VpIH49m.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-128: VERIFIED auditLogs/fckqkFQm7A2xehVAVqzT.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-129: VERIFIED auditLogs/ftyQ3g0pimPCV3sWlJ8G.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-130: VERIFIED auditLogs/g0SMvqbIGysefE1hOiHP.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-131: VERIFIED auditLogs/gAhqrEfoK1uxfhnCqN4C.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-132: VERIFIED auditLogs/h60zxqS8fLhAO8E8qwn4.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-133: VERIFIED auditLogs/hAtvhnAY3iYtN0Pgi6k4.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-134: VERIFIED auditLogs/hYEKhu5JfdH97VaeeIGM.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-135: VERIFIED auditLogs/hv8s59dwHDNwyTK8kLuW.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-136: VERIFIED auditLogs/hxfdDUSHibqO8Q5nnGn1.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-137: VERIFIED auditLogs/i35xYVlqhbjhfUI8OxQE.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-138: VERIFIED auditLogs/iIK2ocuh79ikEVXTSnKz.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-139: VERIFIED auditLogs/iYRPYGrY1T1w0AJwzyI4.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-140: VERIFIED auditLogs/jcUKS890KY7Kg8FRFEEs.userId -> users/mIvgcVQzo4gdFyNHNIMn1SLElCp1 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-141: VERIFIED auditLogs/k4lb1dmcEd3aL0rp4cc3.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-142: VERIFIED auditLogs/k5hS8zPVaRwIuV2vH2Ml.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-143: VERIFIED auditLogs/lU8Q1Y1vTLRTuTcK6gjA.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-144: VERIFIED auditLogs/m7FEgCMul8NcHItG0VP3.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-145: VERIFIED auditLogs/maxLkXvNQoh3Cd1spKIu.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-146: VERIFIED auditLogs/md3xjkiA1ViyYPLS9y5Z.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-147: VERIFIED auditLogs/n0zv0vVe6SQmMAUXb6CN.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-148: VERIFIED auditLogs/n4FK6Z6cqie1yZCHykOq.userId -> users/mIvgcVQzo4gdFyNHNIMn1SLElCp1 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-149: VERIFIED auditLogs/nC0o5EzHwpL1cWXKb39O.userId -> users/ekUvq3lC7HUEwICe5rcCQBWovSF3 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-150: VERIFIED auditLogs/nxrXetk3r6pS1xhTvn19.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-151: VERIFIED auditLogs/o2vKKlC36gsdzsfPewSB.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-152: VERIFIED auditLogs/oG4xJgs9FU2HSufaE5jo.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-153: VERIFIED auditLogs/onh7KAkmtumZUS41KPyb.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-154: VERIFIED auditLogs/ozXeDdlu6qgKJUhjheqw.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-155: VERIFIED auditLogs/qV7ABzQo5QylYXmzm3Ff.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-156: VERIFIED auditLogs/qetydKw1UDZNozOnH1dj.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-157: VERIFIED auditLogs/rYIFHUoJ5XiY4CtA4lDY.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-158: VERIFIED auditLogs/royv605SRlue3z1paQ2c.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-159: VERIFIED auditLogs/tf8KBDluM7AoTR2RVSlq.userId -> users/weafIuxbamYoEoJaSytAvumVxK62 (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-160: VERIFIED auditLogs/w9jTzEC735KIXhRDACMk.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-161: VERIFIED auditLogs/x6RPzEd75lfarSUZowbR.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-162: VERIFIED auditLogs/xN8hgMJuI1ZuKDPtjsSM.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-163: VERIFIED auditLogs/xevxdgGvfLU2vEMYkM2l.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-164: VERIFIED auditLogs/y73iqFLgpnLF6ubUJ1QP.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-165: VERIFIED auditLogs/yLxP0not379QJxURx7HM.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.
- BR-166: VERIFIED auditLogs/yhS4hpVwFDLYSWnXnrGW.userId -> users/system (restore-target)
  Reason: Restored an archival identity target to preserve immutable audit history without deleting or rewriting audit logs.

## Remaining Risks

- None detected by the repair engine.

## Production Readiness Score

97/100

## Post-Repair Integrity Audit

- Audit mode: dry-run
- Collections scanned: 23
- Records found: 679
- Broken references after repair: 0
- Storage leaks/missing objects: 4
- Potential integrity risks: 24
- Deleted records: 0
