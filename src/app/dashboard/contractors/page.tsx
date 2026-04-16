"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import UploadDocumentModal from "@/components/modals/UploadDocumentModal";
import { useAuth } from "@/context/AuthContext";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { API_ROUTES } from "@/lib/apiRoutes";
import { authFetch } from "@/lib/client/authFetch";

type Contractor = {
  id: string;
  name?: string;
  company?: string;
  companyName?: string;
  registrationNumber?: string | null;
  companyRegistrationNumber?: string | null;
  email?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  contactPhone?: string | null;
  status?: string | null;
  authUid?: string | null;
  userId?: string | null;
  taxPin?: string | null;
  taxClearanceExpiry?: number | null;
  bbbeeLevel?: string | null;
  coidaRegistrationNumber?: string | null;
  coidaExpiry?: number | null;
  documents?: Partial<
    Record<
      "cipc" | "tax" | "bbbee" | "coida",
      | boolean
      | {
          uploaded?: boolean;
          valid?: boolean;
          issues?: string[];
          extracted?: Record<string, string>;
          reviewed?: boolean;
        }
    >
  > | null;
  complianceApproved?: boolean | null;
  complianceRejected?: boolean | null;
  rejectionReason?: string | null;
};

type StatusTone = "idle" | "loading" | "success" | "error";

type StatusState = {
  label: string;
  detail: string;
  tone: StatusTone;
};

type ButtonVariant = "primary" | "secondary" | "destructive";
type WorkflowState = "Incomplete" | "Partial" | "Ready";

const DEFAULT_STATUS: StatusState = {
  label: "Ready",
  detail: "No action in progress.",
  tone: "idle",
};

function getContractorName(contractor: Contractor): string {
  return contractor.companyName?.trim() || contractor.company?.trim() || contractor.name?.trim() || "Unnamed Contractor";
}

function getContractorEmail(contractor: Contractor): string {
  return contractor.email?.trim() || contractor.contactEmail?.trim() || "-";
}

function getContractorPhone(contractor: Contractor): string {
  return contractor.phone?.trim() || contractor.contactPhone?.trim() || "-";
}

function getRegistrationNumber(contractor: Contractor): string {
  return contractor.registrationNumber?.trim() || contractor.companyRegistrationNumber?.trim() || "-";
}

function getContractorAuthUid(contractor: Contractor): string {
  return contractor.authUid?.trim() || contractor.userId?.trim() || "";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Something went wrong.";
}

function normalizeContractors(payload: unknown): Contractor[] {
  if (Array.isArray(payload)) {
    return payload as Contractor[];
  }

  if (payload && typeof payload === "object") {
    const record = payload as { data?: unknown; contractors?: unknown };

    if (Array.isArray(record.data)) {
      return record.data as Contractor[];
    }

    if (Array.isArray(record.contractors)) {
      return record.contractors as Contractor[];
    }
  }

  return [];
}

function getBadgeTone(status?: string | null) {
  switch ((status ?? "").trim().toLowerCase()) {
    case "active":
    case "approved":
    case "ready":
      return "success";
    case "pending":
    case "review":
      return "warning";
    case "blocked":
    case "inactive":
      return "danger";
    default:
      return "info";
  }
}

function getStatusClasses(tone: StatusTone): string {
  switch (tone) {
    case "loading":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-900";
    case "idle":
    default:
      return "border-slate-200 bg-white text-slate-700";
  }
}

function getButtonClasses(variant: ButtonVariant): string {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

  switch (variant) {
    case "secondary":
      return `${base} border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus:ring-slate-300`;
    case "destructive":
      return `${base} border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 focus:ring-rose-300`;
    case "primary":
    default:
      return `${base} border border-blue-600 bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus:ring-blue-400`;
  }
}

function getWorkflowStateClasses(state: WorkflowState): string {
  switch (state) {
    case "Ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Partial":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Incomplete":
    default:
      return "border-rose-200 bg-rose-50 text-rose-700";
  }
}

function getProgressBarClasses(state: WorkflowState): string {
  switch (state) {
    case "Ready":
      return "bg-emerald-500";
    case "Partial":
      return "bg-amber-500";
    case "Incomplete":
    default:
      return "bg-rose-500";
  }
}

function getDocumentValidationState(
  document:
    | boolean
    | {
        uploaded?: boolean;
        valid?: boolean;
        issues?: string[];
      }
    | undefined
) {
  if (document === true) {
    return {
      complete: true,
      statusLabel: "Valid",
      issues: [] as string[],
    };
  }

  if (document && typeof document === "object") {
    return {
      complete: document.valid === true,
      statusLabel: document.valid ? "Valid" : `Issues: ${(document.issues ?? []).join(", ") || "Validation failed"}`,
      issues: document.issues ?? [],
    };
  }

  return {
    complete: false,
    statusLabel: "Missing",
    issues: [] as string[],
  };
}

function buildComplianceModel(contractor: Contractor) {
  const docs = contractor?.documents || {};
  const cipcDoc = getDocumentValidationState(docs.cipc);
  const taxDoc = getDocumentValidationState(docs.tax);
  const bbbeeDoc = getDocumentValidationState(docs.bbbee);
  const coidaDoc = getDocumentValidationState(docs.coida);
  const checks = [
    {
      label: "CIPC",
      complete: cipcDoc.complete || getRegistrationNumber(contractor) !== "-",
      statusLabel: cipcDoc.complete ? cipcDoc.statusLabel : cipcDoc.issues.length > 0 ? cipcDoc.statusLabel : "Missing",
    },
    {
      label: "Tax",
      complete: taxDoc.complete || Boolean(contractor.taxPin || contractor.taxClearanceExpiry),
      statusLabel: taxDoc.complete ? taxDoc.statusLabel : taxDoc.issues.length > 0 ? taxDoc.statusLabel : "Missing",
    },
    {
      label: "B-BBEE",
      complete: bbbeeDoc.complete || Boolean(contractor.bbbeeLevel?.trim()),
      statusLabel: bbbeeDoc.complete ? bbbeeDoc.statusLabel : bbbeeDoc.issues.length > 0 ? bbbeeDoc.statusLabel : "Missing",
    },
    {
      label: "COIDA",
      complete: coidaDoc.complete || Boolean(contractor.coidaRegistrationNumber || contractor.coidaExpiry),
      statusLabel: coidaDoc.complete ? coidaDoc.statusLabel : coidaDoc.issues.length > 0 ? coidaDoc.statusLabel : "Missing",
    },
  ];

  const completed = checks.filter((check) => check.complete).length;
  const percentage = Math.round((completed / checks.length) * 100);
  const missing = checks.filter((check) => !check.complete).map((check) => check.label);

  let state: WorkflowState = "Incomplete";

  if (completed === checks.length) {
    state = "Ready";
  } else if (completed > 0) {
    state = "Partial";
  }

  let meaning = "Cannot submit";
  if (state === "Partial") {
    meaning = "Risk";
  }
  if (state === "Ready") {
    meaning = "Can submit";
  }

  let nextAction = "Upload missing compliance documents";
  if (state === "Ready") {
    nextAction = "Review contractor profile and proceed to tender submission";
  } else if (missing.length > 0) {
    nextAction = `Upload missing compliance documents: ${missing.join(", ")}`;
  }

  return {
    checks,
    percentage,
    state,
    meaning,
    nextAction,
  };
}

function ComplianceItem({
  label,
  complete,
  value,
}: {
  label: string;
  complete: boolean;
  value: string;
}) {
  return (
    <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className={`text-right text-sm ${complete ? "text-emerald-700" : value.startsWith("Issues:") ? "text-red-600" : "text-slate-400"}`}>
        {value}
      </span>
    </li>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${getButtonClasses(variant)} ${className ?? ""}`.trim()}
    >
      {children}
    </button>
  );
}

export default function ContractorsPage() {
  const router = useRouter();
  const { role } = useAuth();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreatingContractor, setIsCreatingContractor] = useState(false);
  const [deletingContractorId, setDeletingContractorId] = useState<string | null>(null);
  const [activeUploadContractorId, setActiveUploadContractorId] = useState<string | null>(null);
  const [pageStatus, setPageStatus] = useState<StatusState>({
    label: "Loading",
    detail: "Fetching contractors.",
    tone: "loading",
  });
  const [createStatus, setCreateStatus] = useState<StatusState>(DEFAULT_STATUS);
  const [deleteStatus, setDeleteStatus] = useState<StatusState>(DEFAULT_STATUS);

  async function loadContractors(showRefreshState = false) {
    if (showRefreshState) {
      setIsRefreshing(true);
    }

    setPageStatus({
      label: "Loading",
      detail: "Fetching contractors.",
      tone: "loading",
    });

    try {
      const response = await authFetch(API_ROUTES.CONTRACTORS);
      const payload = await response.json();
      const nextContractors = normalizeContractors(payload);

      setContractors(nextContractors);
      setPageStatus({
        label: "Synced",
        detail: `${nextContractors.length} contractor${nextContractors.length === 1 ? "" : "s"} loaded.`,
        tone: "success",
      });
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Failed to load contractors:", error);
      setPageStatus({
        label: "Load failed",
        detail: message,
        tone: "error",
      });
      alert(message);
    } finally {
      setPageLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void loadContractors();
  }, []);

  useEffect(() => {
    function handleUpdate() {
      void loadContractors();
    }

    window.addEventListener("contractor-updated", handleUpdate);

    return () => {
      window.removeEventListener("contractor-updated", handleUpdate);
    };
  }, []);

  async function createContractor() {
    const companyName = window.prompt("New contractor company name");

    if (!companyName || !companyName.trim()) {
      return;
    }

    const email = window.prompt("Contractor email address");

    if (!email || !email.trim()) {
      return;
    }

    setIsCreatingContractor(true);
    setCreateStatus({
      label: "Creating",
      detail: `Creating ${companyName.trim()}.`,
      tone: "loading",
    });

    try {
      const response = await authFetch(API_ROUTES.CONTRACTORS, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: companyName.trim(),
          name: companyName.trim(),
          email: email.trim(),
          status: "pending",
        }),
      });

      const payload = (await response.json()) as { contractor?: Contractor; contractorId?: string };

      await loadContractors(true);

      setCreateStatus({
        label: "Created",
        detail: payload.contractor?.companyName
          ? `${payload.contractor.companyName} added successfully.`
          : "Contractor created successfully.",
        tone: "success",
      });
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Create contractor failed:", error);
      setCreateStatus({
        label: "Create failed",
        detail: message,
        tone: "error",
      });
      alert(message);
    } finally {
      setIsCreatingContractor(false);
    }
  }

  function uploadBusinessDocs() {
    if (contractors.length === 0) {
      setPageStatus({
        label: "No contractors",
        detail: "Create a contractor before uploading business documents.",
        tone: "error",
      });
      return;
    }

    const targetContractorId = activeUploadContractorId ?? contractors[0]?.id;

    if (!targetContractorId) {
      return;
    }

    router.push(`/dashboard/contractors/${encodeURIComponent(targetContractorId)}`);
  }

  function handleNextAction(contractor: Contractor, nextAction: string) {
    let docType = "cipc";

    if (nextAction.includes("Tax")) docType = "tax";
    else if (nextAction.includes("B-BBEE")) docType = "bbbee";
    else if (nextAction.includes("COIDA")) docType = "coida";

    setSelectedContractor(contractor);
    setSelectedDocType(docType);
    setIsUploadOpen(true);
  }

  async function deleteContractor(contractor: Contractor) {
    const authUid = getContractorAuthUid(contractor);

    if (!authUid) {
      setDeleteStatus({
        label: "Delete blocked",
        detail: `${getContractorName(contractor)} has no linked auth account.`,
        tone: "error",
      });
      return;
    }

    if (!confirm(`Delete ${getContractorName(contractor)} permanently? This removes the contractor record and auth user.`)) {
      return;
    }

    setDeletingContractorId(contractor.id);
    setDeleteStatus({
      label: "Deleting",
      detail: `Removing ${getContractorName(contractor)}.`,
      tone: "loading",
    });

    try {
      await authFetch(API_ROUTES.CONTRACTOR_DETAIL(contractor.id), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contractorId: contractor.id,
          authUid,
        }),
      });

      setContractors((prev) => prev.filter((entry) => entry.id !== contractor.id));
      setDeleteStatus({
        label: "Deleted",
        detail: `${getContractorName(contractor)} deleted successfully.`,
        tone: "success",
      });
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Delete contractor failed:", error);
      setDeleteStatus({
        label: "Delete failed",
        detail: message,
        tone: "error",
      });
      alert(message);
    } finally {
      setDeletingContractorId(null);
    }
  }

  async function approveCompliance(id: string) {
    try {
      await authFetch(`/api/contractors/${id}/approve`, {
        method: "POST",
      });

      window.dispatchEvent(new Event("contractor-updated"));
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Compliance approval failed:", error);
      setPageStatus({
        label: "Approval failed",
        detail: message,
        tone: "error",
      });
    }
  }

  async function rejectCompliance(id: string) {
    try {
      const reason = window.prompt("Enter rejection reason:");

      await authFetch(`/api/contractors/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      window.dispatchEvent(new Event("contractor-updated"));
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Compliance rejection failed:", error);
      setPageStatus({
        label: "Rejection failed",
        detail: message,
        tone: "error",
      });
    }
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-7xl">
          <Card className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Loading contractors...</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Contractor CRM</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Contractors</h1>
              <p className="max-w-2xl text-sm text-slate-600">
                Structured contractor records, linked identities, and business document workflows in one clean workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <ActionButton onClick={() => void createContractor()} disabled={isCreatingContractor}>
                {isCreatingContractor ? "Creating..." : "+ New Contractor"}
              </ActionButton>
              <ActionButton variant="primary" onClick={uploadBusinessDocs}>
                Upload Business Docs
              </ActionButton>
              <ActionButton
                variant="secondary"
                onClick={() => {
                  void loadContractors(true);
                }}
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </ActionButton>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-4">
            {contractors.length === 0 ? (
              <Card className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                <h2 className="text-xl font-semibold text-slate-900">No contractors yet.</h2>
                <p className="mt-2 text-sm text-slate-600">Create your first contractor.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {contractors.map((contractor) => {
                  const authUid = getContractorAuthUid(contractor);
                  const isDeleting = deletingContractorId === contractor.id;
                  const companyName = getContractorName(contractor);
                  const compliance = buildComplianceModel(contractor);
                  const isPrivilegedApprover = role === "admin" || role === "manager";

                  return (
                    <Card
                      key={contractor.id}
                      className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                        activeUploadContractorId === contractor.id ? "ring-2 ring-blue-200" : ""
                      }`}
                    >
                      <div className="flex h-full flex-col gap-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <h2 className="text-lg font-semibold text-slate-900">{companyName}</h2>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Contractor Record</p>
                          </div>
                          <Badge tone={getBadgeTone(contractor.status)}>{contractor.status?.trim() || "unknown"}</Badge>
                        </div>

                        <div className="space-y-2 text-sm text-slate-600">
                          <p>
                            <span className="font-medium text-slate-800">Registration:</span> {getRegistrationNumber(contractor)}
                          </p>
                          <p>
                            <span className="font-medium text-slate-800">Email:</span> {getContractorEmail(contractor)}
                          </p>
                          <p>
                            <span className="font-medium text-slate-800">Phone:</span> {getContractorPhone(contractor)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Compliance: {compliance.percentage}% Complete</p>
                              <p className="mt-1 text-xs text-slate-500">Workflow guidance based on required contractor documents.</p>
                            </div>
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getWorkflowStateClasses(compliance.state)}`}
                            >
                              {compliance.state} · {compliance.meaning}
                            </span>
                          </div>
                          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full transition-all ${getProgressBarClasses(compliance.state)}`}
                              style={{ width: `${compliance.percentage}%` }}
                            />
                          </div>
                          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Next Action</p>
                            <ActionButton
                              className="mt-2 w-full"
                              variant="secondary"
                              onClick={() => handleNextAction(contractor, compliance.nextAction)}
                              disabled={compliance.state === "Ready"}
                            >
                              {compliance.state === "Ready" ? "Compliance complete" : compliance.nextAction}
                            </ActionButton>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                          <h4 className="text-sm font-semibold text-slate-900">Compliance</h4>
                          <ul className="mt-3 space-y-2">
                            {compliance.checks.map((check) => (
                              <ComplianceItem
                                key={check.label}
                                label={check.label}
                                complete={check.complete}
                                value={check.statusLabel}
                              />
                            ))}
                          </ul>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                          <span className="font-medium text-slate-800">Auth UID:</span> {authUid || "Not Linked"}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                          {contractor.complianceApproved ? (
                            <span className="font-medium text-green-600">Approved</span>
                          ) : contractor.complianceRejected ? (
                            <span className="font-medium text-red-600">
                              Rejected: {contractor.rejectionReason?.trim() || "Documents not valid"}
                            </span>
                          ) : (
                            <span className="font-medium text-yellow-600">Pending Approval</span>
                          )}
                        </div>

                        <div className="mt-auto flex flex-wrap gap-2 pt-1">
                          <Link
                            href={`/dashboard/contractors/${encodeURIComponent(contractor.id)}`}
                            className={getButtonClasses("primary")}
                          >
                            Open
                          </Link>
                          <ActionButton
                            variant="secondary"
                            onClick={() => {
                              setActiveUploadContractorId(contractor.id);
                              router.push(`/dashboard/contractors/${encodeURIComponent(contractor.id)}`);
                            }}
                          >
                            Upload Docs
                          </ActionButton>
                          {isPrivilegedApprover ? (
                            <>
                              <ActionButton
                                variant="secondary"
                                onClick={() => {
                                  void approveCompliance(contractor.id);
                                }}
                                disabled={contractor.complianceApproved === true}
                              >
                                {contractor.complianceApproved ? "Approved" : "Approve"}
                              </ActionButton>
                              <ActionButton
                                className="bg-red-500 text-white hover:bg-red-600 focus:ring-red-300"
                                onClick={() => {
                                  void rejectCompliance(contractor.id);
                                }}
                              >
                                Reject
                              </ActionButton>
                            </>
                          ) : null}
                          <ActionButton
                            variant="destructive"
                            onClick={() => {
                              void deleteContractor(contractor);
                            }}
                            disabled={isDeleting}
                          >
                            {isDeleting ? "Deleting..." : "Delete"}
                          </ActionButton>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <Card className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Workflow Status</h2>
              <div className="mt-4 space-y-3">
                <div className={`rounded-2xl border p-4 ${getStatusClasses(pageStatus.tone)}`}>
                  <p className="text-sm font-semibold">{pageStatus.label}</p>
                  <p className="mt-1 text-sm">{pageStatus.detail}</p>
                </div>
                <div className={`rounded-2xl border p-4 ${getStatusClasses(createStatus.tone)}`}>
                  <p className="text-sm font-semibold">{createStatus.label}</p>
                  <p className="mt-1 text-sm">{createStatus.detail}</p>
                </div>
                <div className={`rounded-2xl border p-4 ${getStatusClasses(deleteStatus.tone)}`}>
                  <p className="text-sm font-semibold">{deleteStatus.label}</p>
                  <p className="mt-1 text-sm">{deleteStatus.detail}</p>
                </div>
              </div>
            </Card>

            <Card className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Overview</h2>
              <dl className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <dt>Total Contractors</dt>
                  <dd className="font-semibold text-slate-900">{contractors.length}</dd>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <dt>Linked Auth Accounts</dt>
                  <dd className="font-semibold text-slate-900">
                    {contractors.filter((contractor) => getContractorAuthUid(contractor)).length}
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <dt>Pending Review</dt>
                  <dd className="font-semibold text-slate-900">
                    {contractors.filter((contractor) => contractor.status?.trim().toLowerCase() === "pending").length}
                  </dd>
                </div>
              </dl>
            </Card>
          </aside>
        </div>
      </div>

      <UploadDocumentModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setSelectedContractor(null);
          setSelectedDocType(null);
        }}
        contractor={selectedContractor}
        docType={selectedDocType}
      />
    </div>
  );
}
