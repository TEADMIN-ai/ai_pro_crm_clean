"use client";

import { useMemo, useState } from "react";

import {
  EnterpriseActionButton,
  EnterpriseCard,
  EnterpriseEmptyState,
  EnterpriseKpiCard,
  EnterprisePanel,
  EnterpriseStatusBadge,
  EnterpriseTable,
} from "@/components/ui/EnterpriseUI";

type ContractorBucket = "recommended" | "assigned" | "rejected" | "pending";
type ContractorCompliance = "Ready" | "Review" | "Blocked";

type ContractorWorkspaceItem = {
  id: string;
  companyName: string;
  region: string;
  bucket: ContractorBucket;
  readiness: number;
  aiMatch: number;
  compliance: ContractorCompliance;
  pipelineValue: number;
  currentWorkload: string;
  tenderWins: number;
  summary: string;
  lastTender: string;
  strengths: string[];
  concerns: string[];
};

const BUCKET_LABELS: Record<ContractorBucket, string> = {
  recommended: "Recommended Contractors",
  assigned: "Assigned Contractors",
  rejected: "Rejected Contractors",
  pending: "Pending Review",
};

const BUCKET_HELPERS: Record<ContractorBucket, string> = {
  recommended: "Strong AI and readiness alignment.",
  assigned: "Currently attached to live opportunities.",
  rejected: "Not shortlisted for the current cycle.",
  pending: "Requires review before assignment.",
};

const INITIAL_CONTRACTORS: ContractorWorkspaceItem[] = [
  {
    id: "CT-1042",
    companyName: "Mavela Infrastructure Group",
    region: "Gauteng",
    bucket: "recommended",
    readiness: 94,
    aiMatch: 97,
    compliance: "Ready",
    pipelineValue: 18200000,
    currentWorkload: "2 live bids",
    tenderWins: 14,
    summary: "Highest fit for civil and municipal works with strong compliance history.",
    lastTender: "Water reticulation upgrade - awarded",
    strengths: ["CIDB Grade 7", "Municipal delivery", "Document discipline"],
    concerns: ["Two upcoming closes this week"],
  },
  {
    id: "CT-1198",
    companyName: "Kopano Civil Contractors",
    region: "Western Cape",
    bucket: "recommended",
    readiness: 89,
    aiMatch: 93,
    compliance: "Ready",
    pipelineValue: 14150000,
    currentWorkload: "1 live bid",
    tenderWins: 9,
    summary: "Balanced fit for construction submissions and infrastructure tenders.",
    lastTender: "Road resurfacing package - shortlisted",
    strengths: ["Safety pack complete", "Fast turnaround", "Construction references"],
    concerns: ["Needs refreshed bank confirmation"],
  },
  {
    id: "CT-1207",
    companyName: "Sable Projects and Plant",
    region: "KwaZulu-Natal",
    bucket: "recommended",
    readiness: 86,
    aiMatch: 90,
    compliance: "Review",
    pipelineValue: 9750000,
    currentWorkload: "3 active bids",
    tenderWins: 7,
    summary: "Good pipeline value with a few compliance items under review.",
    lastTender: "Drainage and civils package - pending award",
    strengths: ["Plant capacity", "Regional delivery", "Pricing stability"],
    concerns: ["Review note on SBD4", "Pending director signature"],
  },
  {
    id: "CT-2004",
    companyName: "Atlas Build Consortium",
    region: "Gauteng",
    bucket: "assigned",
    readiness: 92,
    aiMatch: 88,
    compliance: "Ready",
    pipelineValue: 24800000,
    currentWorkload: "4 live bids",
    tenderWins: 18,
    summary: "Assigned to a major construction opportunity with broad delivery scope.",
    lastTender: "Hospital expansion - live",
    strengths: ["Executive sign-off", "Multi-trade capacity", "High award volume"],
    concerns: ["Heavy current workload"],
  },
  {
    id: "CT-2131",
    companyName: "Nexus Municipal Works",
    region: "Eastern Cape",
    bucket: "assigned",
    readiness: 90,
    aiMatch: 91,
    compliance: "Ready",
    pipelineValue: 17300000,
    currentWorkload: "2 live bids",
    tenderWins: 11,
    summary: "Assigned on the basis of municipal compliance and strong local presence.",
    lastTender: "Public works framework - live",
    strengths: ["Municipal track record", "Local presence", "Clean documents"],
    concerns: ["One pending subcontractor clearance"],
  },
  {
    id: "CT-2210",
    companyName: "Vector Site Services",
    region: "Free State",
    bucket: "assigned",
    readiness: 83,
    aiMatch: 84,
    compliance: "Review",
    pipelineValue: 11900000,
    currentWorkload: "1 active bid",
    tenderWins: 6,
    summary: "Currently assigned with moderate workload and a handful of review items.",
    lastTender: "Facilities maintenance RFQ - awarded",
    strengths: ["Responsive review cycle", "Facilities experience"],
    concerns: ["Workload nearing capacity"],
  },
  {
    id: "CT-3022",
    companyName: "Harborline Procurement Partners",
    region: "Western Cape",
    bucket: "pending",
    readiness: 78,
    aiMatch: 81,
    compliance: "Review",
    pipelineValue: 6400000,
    currentWorkload: "2 active bids",
    tenderWins: 4,
    summary: "Pending review while compliance evidence and tender history are checked.",
    lastTender: "Coastal upgrade pack - under review",
    strengths: ["Strong buyer response", "Good tender paperwork"],
    concerns: ["Awaiting proof of insurance", "Pending signed declarations"],
  },
  {
    id: "CT-3074",
    companyName: "Blue Ridge Works",
    region: "Limpopo",
    bucket: "pending",
    readiness: 72,
    aiMatch: 76,
    compliance: "Review",
    pipelineValue: 5200000,
    currentWorkload: "3 active bids",
    tenderWins: 3,
    summary: "Needs more evidence before it can be moved into assignment.",
    lastTender: "Water infrastructure response - queued",
    strengths: ["Local footprint", "Competitive pricing"],
    concerns: ["Docs missing", "Compliance verification pending"],
  },
  {
    id: "CT-4119",
    companyName: "Northline Trade Services",
    region: "North West",
    bucket: "pending",
    readiness: 69,
    aiMatch: 73,
    compliance: "Blocked",
    pipelineValue: 4100000,
    currentWorkload: "1 active bid",
    tenderWins: 2,
    summary: "On hold pending compliance remediation and tender history review.",
    lastTender: "Facilities bundle - on hold",
    strengths: ["Targeted specialization", "Decent response rate"],
    concerns: ["Compliance blocked", "Documents out of date"],
  },
  {
    id: "CT-5028",
    companyName: "Redstone Contracts",
    region: "Northern Cape",
    bucket: "rejected",
    readiness: 54,
    aiMatch: 48,
    compliance: "Blocked",
    pipelineValue: 2500000,
    currentWorkload: "4 active bids",
    tenderWins: 1,
    summary: "Rejected from this cycle due to unresolved compliance and workload risk.",
    lastTender: "Regional upgrades - not shortlisted",
    strengths: ["Low-cost submissions"],
    concerns: ["Compliance gap", "Low AI match", "High workload"],
  },
  {
    id: "CT-5156",
    companyName: "Primeform Services",
    region: "Mpumalanga",
    bucket: "rejected",
    readiness: 57,
    aiMatch: 52,
    compliance: "Blocked",
    pipelineValue: 3900000,
    currentWorkload: "2 live bids",
    tenderWins: 2,
    summary: "Rejected for the current shortlist because the profile is not yet release ready.",
    lastTender: "Site maintenance RFQ - rejected",
    strengths: ["Regional reach", "Clear pricing structure"],
    concerns: ["Missing forms", "Pending approvals"],
  },
  {
    id: "CT-5224",
    companyName: "Summit Procurement Works",
    region: "Gauteng",
    bucket: "rejected",
    readiness: 61,
    aiMatch: 55,
    compliance: "Review",
    pipelineValue: 3300000,
    currentWorkload: "1 active bid",
    tenderWins: 3,
    summary: "Placed in rejected for now while exceptions are cleared.",
    lastTender: "Corporate RFQ - rejected",
    strengths: ["Good relationships", "Fast documents"],
    concerns: ["Exec sign-off missing", "Compliance not final"],
  },
];

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `R ${(value / 1_000_000).toFixed(1)}m`;
  }

  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}

function complianceTone(value: ContractorCompliance) {
  if (value === "Ready") return "success";
  if (value === "Blocked") return "danger";
  return "review";
}

function scoreTone(value: number) {
  if (value >= 90) return "success";
  if (value >= 80) return "info";
  if (value >= 70) return "warning";
  return "danger";
}

function bucketTone(bucket: ContractorBucket) {
  if (bucket === "recommended") return "success";
  if (bucket === "assigned") return "info";
  if (bucket === "pending") return "review";
  return "danger";
}

function ContractorMetric({ label, value, tone }: { label: string; value: string | number; tone?: "success" | "warning" | "danger" | "info" | "neutral" | "review" }) {
  return (
    <div className="rounded-2xl border border-[color:var(--tex-border)] bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--tex-text-muted)]">{label}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{value}</span>
        {tone ? <EnterpriseStatusBadge value={label} tone={tone} className="hidden" /> : null}
      </div>
    </div>
  );
}

function ContractorCard({
  contractor,
  focused,
  compared,
  onAssign,
  onRemove,
  onCompare,
  onOpen,
}: {
  contractor: ContractorWorkspaceItem;
  focused: boolean;
  compared: boolean;
  onAssign: (id: string) => void;
  onRemove: (id: string) => void;
  onCompare: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <EnterpriseCard className={focused ? "border-[color:var(--tex-nav-active-border)] bg-[color:var(--tex-nav-active-bg)]/35 p-5" : "p-5"} interactive>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2">
            <h3 className="text-xl font-semibold text-[color:var(--tex-text-strong)]">{contractor.companyName}</h3>
            <EnterpriseStatusBadge value={BUCKET_LABELS[contractor.bucket]} tone={bucketTone(contractor.bucket)} />
            {compared ? <EnterpriseStatusBadge value="Compare" tone="review" /> : null}
          </div>
          <p className="mt-1 text-sm text-[color:var(--tex-text-muted)]">{contractor.region}</p>
          <p className="tex-copy mt-3 text-sm leading-6">{contractor.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <EnterpriseStatusBadge value={`${contractor.readiness}% Readiness`} tone={scoreTone(contractor.readiness)} />
            <EnterpriseStatusBadge value={`${contractor.aiMatch}% AI Match`} tone={scoreTone(contractor.aiMatch)} />
            <EnterpriseStatusBadge value={contractor.compliance} tone={complianceTone(contractor.compliance)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <EnterpriseActionButton variant="success" onClick={() => onAssign(contractor.id)}>
            Assign
          </EnterpriseActionButton>
          <EnterpriseActionButton variant="danger" onClick={() => onRemove(contractor.id)}>
            Remove
          </EnterpriseActionButton>
          <EnterpriseActionButton variant="secondary" onClick={() => onCompare(contractor.id)}>
            Compare
          </EnterpriseActionButton>
          <EnterpriseActionButton variant="primary" onClick={() => onOpen(contractor.id)}>
            Open Contractor
          </EnterpriseActionButton>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <ContractorMetric label="Readiness" value={`${contractor.readiness}%`} />
        <ContractorMetric label="AI Match" value={`${contractor.aiMatch}%`} />
        <ContractorMetric label="Compliance" value={contractor.compliance} />
        <ContractorMetric label="Pipeline Value" value={formatCurrency(contractor.pipelineValue)} />
        <ContractorMetric label="Current Workload" value={contractor.currentWorkload} />
        <ContractorMetric label="Tender Wins" value={contractor.tenderWins} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--tex-text-muted)]">Strengths</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {contractor.strengths.map((item) => (
              <span key={item} className="rounded-full border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] px-3 py-1 text-sm text-[color:var(--tex-text-strong)]">
                {item}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--tex-text-muted)]">Concerns</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {contractor.concerns.map((item) => (
              <span key={item} className="rounded-full border border-[color:var(--tex-border)] bg-white px-3 py-1 text-sm text-[color:var(--tex-text-muted)]">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </EnterpriseCard>
  );
}

export default function ContractorsWorkspace() {
  const [contractors, setContractors] = useState<ContractorWorkspaceItem[]>(INITIAL_CONTRACTORS);
  const [selectedBucket, setSelectedBucket] = useState<ContractorBucket>("recommended");
  const [focusedContractorId, setFocusedContractorId] = useState<string>(INITIAL_CONTRACTORS[0]?.id ?? "");
  const [compareIds, setCompareIds] = useState<string[]>([INITIAL_CONTRACTORS[0]?.id, INITIAL_CONTRACTORS[1]?.id].filter(Boolean) as string[]);

  const grouped = useMemo(() => ({
    recommended: contractors.filter((contractor) => contractor.bucket === "recommended"),
    assigned: contractors.filter((contractor) => contractor.bucket === "assigned"),
    rejected: contractors.filter((contractor) => contractor.bucket === "rejected"),
    pending: contractors.filter((contractor) => contractor.bucket === "pending"),
  }), [contractors]);

  const visibleContractors = grouped[selectedBucket];
  const focusedContractor = contractors.find((item) => item.id === focusedContractorId) ?? visibleContractors[0] ?? contractors[0];
  const compareCandidates = contractors.filter((item) => compareIds.includes(item.id));
  const summary = {
    recommended: grouped.recommended.length,
    assigned: grouped.assigned.length,
    rejected: grouped.rejected.length,
    pending: grouped.pending.length,
    avgReadiness: Math.round(contractors.reduce((total, item) => total + item.readiness, 0) / contractors.length),
    avgAiMatch: Math.round(contractors.reduce((total, item) => total + item.aiMatch, 0) / contractors.length),
    tenderWins: contractors.reduce((total, item) => total + item.tenderWins, 0),
    pipelineValue: contractors.reduce((total, item) => total + item.pipelineValue, 0),
  };

  function moveContractor(id: string, bucket: ContractorBucket) {
    setContractors((current) => current.map((contractor) => (contractor.id === id ? { ...contractor, bucket } : contractor)));
    setSelectedBucket(bucket);
    setFocusedContractorId(id);
  }

  function handleAssign(id: string) {
    moveContractor(id, "assigned");
  }

  function handleRemove(id: string) {
    moveContractor(id, "rejected");
  }

  function handleCompare(id: string) {
    setCompareIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }

      if (current.length >= 2) {
        return [current[1], id].filter(Boolean) as string[];
      }

      return [...current, id];
    });
  }

  function handleOpen(id: string) {
    setFocusedContractorId(id);
  }

  return (
    <main data-module="dashboard" className="tex-shell grid gap-6">
      <EnterpriseCard className="overflow-hidden p-0">
        <div className="border-b border-[color:var(--tex-border)] px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="tex-eyebrow">Contractors</p>
              <h1 className="tex-title mt-3">Contractor Workbench</h1>
              <p className="tex-copy mt-3 text-sm">
                Presentation layer for contractor selection, allocation and review. All actions are local to this workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <EnterpriseStatusBadge value="No backend" tone="neutral" />
              <EnterpriseStatusBadge value="Presentation only" tone="success" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
          <EnterpriseKpiCard label="Recommended" value={summary.recommended} helper="High-fit contractors ready for assignment." />
          <EnterpriseKpiCard label="Assigned" value={summary.assigned} helper="Currently attached to live opportunities." />
          <EnterpriseKpiCard label="Pending Review" value={summary.pending} helper="Awaiting compliance or readiness checks." />
          <EnterpriseKpiCard label="Rejected" value={summary.rejected} helper="Held out of the current shortlist." />
        </div>
      </EnterpriseCard>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <EnterpriseKpiCard label="Readiness" value={`${summary.avgReadiness}%`} helper="Average readiness across all contractor views." />
        <EnterpriseKpiCard label="AI Match" value={`${summary.avgAiMatch}%`} helper="Average model fit for the current pool." />
        <EnterpriseKpiCard label="Pipeline Value" value={formatCurrency(summary.pipelineValue)} helper="Estimated pipeline across all records." />
        <EnterpriseKpiCard label="Tender Wins" value={summary.tenderWins} helper="Total wins represented in the workspace." />
      </section>

      <EnterpriseCard className="p-5">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(BUCKET_LABELS) as ContractorBucket[]).map((bucket) => (
            <button
              key={bucket}
              type="button"
              onClick={() => setSelectedBucket(bucket)}
              className={[
                "rounded-full border px-4 py-2 text-sm font-semibold transition",
                selectedBucket === bucket
                  ? "border-[color:var(--tex-nav-active-border)] bg-[color:var(--tex-nav-active-bg)] text-[color:var(--tex-text-strong)]"
                  : "border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] text-[color:var(--tex-text-muted)] hover:bg-[color:var(--tex-surface-muted)]",
              ].join(" ")}
            >
              {BUCKET_LABELS[bucket]} ({grouped[bucket].length})
            </button>
          ))}
        </div>
      </EnterpriseCard>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
        <div className="grid gap-4">
          <EnterprisePanel title={BUCKET_LABELS[selectedBucket]} eyebrow={BUCKET_HELPERS[selectedBucket]}>
            {visibleContractors.length ? (
              <div className="grid gap-4">
                {visibleContractors.map((contractor) => (
                  <ContractorCard
                    key={contractor.id}
                    contractor={contractor}
                    focused={contractor.id === focusedContractor?.id}
                    compared={compareIds.includes(contractor.id)}
                    onAssign={handleAssign}
                    onRemove={handleRemove}
                    onCompare={handleCompare}
                    onOpen={handleOpen}
                  />
                ))}
              </div>
            ) : (
              <EnterpriseEmptyState
                title="No contractors in this bucket"
                detail="Switch categories or add more presentation data to populate this view."
              />
            )}
          </EnterprisePanel>
        </div>

        <div className="grid gap-6">
          <EnterprisePanel title="Open Contractor" eyebrow={focusedContractor?.companyName ?? "No contractor selected"}>
            {focusedContractor ? (
              <div className="grid gap-4">
                <div className="flex flex-wrap gap-2">
                  <EnterpriseStatusBadge value={focusedContractor.region} tone="info" />
                  <EnterpriseStatusBadge value={`${focusedContractor.readiness}% Readiness`} tone={scoreTone(focusedContractor.readiness)} />
                  <EnterpriseStatusBadge value={`${focusedContractor.aiMatch}% AI Match`} tone={scoreTone(focusedContractor.aiMatch)} />
                  <EnterpriseStatusBadge value={focusedContractor.compliance} tone={complianceTone(focusedContractor.compliance)} />
                </div>
                <p className="tex-copy text-sm leading-6">{focusedContractor.summary}</p>
                <EnterpriseTable wrapperClassName="shadow-none">
                  <tbody>
                    <tr>
                      <td>Pipeline Value</td>
                      <td>{formatCurrency(focusedContractor.pipelineValue)}</td>
                    </tr>
                    <tr>
                      <td>Current Workload</td>
                      <td>{focusedContractor.currentWorkload}</td>
                    </tr>
                    <tr>
                      <td>Tender Wins</td>
                      <td>{focusedContractor.tenderWins}</td>
                    </tr>
                    <tr>
                      <td>Last Tender</td>
                      <td>{focusedContractor.lastTender}</td>
                    </tr>
                  </tbody>
                </EnterpriseTable>
              </div>
            ) : (
              <EnterpriseEmptyState title="No contractor selected" detail="Select Open Contractor on any record to inspect its profile." />
            )}
          </EnterprisePanel>

          <EnterprisePanel title="Compare" eyebrow="Selected contractors">
            {compareCandidates.length ? (
              <div className="grid gap-4">
                {compareCandidates.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--tex-text-strong)]">{item.companyName}</p>
                        <p className="tex-copy mt-1 text-xs">{item.region}</p>
                      </div>
                      <EnterpriseStatusBadge value={BUCKET_LABELS[item.bucket]} tone={bucketTone(item.bucket)} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-xl border border-[color:var(--tex-border)] bg-white px-3 py-2">Readiness {item.readiness}%</div>
                      <div className="rounded-xl border border-[color:var(--tex-border)] bg-white px-3 py-2">AI Match {item.aiMatch}%</div>
                      <div className="rounded-xl border border-[color:var(--tex-border)] bg-white px-3 py-2">Compliance {item.compliance}</div>
                      <div className="rounded-xl border border-[color:var(--tex-border)] bg-white px-3 py-2">Wins {item.tenderWins}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EnterpriseEmptyState title="Nothing to compare" detail="Use Compare on up to two contractors to stage a side-by-side review." />
            )}
          </EnterprisePanel>
        </div>
      </section>
    </main>
  );
}
