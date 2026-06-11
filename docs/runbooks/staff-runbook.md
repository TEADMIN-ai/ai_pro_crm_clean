# Staff Runbook

## Daily Tasks

- Review assigned contractors and uploaded documents.
- Execute document analysis where needed.
- Add deal notes for operational decisions.
- Confirm compliance gaps are visible before tender pack generation.
- Generate tender packs only when contractor readiness allows it.

## Workflow Diagram

```text
Contractor document arrives
  -> Open contractor file
  -> Verify document type and extracted fields
  -> Approve, reject, or request re-upload
  -> Add deal note when action affects a deal
  -> Recheck readiness
  -> Generate tender pack only when READY
```

## Troubleshooting

Document not visible:

- Refresh contractor page.
- Confirm upload completed.
- Check contractor ID and document route.

Deal note not saving:

- Confirm user is staff, manager, or admin.
- Confirm deal exists and is accessible.
- Check `/api/deals/{dealId}/notes` response.
- Check `auditLogs` for `DEAL_NOTE_CREATED`.

Tender pack blocked:

- Review missing documents, expired documents, compliance approval, and lock status.
- Escalate only after source document issues are resolved.

## Escalation Paths

- Incorrect extracted document data: manager review, then engineering if repeatable.
- Missing or corrupt document: request contractor re-upload.
- Tender pack render problem: engineering with source deal ID and generated PDF evidence.
- Access denied: manager/admin role check.
