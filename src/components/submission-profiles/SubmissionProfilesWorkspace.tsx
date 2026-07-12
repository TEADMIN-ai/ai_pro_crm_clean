"use client";

import { useState } from "react";

import {
  EnterpriseCard,
  EnterpriseKpiCard,
  EnterprisePanel,
  EnterpriseStatusBadge,
  EnterpriseTable,
} from "@/components/ui/EnterpriseUI";
import {
  getSubmissionProfilePackSet,
  submissionProfiles,
  type SubmissionPackDefinition,
  type SubmissionProfileDefinition,
  type SubmissionProfileKey,
} from "@/lib/submission-profiles";

function TabButton({
  profile,
  selected,
  onSelect,
}: {
  profile: SubmissionProfileDefinition;
  selected: boolean;
  onSelect: (key: SubmissionProfileKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(profile.key)}
      className={[
        "rounded-full border px-4 py-2 text-sm font-semibold transition",
        selected
          ? "border-[color:var(--tex-nav-active-border)] bg-[color:var(--tex-nav-active-bg)] text-[color:var(--tex-text-strong)]"
          : "border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] text-[color:var(--tex-text-muted)] hover:bg-[color:var(--tex-surface-muted)]",
      ].join(" ")}
    >
      {profile.label}
    </button>
  );
}

function PackCard({ pack }: { pack: SubmissionPackDefinition }) {
  return (
    <EnterpriseCard className="p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="tex-eyebrow">
            {pack.audience === "external"
              ? "External Output"
              : pack.audience === "contractor"
                ? "Contractor Output"
                : "Internal Output"}
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-[color:var(--tex-text-strong)]">{pack.title}</h3>
          <p className="tex-copy mt-2 text-sm">{pack.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EnterpriseStatusBadge value={pack.includeBranding ? "Branding on" : "No branding"} tone={pack.includeBranding ? "success" : "neutral"} />
          <EnterpriseStatusBadge value={pack.includeAiPages ? "AI pages" : "No AI pages"} tone={pack.includeAiPages ? "info" : "neutral"} />
          <EnterpriseStatusBadge value={pack.includeWorkflowPages ? "Workflow pages" : "No workflow pages"} tone={pack.includeWorkflowPages ? "review" : "neutral"} />
        </div>
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {pack.sections.map((section) => (
          <div key={section.title} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--tex-text-muted)]">{section.title}</p>
            <p className="mt-2 text-sm text-[color:var(--tex-text-muted)]">{section.detail}</p>
            <ul className="mt-4 space-y-2 text-sm text-[color:var(--tex-text-strong)]">
              {section.items.map((item) => (
                <li key={item} className="rounded-xl border border-[color:var(--tex-border)] bg-white px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </EnterpriseCard>
  );
}

export default function SubmissionProfilesWorkspace() {
  const [selectedProfileKey, setSelectedProfileKey] = useState<SubmissionProfileKey>("government");
  const selectedSet = getSubmissionProfilePackSet(selectedProfileKey);

  const requiredDocumentCount = selectedSet.profile.requiredDocuments.length;
  const requiredFormCount = selectedSet.profile.requiredForms.length;
  const validationRuleCount = selectedSet.profile.validationRules.length;

  return (
    <main data-module="dashboard" className="tex-shell grid gap-6">
      <EnterpriseCard className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--tex-border)] px-6 py-5">
          <p className="tex-eyebrow">Reusable submission architecture</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="tex-title">Submission Profiles</h1>
              <p className="tex-copy mt-3 max-w-3xl text-sm">
                Profile-driven submission structures for government, municipal, private, corporate and construction submissions.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <EnterpriseStatusBadge value="Presentation only" tone="neutral" />
              <EnterpriseStatusBadge value="No API changes" tone="success" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 px-6 py-4">
          {submissionProfiles.map((profile) => (
            <TabButton key={profile.key} profile={profile} selected={profile.key === selectedProfileKey} onSelect={setSelectedProfileKey} />
          ))}
        </div>
      </EnterpriseCard>

      <section className="grid gap-4 md:grid-cols-4">
        <EnterpriseKpiCard
          label="Required documents"
          value={requiredDocumentCount}
          helper={selectedSet.profile.requiredDocuments.filter((item) => item.mandatory).length + " mandatory"}
        />
        <EnterpriseKpiCard
          label="Required forms"
          value={requiredFormCount}
          helper={selectedSet.profile.requiredForms.filter((item) => item.mandatory).length + " mandatory"}
        />
        <EnterpriseKpiCard
          label="Readiness"
          value={selectedSet.profile.readinessClassification}
          helper="Profile-level release classification"
        />
        <EnterpriseKpiCard label="Validation rules" value={validationRuleCount} helper="Presentation-only rule set" />
      </section>

      <EnterprisePanel title="Selected profile" eyebrow={selectedSet.profile.label}>
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-4">
            <p className="tex-copy text-sm leading-7">{selectedSet.profile.summary}</p>
            <div className="flex flex-wrap gap-2">
              <EnterpriseStatusBadge value={selectedSet.profile.audience} tone="info" />
              <EnterpriseStatusBadge value={selectedSet.profile.readinessClassification} tone="success" />
              <EnterpriseStatusBadge value={selectedSet.profile.namingConvention} tone="review" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--tex-text-muted)]">Page order</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedSet.profile.pageOrder.map((step) => (
                  <span key={step} className="rounded-full border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] px-3 py-1 text-sm text-[color:var(--tex-text-strong)]">
                    {step}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--tex-text-muted)]">Signature requirements</p>
            <ul className="mt-4 space-y-3 text-sm text-[color:var(--tex-text-strong)]">
              {selectedSet.profile.signatureRequirements.map((item) => (
                <li key={item.role} className="rounded-xl border border-[color:var(--tex-border)] bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{item.role}</span>
                    <EnterpriseStatusBadge value={item.count + " required"} tone="neutral" />
                  </div>
                  {item.note ? <p className="mt-2 text-xs text-[color:var(--tex-text-muted)]">{item.note}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </EnterprisePanel>

      <EnterprisePanel title="Validation rules" eyebrow="Profile controls">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {selectedSet.profile.validationRules.map((rule) => (
            <div key={rule.key} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
              <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{rule.label}</p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--tex-text-muted)]">{rule.detail}</p>
            </div>
          ))}
        </div>
      </EnterprisePanel>

      <EnterprisePanel title="Pack set" eyebrow="Generated packs">
        <div className="grid gap-4">
          {selectedSet.packs.map((pack) => (
            <PackCard key={selectedSet.profile.key + "-" + pack.key} pack={pack} />
          ))}
        </div>
      </EnterprisePanel>

      <EnterprisePanel title="Document requirements" eyebrow="Reference matrix">
        <EnterpriseTable>
          <thead>
            <tr>
              <th>Requirement</th>
              <th>Mandatory</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {selectedSet.profile.requiredDocuments.map((item) => (
              <tr key={item.key}>
                <td>{item.label}</td>
                <td>
                  <EnterpriseStatusBadge value={item.mandatory ? "Required" : "Optional"} tone={item.mandatory ? "warning" : "neutral"} />
                </td>
                <td>{item.note ? item.note : "-"}</td>
              </tr>
            ))}
            {selectedSet.profile.requiredForms.map((item) => (
              <tr key={item.key}>
                <td>{item.label}</td>
                <td>
                  <EnterpriseStatusBadge value={item.mandatory ? "Required" : "Optional"} tone={item.mandatory ? "warning" : "neutral"} />
                </td>
                <td>{item.note ? item.note : "-"}</td>
              </tr>
            ))}
            {selectedSet.profile.annexures.map((item) => (
              <tr key={item.key}>
                <td>{item.label}</td>
                <td>
                  <EnterpriseStatusBadge value="Annexure" tone="info" />
                </td>
                <td>{item.note ? item.note : "Supporting attachment"}</td>
              </tr>
            ))}
          </tbody>
        </EnterpriseTable>
      </EnterprisePanel>
    </main>
  );
}


