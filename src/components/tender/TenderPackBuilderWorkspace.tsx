"use client";

import { useState } from "react";
import {
  EnterpriseActionButton,
  EnterpriseCard,
  EnterpriseEmptyState,
  EnterpriseKpiCard,
  EnterprisePanel,
  EnterpriseStatusBadge,
  EnterpriseTable,
} from "@/components/ui/EnterpriseUI";
import { getTenderPackProgress, tenderPackBuilderState, type TenderPackBuilderState, type TenderPackDocument } from "@/lib/tender/tenderPackBuilder";

function DocumentBadge({ document }: { document: TenderPackDocument }) {
  const tone =
    document.status === "generated" ? "success" : document.status === "missing" ? "danger" : "warning";

  return <EnterpriseStatusBadge value={document.status === "generated" ? "Generated" : document.status === "missing" ? "Missing" : "Required"} tone={tone} />;
}

function ActionButton({ label }: { label: string }) {
  return (
    <EnterpriseActionButton variant="secondary" disabled title="Presentation only">
      {label}
    </EnterpriseActionButton>
  );
}

function BuilderSection({ state }: { state: TenderPackBuilderState }) {
  const progress = getTenderPackProgress(state);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="grid gap-6">
        <EnterprisePanel title="Required Documents" eyebrow="Tender pack inputs">
          <EnterpriseTable>
            <thead>
              <tr>
                <th>Document</th>
                <th>Category</th>
                <th>Status</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {state.requiredDocuments.map((document) => (
                <tr key={document.key}>
                  <td>{document.label}</td>
                  <td>{document.category}</td>
                  <td>
                    <DocumentBadge document={document} />
                  </td>
                  <td>{document.note ?? "Ready for inclusion"}</td>
                </tr>
              ))}
            </tbody>
          </EnterpriseTable>
        </EnterprisePanel>

        <EnterprisePanel title="Generated PDFs" eyebrow="Output set">
          <div className="grid gap-3">
            {state.generatedPdfs.map((pdf) => (
              <div key={pdf.key} className="flex flex-col gap-3 rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{pdf.name}</p>
                  <p className="mt-1 text-xs text-[color:var(--tex-text-muted)]">
                    {pdf.pages} pages · {pdf.size}
                  </p>
                </div>
                <EnterpriseStatusBadge
                  value={pdf.status === "ready" ? "Ready" : pdf.status === "preview" ? "Preview" : "Queued"}
                  tone={pdf.status === "ready" ? "success" : pdf.status === "preview" ? "info" : "warning"}
                />
              </div>
            ))}
          </div>
        </EnterprisePanel>

        <EnterprisePanel title="Missing Documents" eyebrow="Open gaps">
          {state.missingDocuments.length ? (
            <div className="grid gap-3">
              {state.missingDocuments.map((document) => (
                <div key={document.key} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{document.label}</p>
                      <p className="mt-1 text-xs text-[color:var(--tex-text-muted)]">{document.note ?? "Required before pack generation"}</p>
                    </div>
                    <EnterpriseStatusBadge value="Missing" tone="danger" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EnterpriseEmptyState title="No missing documents" detail="The pack inputs are complete." />
          )}
        </EnterprisePanel>
      </div>

      <div className="grid gap-6">
        <EnterprisePanel title="Submission Profile" eyebrow="Profile context">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[color:var(--tex-text-strong)]">{state.profile.label}</h3>
              <p className="mt-2 text-sm text-[color:var(--tex-text-muted)]">{state.profile.summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <EnterpriseStatusBadge value={state.profile.audience} tone="info" />
              <EnterpriseStatusBadge value={state.profile.packageType} tone="review" />
              <EnterpriseStatusBadge value={state.profile.compliance} tone="success" />
            </div>
          </div>
        </EnterprisePanel>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <EnterpriseKpiCard label="Pack Progress" value={`${progress}%`} helper="Mock completion state" />
          <EnterpriseKpiCard label="Required Documents" value={state.requiredDocuments.length} helper="Documents tracked in builder" />
        </section>

        <EnterprisePanel title="Actions" eyebrow="Presentation only">
          <div className="grid gap-3">
            <ActionButton label="Generate Pack" />
            <ActionButton label="Preview" />
            <ActionButton label="Download" />
            <ActionButton label="Email Contractor" />
          </div>
        </EnterprisePanel>

        <EnterprisePanel title="Pack Progress" eyebrow="Mock workflow">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-[color:var(--tex-text-strong)]">Overall completion</span>
                <span className="text-[color:var(--tex-text-muted)]">{progress}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[color:var(--tex-surface-muted)]">
                <div className="h-2 rounded-full bg-[color:var(--tex-accent)]" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
                <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">Documents collected</p>
                <p className="mt-1 text-xs text-[color:var(--tex-text-muted)]">5 of 7 required documents ready for assembly.</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
                <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">PDF assembly</p>
                <p className="mt-1 text-xs text-[color:var(--tex-text-muted)]">Four generated PDFs staged for pack export.</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
                <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">Submission review</p>
                <p className="mt-1 text-xs text-[color:var(--tex-text-muted)]">Awaiting final sign-off and contractor notification.</p>
              </div>
            </div>
          </div>
        </EnterprisePanel>
      </div>
    </div>
  );
}

export default function TenderPackBuilderWorkspace() {
  const [state] = useState(tenderPackBuilderState);

  return (
    <main className="space-y-6 p-4 md:p-6">
      <EnterpriseCard className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--tex-border)] px-6 py-5">
          <p className="tex-eyebrow">Tender Pack workspace</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="tex-title">{state.title}</h1>
              <p className="tex-copy mt-3 max-w-3xl text-sm">
                Presentation-only builder for assembling tender pack inputs, reviewing generated PDFs and tracking submission readiness.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <EnterpriseStatusBadge value={state.reference} tone="neutral" />
              <EnterpriseStatusBadge value="Mock data only" tone="success" />
            </div>
          </div>
        </div>
      </EnterpriseCard>

      <section className="grid gap-4 md:grid-cols-3">
        <EnterpriseKpiCard label="Required Documents" value={state.requiredDocuments.length} helper="Input items for the pack" />
        <EnterpriseKpiCard label="Generated PDFs" value={state.generatedPdfs.length} helper="Staged output files" />
        <EnterpriseKpiCard label="Missing Documents" value={state.missingDocuments.length} helper="Open pack gaps" />
      </section>

      <BuilderSection state={state} />
    </main>
  );
}
