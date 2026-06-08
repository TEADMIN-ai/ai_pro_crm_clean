"use client";

import { useEffect, useMemo, useState } from "react";
import ContractorBusinessIdCard from "@/components/contractors/ContractorBusinessIdCard";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/apiRoutes";

type ContractorListItem = {
  id: string;
  contractorId?: string;
  name?: string | null;
  companyName?: string | null;
  taxPin?: string | null;
  taxNumber?: string | null;
  csdNumber?: string | null;
  csdMNumber?: string | null;
  status?: string | null;
  createdAt?: string | number | null;
  updatedAt?: string | number | null;
  logoUrl?: string | null;
  businessLogoUrl?: string | null;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<ContractorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch(API_ROUTES.CONTRACTORS, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to fetch contractors.");
        }
        return Array.isArray(data) ? (data as ContractorListItem[]) : [];
      })
      .then((items) => {
        setContractors(items);
        setError(null);
      })
      .catch((fetchError: unknown) => {
        setContractors([]);
        setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch contractors.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const statusSummary = useMemo(() => {
    const ready = contractors.filter((contractor) => clean(contractor.status).toLowerCase() === "ready").length;
    const active = contractors.filter((contractor) => clean(contractor.status).toLowerCase() === "active").length;
    const pending = Math.max(contractors.length - ready - active, 0);
    return { ready: ready + active, pending };
  }, [contractors]);

  return (
    <div className="space-y-5 p-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
          Contractor Management
        </h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Staff view of contractor onboarding and business documentation.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-[#111827] p-4 text-slate-100">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">
            {statusSummary.ready} ready or active, {statusSummary.pending} pending review
          </p>
          <span className="inline-flex self-start rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
            Live contractor files
          </span>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5 text-sm text-slate-300">
          Loading contractors...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/30 p-5 text-sm text-rose-100">
          {error}
        </div>
      ) : contractors.length ? (
        <div className="space-y-3">
          {contractors.map((contractor) => {
            const contractorId = contractor.contractorId || contractor.id;
            const companyName = clean(contractor.companyName) || clean(contractor.name) || "Contractor";

            return (
              <ContractorBusinessIdCard
                key={contractorId}
                contractorId={contractorId}
                companyName={companyName}
                taxNumber={contractor.taxPin ?? contractor.taxNumber}
                csdNumber={contractor.csdNumber ?? contractor.csdMNumber}
                onboardedAt={contractor.createdAt}
                status={contractor.status}
                lastDocumentUpdateAt={contractor.updatedAt}
                logoUrl={contractor.logoUrl ?? contractor.businessLogoUrl}
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-[#111827] p-8 text-center text-sm text-slate-400">
          No contractors found.
        </div>
      )}
    </div>
  );
}
