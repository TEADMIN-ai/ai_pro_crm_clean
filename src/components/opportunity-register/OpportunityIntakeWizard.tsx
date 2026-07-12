"use client";

import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  EnterpriseActionButton,
  EnterpriseCard,
  EnterpriseEmptyState,
  EnterpriseKpiCard,
  EnterprisePanel,
  EnterpriseStatusBadge,
  EnterpriseTable,
} from "@/components/ui/EnterpriseUI";

type IntakeMode = "new" | "upload";
type StepKey = "details" | "documents" | "summary";
type DocumentKey = "rfq" | "boq" | "annexures" | "sbd" | "supporting";

type IntakeDraft = {
  rfqNumber: string;
  title: string;
  client: string;
  municipality: string;
  department: string;
  closingDate: string;
  estimatedValue: string;
};

type DocumentState = Record<DocumentKey, string[]>;

function documentLabel(documentKey: DocumentKey) {
  const match = DOCUMENTS.find((document) => document.key === documentKey);
  return match?.label ?? documentKey;
}

const STEPS: Array<{ key: StepKey; label: string; detail: string }> = [
  { key: "details", label: "Opportunity Details", detail: "Capture the opportunity record" },
  { key: "documents", label: "Upload", detail: "Attach the source documents" },
  { key: "summary", label: "Summary", detail: "Review everything before creation" },
];

const DOCUMENTS: Array<{ key: DocumentKey; label: string; helper: string; multiple?: boolean }> = [
  { key: "rfq", label: "RFQ", helper: "Request for quotation or proposal notice", multiple: false },
  { key: "boq", label: "BOQ", helper: "Bill of quantities or pricing schedule pack", multiple: false },
  { key: "annexures", label: "Annexures", helper: "Appendices, schedules, and annexures", multiple: true },
  { key: "sbd", label: "Pricing Schedule", helper: "Commercial schedule and pricing sheets", multiple: true },
  { key: "supporting", label: "Supporting Documents", helper: "Reference material and uploads", multiple: true },
];

const INITIAL_DRAFT: IntakeDraft = {
  rfqNumber: "",
  title: "",
  client: "",
  municipality: "",
  department: "",
  closingDate: "",
  estimatedValue: "",
};

function createEmptyDocumentState(): DocumentState {
  return {
    rfq: [],
    boq: [],
    annexures: [],
    sbd: [],
    supporting: [],
  };
}

function formatCurrency(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "Not entered";
  }

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(parsed);
}

function fieldCompletion(draft: IntakeDraft): number {
  const values = Object.values(draft);
  const complete = values.filter((value) => value.trim().length > 0).length;
  return Math.round((complete / values.length) * 100);
}

function documentCompletion(documents: DocumentState): number {
  const complete = Object.values(documents).filter((files) => files.length > 0).length;
  return Math.round((complete / DOCUMENTS.length) * 100);
}

function stepStatus(active: number, index: number) {
  if (index < active) return "Completed";
  if (index === active) return "Active";
  return "Pending";
}

function stepTone(active: number, index: number) {
  if (index < active) return "success";
  if (index === active) return "info";
  return "neutral";
}

function nextStepLabel(active: number) {
  return active === 0 ? "Continue to Upload Documents" : "Continue to Summary";
}

function FieldShell({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--tex-text-muted)]">{label}</span>
      {children}
      {hint ? <span className="text-xs text-[color:var(--tex-text-muted)]">{hint}</span> : null}
    </label>
  );
}

function DocumentSlot({
  label,
  helper,
  files,
  multiple,
  onChange,
}: {
  label: string;
  helper: string;
  files: string[];
  multiple?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{label}</p>
          <p className="tex-copy mt-1 text-sm">{helper}</p>
        </div>
        <EnterpriseStatusBadge value={files.length > 0 ? `${files.length} attached` : "Pending"} tone={files.length > 0 ? "success" : "warning"} />
      </div>
      <div className="mt-4">
        <input
          type="file"
          multiple={multiple}
          onChange={onChange}
          className="block w-full cursor-pointer rounded-xl border border-dashed border-[color:var(--tex-border-strong)] bg-[color:var(--tex-card-strong)] px-4 py-3 text-sm text-[color:var(--tex-text-muted)] file:mr-4 file:rounded-full file:border-0 file:bg-[color:var(--tex-primary)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
      </div>
      <div className="mt-4 grid gap-2">
        {files.length ? (
          files.map((file) => (
            <div key={file} className="rounded-xl border border-[color:var(--tex-border)] bg-[color:var(--tex-card-strong)] px-3 py-2 text-sm text-[color:var(--tex-text-strong)]">
              {file}
            </div>
          ))
        ) : (
          <EnterpriseEmptyState title="No files attached" detail="Attach files locally to stage the intake review." />
        )}
      </div>
    </div>
  );
}

export default function OpportunityIntakeWizard({
  mode,
  initialStep = 0,
}: {
  mode: IntakeMode;
  initialStep?: number;
}) {
  const [activeStep, setActiveStep] = useState(() => Math.min(Math.max(initialStep, 0), STEPS.length - 1));
  const [draft, setDraft] = useState<IntakeDraft>(INITIAL_DRAFT);
  const [documents, setDocuments] = useState<DocumentState>(() => createEmptyDocumentState());

  const detailProgress = fieldCompletion(draft);
  const uploadProgress = documentCompletion(documents);
  const intakeReadiness = Math.round(detailProgress * 0.6 + uploadProgress * 0.4);
  const attachedCount = Object.values(documents).reduce((count, files) => count + files.length, 0);

  const headerTitle = mode === "new" ? "New Opportunity Intake" : "Upload Opportunity Intake";
  const headerDescription =
    mode === "new"
      ? "Create the opportunity record shell and prepare the intake package for review."
      : "Stage the intake by attaching the source documents before summary review.";

  const activeStepConfig = STEPS[activeStep];

  const summaryRows = useMemo(
    () => [
      ["RFQ / RFP Number", draft.rfqNumber || "Not entered"],
      ["Opportunity Title", draft.title || "Not entered"],
      ["Client", draft.client || "Not entered"],
      ["Municipality", draft.municipality || "Not entered"],
      ["Department", draft.department || "Not entered"],
      ["Closing Date", draft.closingDate || "Not entered"],
      ["Estimated Value", formatCurrency(draft.estimatedValue)],
    ],
    [draft]
  );

  const documentRows = useMemo(
    () =>
      DOCUMENTS.map((document) => ({
        label: document.label,
        helper: document.helper,
        files: documents[document.key],
      })),
    [documents]
  );

  const hasPrevious = activeStep > 0;
  const hasNext = activeStep < STEPS.length - 1;

  const advance = () => setActiveStep((current) => Math.min(current + 1, STEPS.length - 1));
  const retreat = () => setActiveStep((current) => Math.max(current - 1, 0));

  return (
    <main data-module="dashboard" className="tex-shell grid gap-6">
      <EnterpriseCard className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--tex-border)] px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="tex-eyebrow">Opportunity intake workflow</p>
              <h1 className="tex-title mt-3">{headerTitle}</h1>
              <p className="tex-copy mt-3 max-w-3xl text-sm">{headerDescription}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <EnterpriseStatusBadge value="Presentation only" tone="neutral" />
              <EnterpriseStatusBadge value="No OCR" tone="warning" />
              <EnterpriseStatusBadge value="No AI" tone="warning" />
              <EnterpriseStatusBadge value="No backend mutations" tone="success" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
          <EnterpriseKpiCard label="Current Step" value={`${activeStep + 1} / ${STEPS.length}`} helper={activeStepConfig.label} trend={activeStepConfig.detail} />
          <EnterpriseKpiCard label="Opportunity Details" value={`${detailProgress}%`} helper="Fields captured in the wizard" trend="Local form state" />
          <EnterpriseKpiCard label="Document Uploads" value={`${uploadProgress}%`} helper="Uploaded categories staged locally" trend="Upload surface" />
          <EnterpriseKpiCard label="Intake Readiness" value={`${intakeReadiness}%`} helper={`${attachedCount} file${attachedCount === 1 ? "" : "s"} attached`} trend="Review ready" />
        </div>
      </EnterpriseCard>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <EnterpriseCard className="p-5">
          <p className="tex-eyebrow">Wizard navigation</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[color:var(--tex-text-strong)]">Step sequence</h2>
          <div className="mt-5 grid gap-3">
            {STEPS.map((step, index) => {
              const active = index === activeStep;

              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  className={`rounded-2xl border px-4 py-4 text-left transition-all duration-200 ${
                    active
                      ? "border-[color:var(--tex-nav-active-border)] bg-[color:var(--tex-nav-active-bg)] shadow-[0_14px_34px_rgba(37,99,235,0.12)]"
                      : "border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] hover:border-[color:var(--tex-nav-active-border)] hover:bg-[color:var(--tex-nav-hover-bg)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{step.label}</p>
                      <p className="mt-1 text-sm text-[color:var(--tex-text-muted)]">{step.detail}</p>
                    </div>
                    <EnterpriseStatusBadge value={stepStatus(activeStep, index)} tone={stepTone(activeStep, index)} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <EnterpriseKpiCard label="Mode" value={mode === "new" ? "New entry" : "Upload entry"} helper="Shared wizard surface" />
            <EnterpriseKpiCard label="Read Only" value="Yes" helper="No backend persistence" />
            <EnterpriseKpiCard label="Control" value="Presentation" helper="No workflow mutations" />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <EnterpriseActionButton href="/dashboard/opportunity-register" variant="secondary">
              Back to Register
            </EnterpriseActionButton>
          </div>
        </EnterpriseCard>

        <EnterprisePanel
          eyebrow={`Step ${activeStep + 1} of ${STEPS.length}`}
          title={activeStepConfig.label}
          action={<EnterpriseStatusBadge value={stepStatus(activeStep, activeStep)} tone="info" />}
        >
          {activeStep === 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <FieldShell label="RFQ Number" hint="Capture the source reference exactly as supplied.">
                <input
                  value={draft.rfqNumber}
                  onChange={(event) => setDraft((current) => ({ ...current, rfqNumber: event.target.value }))}
                  placeholder="RFQ-2026-001"
                />
              </FieldShell>
              <FieldShell label="Title" hint="Working title for the opportunity.">
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Facilities maintenance and cleaning"
                />
              </FieldShell>
              <FieldShell label="Client" hint="Municipality, department, private client, or enterprise owner.">
                <input
                  value={draft.client}
                  onChange={(event) => setDraft((current) => ({ ...current, client: event.target.value }))}
                  placeholder="City of Johannesburg"
                />
              </FieldShell>
              <FieldShell label="Municipality" hint="Primary municipality tied to the opportunity.">
                <input
                  value={draft.municipality}
                  onChange={(event) => setDraft((current) => ({ ...current, municipality: event.target.value }))}
                  placeholder="Johannesburg"
                />
              </FieldShell>
              <FieldShell label="Department" hint="Department or business unit.">
                <input
                  value={draft.department}
                  onChange={(event) => setDraft((current) => ({ ...current, department: event.target.value }))}
                  placeholder="Public Works"
                />
              </FieldShell>
              <FieldShell label="Closing Date" hint="Calendar date for the submission deadline.">
                <input
                  type="date"
                  value={draft.closingDate}
                  onChange={(event) => setDraft((current) => ({ ...current, closingDate: event.target.value }))}
                />
              </FieldShell>
              <FieldShell label="Estimated Value" hint="Nominal commercial value for the intake record.">
                <input
                  type="number"
                  inputMode="decimal"
                  value={draft.estimatedValue}
                  onChange={(event) => setDraft((current) => ({ ...current, estimatedValue: event.target.value }))}
                  placeholder="18000000"
                />
              </FieldShell>
            </div>
          ) : null}

          {activeStep === 1 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {DOCUMENTS.map((document) => (
                <DocumentSlot
                  key={document.key}
                  label={document.label}
                  helper={document.helper}
                  multiple={document.multiple}
                  files={documents[document.key]}
                  onChange={(event) =>
                    setDocuments((current) => ({
                      ...current,
                      [document.key]: Array.from(event.target.files ?? []).map((file) => file.name),
                    }))
                  }
                />
              ))}
            </div>
          ) : null}

          {activeStep === 2 ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="grid gap-4">
                <EnterpriseTable wrapperClassName="shadow-none">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map(([label, value]) => (
                      <tr key={label}>
                        <td className="font-semibold text-[color:var(--tex-text-strong)]">{label}</td>
                        <td>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </EnterpriseTable>

                <EnterpriseTable wrapperClassName="shadow-none">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Files</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentRows.map((document) => (
                      <tr key={document.label}>
                        <td>
                          <p className="font-semibold text-[color:var(--tex-text-strong)]">{document.label}</p>
                          <p className="text-xs text-[color:var(--tex-text-muted)]">{document.helper}</p>
                        </td>
                        <td>
                          {document.files.length > 0 ? (
                            <div className="grid gap-2">
                              {document.files.map((file) => (
                                <div key={file} className="rounded-xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] px-3 py-2 text-sm text-[color:var(--tex-text-strong)]">
                                  {file}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <EnterpriseStatusBadge value="Pending" tone="warning" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </EnterpriseTable>

                <EnterpriseEmptyState
                  title="Summary is presentation only."
                  detail="This intake wizard stages the opportunity data and documents locally. No OCR, AI, or backend mutation runs here."
                />
              </div>

              <div className="grid gap-4">
                <EnterprisePanel eyebrow="Document coverage" title="Upload status">
                  <div className="grid gap-3">
                    {DOCUMENTS.map((document) => (
                      <div key={document.key} className="flex items-start justify-between gap-3 rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{document.label}</p>
                          <p className="tex-copy mt-1 text-sm">{document.helper}</p>
                        </div>
                        <EnterpriseStatusBadge value={documents[document.key].length > 0 ? "Attached" : "Pending"} tone={documents[document.key].length > 0 ? "success" : "warning"} />
                      </div>
                    ))}
                  </div>
                </EnterprisePanel>

                <EnterprisePanel eyebrow="Intake controls" title="Workflow actions">
                  <div className="flex flex-wrap gap-2">
                    {hasPrevious ? (
                      <EnterpriseActionButton type="button" variant="secondary" onClick={retreat}>
                        Previous
                      </EnterpriseActionButton>
                    ) : null}
                    {hasNext ? (
                      <EnterpriseActionButton type="button" onClick={advance}>
                        Continue to Summary
                      </EnterpriseActionButton>
                    ) : (
                      <EnterpriseActionButton type="button" disabled>
                        Create Opportunity
                      </EnterpriseActionButton>
                    )}
                  </div>
                </EnterprisePanel>
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {hasPrevious ? (
                <EnterpriseActionButton type="button" variant="secondary" onClick={retreat}>
                  Previous
                </EnterpriseActionButton>
              ) : null}
              {hasNext ? (
                <EnterpriseActionButton type="button" onClick={advance}>
                  {nextStepLabel(activeStep)}
                </EnterpriseActionButton>
              ) : (
                <EnterpriseActionButton type="button" disabled>
                  Create Opportunity
                </EnterpriseActionButton>
              )}
            </div>
            <EnterpriseStatusBadge
              value={activeStep === 2 ? "Ready for creation" : "Draft only"}
              tone={activeStep === 2 ? "success" : "neutral"}
            />
          </div>
        </EnterprisePanel>
      </section>
    </main>
  );
}


