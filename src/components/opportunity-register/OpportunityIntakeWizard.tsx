"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  EnterpriseActionButton,
  EnterpriseCard,
  EnterpriseEmptyState,
  EnterpriseKpiCard,
  EnterprisePanel,
  EnterpriseStatusBadge,
  EnterpriseTable,
} from "@/components/ui/EnterpriseUI";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import {
  OPPORTUNITY_DRAFT_STORAGE_KEY,
  buildOpportunitySummary,
  applyRfqExtractionToDraft,
  createDraftForRfqExtractionSession,
  createOpportunityDraft,
  getMissingCreateRequirements,
  getStepCompletion,
  markManualField,
  markRfqExtractionFailed,
  normalizeEstimatedValue,
  type OpportunityDocumentKey,
  type OpportunityDraft,
  type OpportunityDraftFields,
  type OpportunityExtractionResult,
  type OpportunityUploadedDocument,
} from "@/lib/opportunities/opportunityIntake";

type IntakeMode = "new" | "upload";
type StepKey = "details" | "documents" | "summary";
type FileState = Record<OpportunityDocumentKey, File[]>;

const STEPS: Array<{ key: StepKey; label: string; detail: string }> = [
  { key: "details", label: "Opportunity Details", detail: "Capture the opportunity record" },
  { key: "documents", label: "Upload", detail: "Attach and analyze source documents" },
  { key: "summary", label: "Summary", detail: "Review, correct, and create" },
];

const DOCUMENTS: Array<{ key: OpportunityDocumentKey; label: string; helper: string; multiple?: boolean }> = [
  { key: "rfq", label: "RFQ / RFP Notice", helper: "Primary request document used for metadata extraction", multiple: false },
  { key: "boq", label: "BOQ", helper: "Bill of quantities or pricing schedule pack", multiple: false },
  { key: "annexures", label: "Annexures", helper: "Appendices, schedules, and annexures", multiple: true },
  { key: "sbd", label: "Pricing Schedule", helper: "Commercial schedule and pricing sheets", multiple: true },
  { key: "supporting", label: "Supporting Documents", helper: "Reference material and uploads", multiple: true },
];

const DETAIL_FIELDS: Array<{ key: keyof OpportunityDraftFields; label: string; type?: string; hint?: string; required?: boolean }> = [
  { key: "referenceNumber", label: "RFQ / RFP Number", hint: "Optional when the source notice has no reference." },
  { key: "opportunityTitle", label: "Opportunity Title", required: true },
  { key: "clientName", label: "Client / Issuer", required: true },
  { key: "municipality", label: "Municipality" },
  { key: "department", label: "Department" },
  { key: "closingDate", label: "Closing Date", type: "date", required: true },
  { key: "estimatedValue", label: "Estimated Value", type: "number", hint: "Optional; many RFQs do not disclose value." },
  { key: "province", label: "Province" },
  { key: "category", label: "Category" },
  { key: "assignedContractorId", label: "Assigned Contractor ID" },
  { key: "description", label: "Description" },
];

function createEmptyFileState(): FileState {
  return { rfq: [], boq: [], annexures: [], sbd: [], supporting: [] };
}

function readSavedDraft(mode: IntakeMode): OpportunityDraft {
  if (mode === "upload") return createOpportunityDraft();
  if (typeof window === "undefined") return createOpportunityDraft();
  try {
    const saved = window.localStorage.getItem(`${OPPORTUNITY_DRAFT_STORAGE_KEY}:${mode}`);
    if (!saved) return createOpportunityDraft();
    const parsed = JSON.parse(saved) as OpportunityDraft;
    return { ...createOpportunityDraft(parsed.draftId), ...parsed, uploadedDocuments: parsed.uploadedDocuments ?? [], extractionMetadata: parsed.extractionMetadata ?? [], fieldSources: parsed.fieldSources ?? {} };
  } catch {
    return createOpportunityDraft();
  }
}

function formatCurrency(value: string) {
  const parsed = normalizeEstimatedValue(value);
  return parsed > 0 ? new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(parsed) : "Missing";
}

function FieldShell({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--tex-text-muted)]">{label}</span>
      {children}
      {hint ? <span className="text-xs text-[color:var(--tex-text-muted)]">{hint}</span> : null}
    </label>
  );
}

function statusForStep(step: StepKey, active: boolean, completion: ReturnType<typeof getStepCompletion>) {
  if (step === "details" && completion.detailsComplete) return "Completed";
  if (step === "documents" && completion.documentsComplete) return "Completed";
  if (step === "summary" && completion.summaryComplete) return "Ready";
  return active ? "Active" : "Pending";
}

function statusTone(value: string) {
  if (value === "Completed" || value === "Ready") return "success";
  if (value === "Active") return "info";
  return "neutral";
}

export default function OpportunityIntakeWizard({ mode, initialStep = 0 }: { mode: IntakeMode; initialStep?: number }) {
  const router = useRouter();
  const { workspaceId } = useAuth();
  const [activeStep, setActiveStep] = useState(() => Math.min(Math.max(initialStep, 0), STEPS.length - 1));
  const [draft, setDraft] = useState<OpportunityDraft>(() => readSavedDraft(mode));
  const [files, setFiles] = useState<FileState>(() => createEmptyFileState());
  const [analysisState, setAnalysisState] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [restored] = useState(true);
  const latestRfqExtractionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!restored || typeof window === "undefined") return;
    window.localStorage.setItem(`${OPPORTUNITY_DRAFT_STORAGE_KEY}:${mode}`, JSON.stringify(draft));
  }, [draft, mode, restored]);

  const primaryRfqFileAttached = files.rfq.length > 0 || draft.uploadedDocuments.some((document) => document.documentType === "rfq" && document.storagePath);
  const missingRequirements = useMemo(() => {
    const missing = getMissingCreateRequirements(draft).filter((item) => item !== "Primary RFQ/RFP document");
    if (!primaryRfqFileAttached) missing.push("Primary RFQ/RFP document");
    return missing;
  }, [draft, primaryRfqFileAttached]);
  const canCreate = missingRequirements.length === 0 && !creating;
  const completion = getStepCompletion({
    ...draft,
    uploadedDocuments: primaryRfqFileAttached ? draft.uploadedDocuments : draft.uploadedDocuments.filter((document) => document.documentType !== "rfq"),
  });
  const attachedCount = Object.values(files).reduce((count, fileList) => count + fileList.length, 0) + draft.uploadedDocuments.filter((document) => document.storagePath).length;
  const summaryRows = buildOpportunitySummary(draft);
  const activeStepConfig = STEPS[activeStep];
  const hasPrevious = activeStep > 0;
  const hasNext = activeStep < STEPS.length - 1;

  function updateField(key: keyof OpportunityDraftFields, value: string) {
    setDraft((current) => markManualField(current, key, value));
  }

  function addDocuments(documentType: OpportunityDocumentKey, selectedFiles: File[]) {
    const documents: OpportunityUploadedDocument[] = selectedFiles.map((file, index) => ({
      id: `${documentType}-${file.name}-${file.size}-${index}`,
      documentType,
      name: file.name,
      size: file.size,
      contentType: file.type || "application/pdf",
      analysis: null,
    }))
    setDraft((current) => {
      const retained = current.uploadedDocuments.filter((document) => document.documentType !== documentType || document.storagePath)
      return { ...current, uploadedDocuments: [...retained, ...documents], updatedAt: new Date().toISOString() }
    })
  }

  async function analyzePrimaryDocument(file: File, extractionId: string) {
    const key = extractionId
    setAnalysisState({ [key]: "Analyzing" })
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("extractionId", extractionId)
      const response = await authFetch(API_ROUTES.OPPORTUNITY_REGISTER_ANALYZE, { method: "POST", body: formData })
      const payload = (await response.json()) as { extraction?: OpportunityExtractionResult; error?: string }
      if (!response.ok || !payload.extraction) throw new Error(payload.error ?? "Document analysis failed")
      if (latestRfqExtractionIdRef.current !== extractionId) return
      setAnalysisState((current) => ({ ...current, [key]: "Extracted" }))
      setDraft((current) => applyRfqExtractionToDraft(current, { ...payload.extraction, extractionId, documentName: payload.extraction?.documentName ?? file.name }))
    } catch (error) {
      if (latestRfqExtractionIdRef.current !== extractionId) return
      const message = error instanceof Error ? error.message : "Document analysis failed"
      setAnalysisState((current) => ({ ...current, [key]: "Manual review" }))
      setDraft((current) => markRfqExtractionFailed(current, extractionId, message))
      console.error("Opportunity RFQ extraction failed", error)
    }
  }

  async function handleFiles(documentType: OpportunityDocumentKey, event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? [])
    event.target.value = ""

    if (documentType === "rfq") {
      const file = selectedFiles[0]
      if (!file) return
      const sessionDraft = createDraftForRfqExtractionSession({ fileName: file.name, fileSize: file.size, contentType: file.type || "application/pdf" })
      const extractionId = sessionDraft.activeRfqExtractionId ?? sessionDraft.draftId
      latestRfqExtractionIdRef.current = extractionId
      setFiles({ ...createEmptyFileState(), rfq: [file] })
      setAnalysisState({ [extractionId]: "Analyzing" })
      setCreateError(null)
      setDraft(sessionDraft)
      await analyzePrimaryDocument(file, extractionId)
      return
    }

    setFiles((current) => ({ ...current, [documentType]: selectedFiles }))
    addDocuments(documentType, selectedFiles)
  }
  async function createOpportunity() {
    if (!canCreate) return;
    setCreating(true);
    setCreateError(null);
    try {
      const formData = new FormData();
      formData.append("draft", JSON.stringify(draft));
      formData.append("workspaceId", workspaceId ?? "");
      for (const document of DOCUMENTS) {
        for (const file of files[document.key]) formData.append(`file:${document.key}`, file);
      }
      const response = await authFetch(API_ROUTES.OPPORTUNITY_REGISTER, { method: "POST", body: formData });
      const payload = (await response.json()) as { id?: string; error?: string; details?: string; missing?: string[] };
      if (!response.ok || !payload.id) throw new Error(payload.missing?.join(", ") || payload.details || payload.error || "Opportunity creation failed");
      if (typeof window !== "undefined") window.localStorage.removeItem(`${OPPORTUNITY_DRAFT_STORAGE_KEY}:${mode}`);
      router.push(`/dashboard/opportunity-register/${encodeURIComponent(payload.id)}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Opportunity creation failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main data-module="dashboard" className="tex-shell grid gap-6">
      <EnterpriseCard className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--tex-border)] px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="tex-eyebrow">Opportunity intake workflow</p>
              <h1 className="tex-title mt-3">{mode === "new" ? "New Opportunity Intake" : "Upload Opportunity Intake"}</h1>
              <p className="tex-copy mt-3 max-w-3xl text-sm">Capture opportunity details, analyze RFQ/RFP documents, review extracted values, and create the production record.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <EnterpriseStatusBadge value="Operational workflow" tone="success" />
              <EnterpriseStatusBadge value="PDF extraction enabled" tone="info" />
              <EnterpriseStatusBadge value="Backend persistence enabled" tone="success" />
            </div>
          </div>
        </div>
        <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
          <EnterpriseKpiCard label="Current Step" value={`${activeStep + 1} / ${STEPS.length}`} helper={activeStepConfig.label} />
          <EnterpriseKpiCard label="Required Fields" value={`${3 - missingRequirements.filter((item) => item !== "Primary RFQ/RFP document").length} / 3`} helper="Title, client, closing date" />
          <EnterpriseKpiCard label="Documents" value={primaryRfqFileAttached ? "RFQ attached" : "RFQ missing"} helper={`${attachedCount} file${attachedCount === 1 ? "" : "s"} staged or persisted`} />
          <EnterpriseKpiCard label="Workflow State" value={canCreate ? "Create ready" : "Action needed"} helper="Validated against production requirements" />
        </div>
      </EnterpriseCard>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <EnterpriseCard className="p-5">
          <p className="tex-eyebrow">Wizard navigation</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[color:var(--tex-text-strong)]">Step sequence</h2>
          <div className="mt-5 grid gap-3">
            {STEPS.map((step, index) => {
              const status = statusForStep(step.key, index === activeStep, completion);
              return (
                <button key={step.key} type="button" onClick={() => setActiveStep(index)} className={`rounded-2xl border px-4 py-4 text-left transition-all duration-200 ${index === activeStep ? "border-[color:var(--tex-nav-active-border)] bg-[color:var(--tex-nav-active-bg)]" : "border-[color:var(--tex-border)] bg-[color:var(--tex-surface)]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{step.label}</p><p className="mt-1 text-sm text-[color:var(--tex-text-muted)]">{step.detail}</p></div>
                    <EnterpriseStatusBadge value={status} tone={statusTone(status)} />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <EnterpriseKpiCard label="Mode" value={mode === "new" ? "New entry" : "Upload entry"} helper="Production intake" />
            <EnterpriseKpiCard label="Persistence" value="Enabled" helper="Creates deal and document records" />
            <EnterpriseKpiCard label="Control" value="Workflow" helper="Validated backend mutation" />
          </div>
          <div className="mt-5"><EnterpriseActionButton href="/dashboard/opportunity-register" variant="secondary">Back to Register</EnterpriseActionButton></div>
        </EnterpriseCard>

        <EnterprisePanel eyebrow={`Step ${activeStep + 1} of ${STEPS.length}`} title={activeStepConfig.label} action={<EnterpriseStatusBadge value={statusForStep(activeStepConfig.key, true, completion)} tone="info" />}>
          {activeStep === 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {DETAIL_FIELDS.map((field) => (
                <FieldShell key={field.key} label={`${field.label}${field.required ? " *" : ""}`} hint={field.hint}>
                  {field.key === "description" ? (
                    <textarea value={draft[field.key]} onChange={(event) => updateField(field.key, event.target.value)} rows={4} />
                  ) : (
                    <input type={field.type ?? "text"} value={draft[field.key]} onChange={(event) => updateField(field.key, event.target.value)} />
                  )}
                </FieldShell>
              ))}
            </div>
          ) : null}

          {activeStep === 1 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {DOCUMENTS.map((document) => (
                <div key={document.key} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{document.label}</p><p className="tex-copy mt-1 text-sm">{document.helper}</p></div><EnterpriseStatusBadge value={draft.uploadedDocuments.some((item) => item.documentType === document.key) ? "Attached" : "Pending"} tone={draft.uploadedDocuments.some((item) => item.documentType === document.key) ? "success" : "warning"} /></div>
                  <input type="file" accept="application/pdf,.pdf" multiple={document.multiple} onChange={(event) => void handleFiles(document.key, event)} className="mt-4 block w-full cursor-pointer rounded-xl border border-dashed border-[color:var(--tex-border-strong)] bg-[color:var(--tex-card-strong)] px-4 py-3 text-sm text-[color:var(--tex-text-muted)] file:mr-4 file:rounded-full file:border-0 file:bg-[color:var(--tex-primary)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
                  <div className="mt-4 grid gap-2">
                    {draft.uploadedDocuments.filter((item) => item.documentType === document.key).map((file) => <div key={file.id} className="rounded-xl border border-[color:var(--tex-border)] bg-[color:var(--tex-card-strong)] px-3 py-2 text-sm text-[color:var(--tex-text-strong)]">{file.name} {file.analysis ? <EnterpriseStatusBadge value="Metadata extracted" tone="info" /> : null}</div>)}
                    {files[document.key].map((file) => analysisState[`${file.name}:${file.size}`] ? <EnterpriseStatusBadge key={`${file.name}:${file.size}`} value={`${file.name}: ${analysisState[`${file.name}:${file.size}`]}`} tone="info" /> : null)}
                    {!draft.uploadedDocuments.some((item) => item.documentType === document.key) ? <EnterpriseEmptyState title="No files attached" detail="Attach PDFs to stage them for the production record." /> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {activeStep === 2 ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="grid gap-4">
                <EnterpriseTable wrapperClassName="shadow-none"><thead><tr><th>Field</th><th>Value</th><th>Status</th></tr></thead><tbody>{summaryRows.map((row) => <tr key={row.key}><td className="font-semibold text-[color:var(--tex-text-strong)]">{row.label}</td><td>{row.key === "estimatedValue" ? formatCurrency(row.value) : row.value || "Missing"}</td><td><EnterpriseStatusBadge value={row.status === "extracted" ? `Extracted ${row.confidence ? Math.round(row.confidence * 100) + "%" : ""}` : row.status === "manual" ? "Manual" : "Missing"} tone={row.status === "missing" ? "warning" : row.status === "extracted" ? "info" : "success"} /></td></tr>)}</tbody></EnterpriseTable>
                <EnterprisePanel eyebrow="Review and correction" title="Editable extracted values">
                  <div className="grid gap-3 lg:grid-cols-2">{DETAIL_FIELDS.map((field) => <FieldShell key={field.key} label={field.label}><input type={field.type ?? "text"} value={draft[field.key]} onChange={(event) => updateField(field.key, event.target.value)} /></FieldShell>)}</div>
                </EnterprisePanel>
              </div>
              <div className="grid gap-4">
                <EnterprisePanel eyebrow="Create readiness" title={["Required checks", draft.activeRfqFileName, draft.activeRfqExtractionId, draft.rfqExtractionStatus].filter(Boolean).join(" / ")}>
                  {missingRequirements.length ? <div className="grid gap-2">{missingRequirements.map((item) => <EnterpriseStatusBadge key={item} value={`Missing: ${item}`} tone="warning" />)}</div> : <EnterpriseStatusBadge value="All minimum requirements satisfied" tone="success" />}
                  {createError ? <p className="mt-4 text-sm font-semibold text-[color:var(--tex-danger)]">{createError}</p> : null}
                  <div className="mt-5"><EnterpriseActionButton type="button" variant="success" disabled={!canCreate} onClick={() => void createOpportunity()}>{creating ? "Creating..." : "Create Opportunity"}</EnterpriseActionButton></div>
                </EnterprisePanel>
                <EnterprisePanel eyebrow="Documents" title="Source files">
                  <div className="grid gap-3">{DOCUMENTS.map((document) => <div key={document.key} className="flex items-start justify-between gap-3 rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4"><div><p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{document.label}</p><p className="tex-copy mt-1 text-sm">{draft.uploadedDocuments.filter((item) => item.documentType === document.key).map((item) => item.name).join(", ") || "No file attached"}</p></div><EnterpriseStatusBadge value={draft.uploadedDocuments.some((item) => item.documentType === document.key) ? "Attached" : "Pending"} tone={draft.uploadedDocuments.some((item) => item.documentType === document.key) ? "success" : "warning"} /></div>)}</div>
                </EnterprisePanel>
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {hasPrevious ? <EnterpriseActionButton type="button" variant="secondary" onClick={() => setActiveStep((current) => Math.max(current - 1, 0))}>Previous</EnterpriseActionButton> : null}
              {hasNext ? <EnterpriseActionButton type="button" onClick={() => setActiveStep((current) => Math.min(current + 1, STEPS.length - 1))}>{activeStep === 0 ? "Continue to Upload Documents" : "Continue to Summary"}</EnterpriseActionButton> : <EnterpriseActionButton type="button" variant="success" disabled={!canCreate} onClick={() => void createOpportunity()}>{creating ? "Creating..." : "Create Opportunity"}</EnterpriseActionButton>}
            </div>
            <EnterpriseStatusBadge value={canCreate ? "Ready for creation" : "Draft incomplete"} tone={canCreate ? "success" : "warning"} />
          </div>
        </EnterprisePanel>
      </section>
    </main>
  );
}
