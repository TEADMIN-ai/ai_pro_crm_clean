import Link from "next/link";
import { EnterpriseActionButton, EnterpriseCard, EnterpriseStatusBadge } from "@/components/ui/EnterpriseUI";
import { ETENDERS_SECTOR_PRESETS } from "@/lib/etenders/presets";

const FILTERS = [
  "keywords",
  "tender number",
  "category",
  "province",
  "organ of state",
  "tender type",
  "eSubmission accepted",
  "advertised date",
  "closing-date range",
];

const RESULT_FIELDS = [
  "tender number",
  "title/description",
  "issuer",
  "province",
  "category",
  "advertised date",
  "closing date",
  "days remaining",
  "tender type",
  "eSubmission status",
  "source status",
  "official source link",
  "document availability",
  "import status",
];

export default function EtendersSourcingPage() {
  return (
    <main data-module="dashboard" className="tex-shell grid gap-6">
      <EnterpriseCard className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="tex-eyebrow">Opportunity Register</p>
            <h1 className="tex-title mt-3">eTenders sourcing workbench</h1>
            <p className="tex-copy mt-3 max-w-3xl text-sm">
              Staff-only source review for National Treasury eTenders opportunities. Import is a deliberate review action; no tender is automatically converted into an active deal.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <EnterpriseStatusBadge value="Staff/admin only" tone="success" />
            <EnterpriseStatusBadge value="Manual import required" tone="warning" />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <EnterpriseActionButton href="/dashboard/opportunity-register">Back to Register</EnterpriseActionButton>
          <EnterpriseActionButton href="https://www.etenders.gov.za/Home/opportunities?id=1" variant="secondary">Open official source</EnterpriseActionButton>
        </div>
      </EnterpriseCard>

      <EnterpriseCard className="p-6">
        <p className="tex-eyebrow">Supported filters</p>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {FILTERS.map((filter) => (
            <div key={filter} className="rounded-md border border-[color:var(--tex-border)] px-3 py-2 text-sm font-semibold text-[color:var(--tex-text-strong)]">
              {filter}
            </div>
          ))}
        </div>
      </EnterpriseCard>

      <EnterpriseCard className="p-6">
        <p className="tex-eyebrow">Torque Empire sector presets</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {ETENDERS_SECTOR_PRESETS.map((preset) => (
            <article key={preset.id} className="rounded-md border border-[color:var(--tex-border)] p-4">
              <h2 className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{preset.label}</h2>
              <p className="tex-copy mt-2 text-xs">{preset.keywords.join(", ")}</p>
            </article>
          ))}
        </div>
      </EnterpriseCard>

      <EnterpriseCard className="p-6">
        <p className="tex-eyebrow">Result and review contract</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {RESULT_FIELDS.map((field) => (
            <div key={field} className="rounded-md border border-[color:var(--tex-border)] px-3 py-2 text-sm text-[color:var(--tex-text-muted)]">
              {field}
            </div>
          ))}
        </div>
        <p className="tex-copy mt-5 text-sm">
          API path: <code>/api/opportunity-register/etenders/search</code>. Review/import path: <code>/api/opportunity-register/etenders/import</code>. Assignment creates the execution workspace and returns <code>/dashboard/deals/&lbrace;dealId&rbrace;/execution</code>.
        </p>
      </EnterpriseCard>

      <Link className="sr-only" href="/api/opportunity-register/etenders/search">eTenders search API</Link>
    </main>
  );
}

