"use client";

import {
  EnterpriseActionButton,
  EnterpriseCard,
  EnterpriseEmptyState,
  EnterpriseKpiCard,
  EnterprisePanel,
  EnterpriseStatusBadge,
  EnterpriseTable,
} from "@/components/ui/EnterpriseUI";
import { submissionReviewState, type SubmissionReviewState } from "@/lib/submission-review";

function toneForDocument(status: SubmissionReviewState["requiredDocuments"][number]["status"]) {
  if (status === "ready") return "success";
  if (status === "missing") return "danger";
  return "warning";
}

function toneForValidation(status: SubmissionReviewState["validation"][number]["status"]) {
  if (status === "pass") return "success";
  if (status === "fail") return "danger";
  return "warning";
}

function toneForSignature(status: SubmissionReviewState["signatures"][number]["status"]) {
  if (status === "complete") return "success";
  if (status === "waiting") return "warning";
  return "review";
}

function toneForApprover(status: SubmissionReviewState["approvers"][number]["status"]) {
  if (status === "approved") return "success";
  if (status === "waiting") return "warning";
  return "review";
}

function toneForTimeline(status: SubmissionReviewState["approvalTimeline"][number]["status"]) {
  if (status === "done") return "success";
  if (status === "active") return "review";
  return "neutral";
}

export default function SubmissionReviewWorkspace() {
  const state = submissionReviewState;

  return (
    <main className="space-y-6 p-4 md:p-6">
      <EnterpriseCard className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--tex-border)] px-6 py-5">
          <p className="tex-eyebrow">Submission review workspace</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="tex-title">{state.title}</h1>
              <p className="tex-copy mt-3 max-w-3xl text-sm">
                Presentation-only review of readiness, validation, signatures, BOQ, pricing, and approval flow.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <EnterpriseStatusBadge value={state.reference} tone="neutral" />
              <EnterpriseStatusBadge value={state.submissionProfile} tone="info" />
              <EnterpriseStatusBadge value={state.status} tone="review" />
            </div>
          </div>
        </div>
      </EnterpriseCard>

      <section className="grid gap-4 md:grid-cols-4">
        <EnterpriseKpiCard label="Submission Readiness" value={`${state.readiness}%`} helper="Mock readiness state" />
        <EnterpriseKpiCard label="Required Documents" value={state.requiredDocuments.length} helper="Tracked for this review" />
        <EnterpriseKpiCard label="Missing Documents" value={state.missingDocuments.length} helper="Open items remain" />
        <EnterpriseKpiCard label="Status" value={state.status} helper="Presentation-only lifecycle state" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-6">
          <EnterprisePanel title="Required Documents" eyebrow="Submission inputs">
            <EnterpriseTable>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Category</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {state.requiredDocuments.map((document) => (
                  <tr key={document.key}>
                    <td>{document.label}</td>
                    <td>{document.category}</td>
                    <td>
                      <EnterpriseStatusBadge value={document.status === "ready" ? "Ready" : document.status === "missing" ? "Missing" : "Pending"} tone={toneForDocument(document.status)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </EnterpriseTable>
          </EnterprisePanel>

          <EnterprisePanel title="Missing Documents" eyebrow="Open gaps">
            {state.missingDocuments.length ? (
              <div className="grid gap-3">
                {state.missingDocuments.map((document) => (
                  <div key={document.key} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{document.label}</p>
                        <p className="mt-1 text-xs text-[color:var(--tex-text-muted)]">{document.note}</p>
                      </div>
                      <EnterpriseStatusBadge value="Missing" tone="danger" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EnterpriseEmptyState title="No missing documents" detail="All required files have been staged." />
            )}
          </EnterprisePanel>

          <EnterprisePanel title="Validation" eyebrow="Checks">
            <div className="grid gap-3">
              {state.validation.map((item) => (
                <div key={item.key} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{item.label}</p>
                    <EnterpriseStatusBadge value={item.status.toUpperCase()} tone={toneForValidation(item.status)} />
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--tex-text-muted)]">{item.detail}</p>
                </div>
              ))}
            </div>
          </EnterprisePanel>

          <EnterprisePanel title="Signatures" eyebrow="Sign-off set">
            <div className="grid gap-3">
              {state.signatures.map((item) => (
                <div key={item.key} className="flex flex-col gap-3 rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{item.role}</p>
                    <p className="mt-1 text-xs text-[color:var(--tex-text-muted)]">
                      {item.signer}
                      {item.note ? ` - ${item.note}` : ""}
                    </p>
                  </div>
                  <EnterpriseStatusBadge value={item.status.toUpperCase()} tone={toneForSignature(item.status)} />
                </div>
              ))}
            </div>
          </EnterprisePanel>

          <EnterprisePanel title="BOQ" eyebrow="Commercial structure">
            <EnterpriseTable>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Unit Rate</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {state.boq.map((row) => (
                  <tr key={row.key}>
                    <td>{row.item}</td>
                    <td>{row.quantity}</td>
                    <td>{row.unitRate}</td>
                    <td>{row.amount}</td>
                    <td>
                      <EnterpriseStatusBadge value={row.status === "confirmed" ? "Confirmed" : "Pending"} tone={row.status === "confirmed" ? "success" : "warning"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </EnterpriseTable>
          </EnterprisePanel>

          <EnterprisePanel title="Pricing" eyebrow="Commercial totals">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <EnterpriseKpiCard label="Subtotal" value={state.pricing.subtotal} />
              <EnterpriseKpiCard label="Contingency" value={state.pricing.contingency} />
              <EnterpriseKpiCard label="VAT" value={state.pricing.vat} />
              <EnterpriseKpiCard label="Total" value={state.pricing.total} />
            </div>
          </EnterprisePanel>
        </div>

        <div className="grid gap-6">
          <EnterprisePanel title="Approval Timeline" eyebrow="Workflow">
            <div className="space-y-3">
              {state.approvalTimeline.map((item) => (
                <div key={item.key} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{item.stage}</p>
                    <EnterpriseStatusBadge value={item.status.toUpperCase()} tone={toneForTimeline(item.status)} />
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--tex-text-muted)]">{item.detail}</p>
                  <p className="mt-2 text-xs text-[color:var(--tex-text-muted)]">{item.timestamp}</p>
                </div>
              ))}
            </div>
          </EnterprisePanel>

          <EnterprisePanel title="Approvers" eyebrow="Decision chain">
            <div className="space-y-3">
              {state.approvers.map((approver) => (
                <div key={approver.key} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{approver.name}</p>
                      <p className="mt-1 text-xs text-[color:var(--tex-text-muted)]">{approver.role}</p>
                    </div>
                    <EnterpriseStatusBadge value={approver.status.toUpperCase()} tone={toneForApprover(approver.status)} />
                  </div>
                  {approver.timestamp ? <p className="mt-2 text-xs text-[color:var(--tex-text-muted)]">{approver.timestamp}</p> : null}
                </div>
              ))}
            </div>
          </EnterprisePanel>

          <EnterprisePanel title="Status" eyebrow="Current state">
            <div className="space-y-3">
              <div className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
                <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">Review stage</p>
                <p className="mt-1 text-sm text-[color:var(--tex-text-muted)]">Waiting for approvals and signature closure.</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
                <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">Pack release</p>
                <p className="mt-1 text-sm text-[color:var(--tex-text-muted)]">Final pack generation remains staged until approval completes.</p>
              </div>
            </div>
          </EnterprisePanel>

          <EnterprisePanel title="Actions" eyebrow="Presentation only">
            <div className="grid gap-3">
              <EnterpriseActionButton variant="success" disabled title="Presentation only">
                Approve
              </EnterpriseActionButton>
              <EnterpriseActionButton variant="danger" disabled title="Presentation only">
                Reject
              </EnterpriseActionButton>
              <EnterpriseActionButton variant="secondary" disabled title="Presentation only">
                Request Changes
              </EnterpriseActionButton>
              <EnterpriseActionButton variant="secondary" disabled title="Presentation only">
                Generate Final Pack
              </EnterpriseActionButton>
            </div>
          </EnterprisePanel>
        </div>
      </section>
    </main>
  );
}
