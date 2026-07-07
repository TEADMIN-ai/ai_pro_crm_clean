# Production Dependency Graph

Generated: 2026-07-07T18:13:35.251Z

## Dependency Edges

| Source | Depends On | Relationship |
| --- | --- | --- |
| Users | Workspace | workspace/workspaceId/workspaceSlug resolve operating context |
| Users | Capabilities | role + workspace determine capabilities |
| Users | Contractors | contractor users link via contractorId |
| Contractors | Users | contractors link back via authUid/userId |
| Documents | Contractors | contractor document ownership |
| Documents | Storage | document fileUrl/filePath references object or URL |
| Applications | Users | assigned consultant/actor fields |
| Vehicle Finance | Applications | documents, assessments, tasks, events depend on applicationId |
| Vehicle Finance | Documents | document intelligence depends on vehicleFinanceDocuments |
| Vehicle Finance | Storage | vehicle finance documents reference uploaded PDFs |
| Vehicle Finance | Inventory | applications reference vehicleId |
| Audit Logs | Users | userId/actorId identify actor |
| Audit Logs | Contractors | contractorId identifies target |
| Audit Logs | Applications | applicationId identifies finance target |
| Notifications | Users | actorId/audience-related user context |
| Notifications | Applications | applicationId links notification to finance file |
| Tender Records | Contractors | contractorId identifies tender party |
| Tender Records | Documents | generated packs reference stored files |
| Tender Records | Storage | PDF outputs reference storage paths |

## Cascading Delete Risks

- Deleting QA users before QA contractor records can leave contractor.authUid/userId dangling.
- Deleting QA contractors before deals, documents, tender packs, audit events, and contractor activity are repaired creates orphan business records.
- Deleting vehicleFinanceCustomers before vehicleFinanceApplications creates orphan applications.
- Deleting vehicleFinanceApplications before documents, assessments, events, notifications, and tasks creates orphan finance records.
- Deleting Firestore records before verifying Storage paths can leave storage objects without reachable metadata.
- Deleting audit logs to remove broken references destroys operational evidence and should not be used as a cleanup shortcut.

## Orphan Analysis

- Orphan document-related references: 0
- Orphan storage/missing storage references: 4
- Dangling references: 166
- Circular references detected: 0
- Duplicate relationship groups: 1

## Duplicate Relationships

- contractors:email:test@demo.com: contractors/GqsT6LCH6wyIas8Meb8c, contractors/KLGcJzb3ZEGf2rNpHNVg, contractors/jxjgsfgHW0ouOJc2ZHYW, contractors/lkImwod6FgYrklknDS5T, contractors/m1EwzLOO115tWim5baab, contractors/qZTJeNRRviDlHFXq3cmF, contractors/vW511XxAZNSDe9BwTyFYeOjM04S2