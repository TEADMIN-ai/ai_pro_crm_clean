import type { ReactNode } from 'react';
import { EnterpriseEmptyState, EnterprisePanel, EnterpriseStatusBadge } from '@/components/ui/EnterpriseUI';

function SectionBadge({ label, tone = 'neutral' as const }: { label: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  return <EnterpriseStatusBadge value={label} tone={tone} />;
}

function ActionButton({ label, future = false }: { label: string; future?: boolean }) {
  return (
    <button type="button" disabled className="tex-action-button tex-action-button--secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60">
      {label}{future ? ' (future)' : ''}
    </button>
  );
}

const PACK_CONTENTS = [
  'Tender pack PDF',
  'Submission profile sheet',
  'Required declarations',
  'Supporting forms',
  'BOQ attachment',
  'Contractor reference bundle',
];

const OUTSTANDING_ACTIONS = [
  'Review all generated pack sections',
  'Confirm pack completeness with the source system',
  'Verify submission deadline source',
  'Await email backend activation before sending',
];
export default function ContractorDeliveryWorkspace({ contractorId }: { contractorId?: string | null }) {
  return (
    <EnterprisePanel title="Contractor Delivery" eyebrow="After approval" className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <SectionBadge label="Approved context" tone="success" />
        <SectionBadge label="Presentation only" tone="info" />
        <SectionBadge label="No email implementation" tone="warning" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
        <div className="grid gap-5">
          <section className="rounded-xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface-muted)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="tex-eyebrow">Tender pack ready</p>
                <h2 className="mt-1 text-xl font-bold text-[color:var(--tex-text-strong)]">Tender Pack Ready</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--tex-text-muted)]">{contractorId ? `Delivery context is linked to contractor ${contractorId}.` : 'Delivery context is linked to the contractor workspace.'}</p>
              </div>
              <SectionBadge label="Source required" tone="neutral" />
            </div>
            <div className="mt-4 rounded-2xl border border-[color:var(--tex-border)] bg-white p-4">
              <EnterpriseEmptyState title="Tender pack state not connected" detail="The approval gate and pack readiness indicators are registered here as presentation-only placeholders." />
            </div>
          </section>

          <section className="rounded-xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface-muted)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="tex-eyebrow">Submission profile</p>
                <h2 className="mt-1 text-xl font-bold text-[color:var(--tex-text-strong)]">Submission Profile</h2>
              </div>
              <SectionBadge label="Reusable view" tone="info" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                ['Profile source', 'Awaiting linked submission profile'],
                ['Approval state', 'Approved handover shell'],
                ['Delivery mode', 'Contractor-facing presentation'],
                ['Pack version', 'Source-controlled pack set'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-[color:var(--tex-border)] bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--tex-text-muted)]">{label}</p>
                  <p className="mt-2 text-sm font-semibold text-[color:var(--tex-text-strong)]">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface-muted)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="tex-eyebrow">Pack contents</p>
                <h2 className="mt-1 text-xl font-bold text-[color:var(--tex-text-strong)]">Pack Contents</h2>
              </div>
              <SectionBadge label="Presentation list" tone="neutral" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {PACK_CONTENTS.map((item) => (
                <div key={item} className="rounded-2xl border border-[color:var(--tex-border)] bg-white p-4">
                  <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{item}</p>
                  <p className="mt-1 text-sm text-[color:var(--tex-text-muted)]">Source-controlled content placeholder.</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-5">
          <section className="rounded-xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface-muted)] p-5">
            <p className="tex-eyebrow">Action rail</p>
            <h2 className="mt-1 text-xl font-bold text-[color:var(--tex-text-strong)]">Delivery Actions</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton label="Download" />
              <ActionButton label="Email Contractor" />
              <ActionButton label="Submit Directly" future />
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--tex-text-muted)]">Email and submission actions are displayed as disabled presentation controls only.</p>
          </section>

          <section className="rounded-xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface-muted)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="tex-eyebrow">Deadline control</p>
                <h2 className="mt-1 text-xl font-bold text-[color:var(--tex-text-strong)]">Submission Deadline</h2>
              </div>
              <SectionBadge label="Source required" tone="warning" />
            </div>
            <div className="mt-4 rounded-2xl border border-[color:var(--tex-border)] bg-white p-4">
              <EnterpriseEmptyState title="Deadline not connected" detail="Submission timing is reserved for the connected source and is not hard-coded in the UI." />
            </div>
          </section>

          <section className="rounded-xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface-muted)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="tex-eyebrow">Execution watchlist</p>
                <h2 className="mt-1 text-xl font-bold text-[color:var(--tex-text-strong)]">Outstanding Actions</h2>
              </div>
              <SectionBadge label="Read only" tone="info" />
            </div>
            <ul className="mt-4 space-y-3">
              {OUTSTANDING_ACTIONS.map((item) => (
                <li key={item} className="rounded-2xl border border-[color:var(--tex-border)] bg-white p-4 text-sm text-[color:var(--tex-text-muted)]">{item}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </EnterprisePanel>
  );
}
