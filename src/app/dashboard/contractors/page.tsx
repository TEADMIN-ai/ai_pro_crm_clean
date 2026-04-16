"use client";

import { useEffect, useState } from "react";
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
  phone?: string | null;
  status?: string;
  authUid?: string | null;
  userId?: string | null;
};

type StatusTone = "idle" | "loading" | "success" | "error";

type StatusState = {
  label: string;
  detail: string;
  tone: StatusTone;
};

const DEFAULT_STATUS: StatusState = {
  label: "Idle",
  detail: "No action started yet.",
  tone: "idle",
};

function getContractorName(contractor: Contractor): string {
  return contractor.companyName?.trim() || contractor.company?.trim() || contractor.name?.trim() || contractor.id;
}

function getRegistrationNumber(contractor: Contractor): string {
  return contractor.registrationNumber?.trim() || contractor.companyRegistrationNumber?.trim() || "-";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Error occurred";
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

function getStatusClasses(tone: StatusTone): string {
  switch (tone) {
    case "loading":
      return "border-amber-400/30 bg-amber-500/10 text-amber-100";
    case "success":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
    case "error":
      return "border-rose-400/30 bg-rose-500/10 text-rose-100";
    case "idle":
    default:
      return "border-slate-700 bg-slate-900/70 text-slate-200";
  }
}

function getContractorAuthUid(contractor: Contractor): string {
  return contractor.authUid?.trim() || contractor.userId?.trim() || "";
}

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreatingContractor, setIsCreatingContractor] = useState(false);
  const [deletingContractorId, setDeletingContractorId] = useState<string | null>(null);
  const [pageStatus, setPageStatus] = useState<StatusState>({
    label: "Loading...",
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
      label: "Loading...",
      detail: "Fetching contractors.",
      tone: "loading",
    });

    try {
      const response = await authFetch(API_ROUTES.CONTRACTORS);
      const payload = await response.json();
      const nextContractors = normalizeContractors(payload);

      setContractors(nextContractors);
      setPageStatus({
        label: "Loaded",
        detail: "Contractor management is ready.",
        tone: "success",
      });
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Failed to load contractors:", error);
      setPageStatus({
        label: "Error occurred",
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

  async function createContractor() {
    setIsCreatingContractor(true);
    setCreateStatus({
      label: "Processing...",
      detail: "Creating contractor record.",
      tone: "loading",
    });

    try {
      const response = await authFetch(API_ROUTES.CONTRACTORS, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName: "Test Contractor",
          email: "test@demo.com",
        }),
      });

      const payload = await response.json();
      await loadContractors(true);

      setCreateStatus({
        label: "Created",
        detail: "Contractor created successfully.",
        tone: "success",
      });
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Create contractor failed:", error);
      setCreateStatus({
        label: "Error occurred",
        detail: message,
        tone: "error",
      });
      alert(message);
    } finally {
      setIsCreatingContractor(false);
    }
  }

  async function deleteContractor(contractor: Contractor) {
    const authUid = getContractorAuthUid(contractor);

    if (!authUid) {
      return;
    }

    if (!confirm(`Delete ${getContractorName(contractor)} permanently? This should remove both the contractor record and auth user.`)) {
      return;
    }

    setDeletingContractorId(contractor.id);
    setDeleteStatus({
      label: "Processing...",
      detail: `Deleting ${getContractorName(contractor)}.`,
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
        label: "Error occurred",
        detail: message,
        tone: "error",
      });
      alert(message);
    } finally {
      setDeletingContractorId(null);
    }
  }

  if (pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0f19] px-6 text-white">
        <div className="rounded-2xl border border-slate-800 bg-[#111827] px-6 py-5 text-sm text-slate-200">
          Loading contractors...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white">
      <div className="grid min-h-screen grid-cols-1 border-slate-800 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="p-4 sm:p-6">
          <div className="mx-auto max-w-5xl space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Management</p>
                  <h1 className="text-2xl font-semibold">Contractors</h1>
                  <p className="text-sm text-slate-400">
                    Manage contractor records and linked Firebase Auth accounts from one screen.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      void createContractor();
                    }}
                    disabled={isCreatingContractor}
                    className="rounded-md bg-cyan-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-700"
                  >
                    {isCreatingContractor ? "Creating..." : "Add Test Contractor"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void loadContractors(true);
                    }}
                    disabled={isRefreshing}
                    className="rounded-md border border-slate-700 px-4 py-3 text-sm text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRefreshing ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              </div>
            </div>

            {contractors.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-[#111827] p-6 text-slate-300">
                No contractors found.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {contractors.map((contractor) => {
                  const authUid = getContractorAuthUid(contractor);
                  const canDelete = authUid.length > 0;
                  const isDeleting = deletingContractorId === contractor.id;

                  return (
                    <div key={contractor.id} className="rounded-2xl border border-slate-800 bg-[#111827] p-5">
                      <div className="space-y-2">
                        <p className="text-lg font-semibold">{getContractorName(contractor)}</p>
                        <p className="text-sm text-slate-400">
                          Registration: {getRegistrationNumber(contractor)}
                        </p>
                        <p className="text-sm text-slate-400">Email: {contractor.email?.trim() || "-"}</p>
                        <p className="text-sm text-slate-400">Phone: {contractor.phone?.trim() || "-"}</p>
                        <p className="text-sm text-slate-400">Status: {contractor.status?.trim() || "-"}</p>
                        <p className="text-xs text-slate-500">Contractor ID: {contractor.id}</p>
                        <p className="text-xs text-slate-500">Auth UID: {authUid || "Missing"}</p>
                      </div>

                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => {
                            void deleteContractor(contractor);
                          }}
                          disabled={isDeleting}
                          title="Delete contractor"
                          className="mt-4 w-full rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-400"
                        >
                          {isDeleting ? "Deleting..." : "Delete Contractor"}
                        </button>
                      ) : (
                        <p className="mt-4 text-sm text-amber-300">
                          Cannot delete  no linked auth account
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        <aside className="border-t border-slate-800 bg-[#0f172a] p-4 lg:border-l lg:border-t-0">
          <h2 className="text-lg font-semibold">Results</h2>

          <div className="mt-4 space-y-3">
            <div className={`rounded-xl border p-4 ${getStatusClasses(pageStatus.tone)}`}>
              <p className="text-sm font-semibold">Contractors Status</p>
              <p className="mt-2 text-base">{pageStatus.label}</p>
              <p className="mt-1 text-sm opacity-90">{pageStatus.detail}</p>
            </div>

            <div className={`rounded-xl border p-4 ${getStatusClasses(createStatus.tone)}`}>
              <p className="text-sm font-semibold">Create Contractor</p>
              <p className="mt-2 text-base">{createStatus.label}</p>
              <p className="mt-1 text-sm opacity-90">{createStatus.detail}</p>
            </div>

            <div className={`rounded-xl border p-4 ${getStatusClasses(deleteStatus.tone)}`}>
              <p className="text-sm font-semibold">Delete Contractor</p>
              <p className="mt-2 text-base">{deleteStatus.label}</p>
              <p className="mt-1 text-sm opacity-90">{deleteStatus.detail}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
