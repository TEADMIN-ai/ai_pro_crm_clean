"use client";

import { useRouter } from "next/navigation";

export type ContractorBusinessIdCardProps = {
  contractorId: string;
  companyName: string;
  taxNumber?: string | null;
  csdNumber?: string | null;
  onboardedAt?: string | number | null;
  status?: string | null;
  lastDocumentUpdateAt?: string | number | null;
  logoUrl?: string | null;
  href?: string;
};

function formatDate(value?: string | number | null): string {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "TE";
}

function getStatusClasses(status?: string | null): string {
  const normalized = status?.trim().toLowerCase();
  if (normalized === "approved" || normalized === "active" || normalized === "ready") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "blocked" || normalized === "rejected") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function ContractorBusinessIdCard({
  contractorId,
  companyName,
  taxNumber,
  csdNumber,
  onboardedAt,
  status,
  lastDocumentUpdateAt,
  logoUrl,
  href,
}: ContractorBusinessIdCardProps) {
  const router = useRouter();
  const targetHref = href ?? `/dashboard/contractors/${encodeURIComponent(contractorId)}`;
  const displayStatus = status?.trim() || "Onboarding";

  function openDocumentationArea() {
    router.push(targetHref);
  }

  return (
    <button
      type="button"
      onClick={openDocumentationArea}
      className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-sky-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500/40"
      aria-label={`Open documentation area for ${companyName}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              getInitials(companyName)
            )}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-slate-950">{companyName}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Contractor ID: {contractorId}
            </p>
          </div>
        </div>

        <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(status)}`}>
          {displayStatus}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tax PIN / Number</dt>
          <dd className="mt-1 font-medium text-slate-900">{taxNumber || "Not recorded"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">CSD M Number</dt>
          <dd className="mt-1 font-medium text-slate-900">{csdNumber || "Not recorded"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Onboarded</dt>
          <dd className="mt-1 font-medium text-slate-900">{formatDate(onboardedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Last Document Update</dt>
          <dd className="mt-1 font-medium text-slate-900">{formatDate(lastDocumentUpdateAt)}</dd>
        </div>
      </dl>
    </button>
  );
}
