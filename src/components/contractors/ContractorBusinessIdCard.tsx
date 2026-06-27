"use client";

import { useRouter } from "next/navigation";

export type ContractorBusinessIdCardProps = {
  contractorId: string;
  companyName: string;
  taxNumber?: string | null;
  csdNumber?: string | null;
  taxPinStatus?: string | null;
  csdStatus?: string | null;
  onboardedAt?: string | number | null;
  status?: string | null;
  overallStatus?: string | null;
  readinessScore?: number | null;
  requiredDocsApprovedCount?: number | null;
  requiredDocsTotalCount?: number | null;
  docsMissing?: number | null;
  reviewRequiredCount?: number | null;
  lastDocumentUpdateAt?: string | number | null;
  logoUrl?: string | null;
  href?: string;
  canApproveOnboarding?: boolean;
  onApproveOnboarding?: () => void;
  approveDisabledReason?: string | null;
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
  if (normalized === "approved" || normalized === "active" || normalized === "ready" || normalized === "approved / compliant") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "blocked" || normalized === "rejected" || normalized === "rejected / blocked") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (normalized === "review required") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function formatStatusValue(value?: string | null, fallback = "Missing"): string {
  return value?.trim() || fallback;
}

export default function ContractorBusinessIdCard({
  contractorId,
  companyName,
  taxNumber,
  csdNumber,
  taxPinStatus,
  csdStatus,
  onboardedAt,
  status,
  overallStatus,
  readinessScore,
  requiredDocsApprovedCount,
  requiredDocsTotalCount,
  docsMissing,
  reviewRequiredCount,
  lastDocumentUpdateAt,
  logoUrl,
  href,
  canApproveOnboarding,
  onApproveOnboarding,
  approveDisabledReason,
}: ContractorBusinessIdCardProps) {
  const router = useRouter();
  const targetHref = href ?? `/dashboard/contractors/${encodeURIComponent(contractorId)}`;
  const displayStatus = overallStatus?.trim() || status?.trim() || "Onboarding";
  const complianceScore =
    typeof readinessScore === "number" && Number.isFinite(readinessScore)
      ? Math.max(0, Math.min(100, Math.round(readinessScore)))
      : 0;
  const approvedCount =
    typeof requiredDocsApprovedCount === "number" && Number.isFinite(requiredDocsApprovedCount)
      ? requiredDocsApprovedCount
      : 0;
  const totalCount =
    typeof requiredDocsTotalCount === "number" && Number.isFinite(requiredDocsTotalCount)
      ? requiredDocsTotalCount
      : 5;
  const missingCount = typeof docsMissing === "number" && Number.isFinite(docsMissing) ? docsMissing : totalCount - approvedCount;
  const reviewCount = typeof reviewRequiredCount === "number" && Number.isFinite(reviewRequiredCount) ? reviewRequiredCount : 0;
  const approveDisabled = Boolean(approveDisabledReason);

  function openDocumentationArea() {
    router.push(targetHref);
  }

  return (
    <article className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-sky-300 hover:shadow-md">
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

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Compliance</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{complianceScore}%</p>
          </div>
          <p className="text-right text-sm font-medium text-slate-700">
            {approvedCount}/{totalCount} required approved
          </p>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${complianceScore}%` }} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
          <div>
            <dt className="font-semibold text-slate-500">Missing</dt>
            <dd className="mt-1 font-bold text-slate-900">{Math.max(0, missingCount)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Review</dt>
            <dd className="mt-1 font-bold text-slate-900">{reviewCount}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Tax PIN</dt>
            <dd className="mt-1 font-bold text-slate-900">{formatStatusValue(taxPinStatus, taxNumber ? "Recorded" : "Missing")}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">CSD</dt>
            <dd className="mt-1 font-bold text-slate-900">{formatStatusValue(csdStatus, csdNumber ? "Recorded" : "Missing")}</dd>
          </div>
        </dl>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tax PIN / Number</dt>
          <dd className="mt-1 font-medium text-slate-900">{taxNumber || formatStatusValue(taxPinStatus)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">CSD M Number</dt>
          <dd className="mt-1 font-medium text-slate-900">{csdNumber || formatStatusValue(csdStatus)}</dd>
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

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openDocumentationArea}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          View
        </button>
        <button
          type="button"
          onClick={openDocumentationArea}
          className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100"
        >
          Review
        </button>
        {canApproveOnboarding ? (
          <button
            type="button"
            onClick={onApproveOnboarding}
            disabled={approveDisabled}
            title={approveDisabledReason ?? undefined}
            className="rounded-lg border border-emerald-200 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
          >
            Approve Onboarding
          </button>
        ) : null}
      </div>
    </article>
  );
}
