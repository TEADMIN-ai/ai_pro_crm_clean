"use client";

import { useEffect, useMemo, useState } from "react";
import ContractorBusinessIdCard from "@/components/contractors/ContractorBusinessIdCard";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/apiRoutes";
import { useAuth } from "@/context/AuthContext";
import type { FormEvent } from "react";

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
  lastDocumentUpdateAt?: string | number | null;
  logoUrl?: string | null;
  businessLogoUrl?: string | null;
};

type ContractorCreateForm = {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  registrationNumber: string;
};

const EMPTY_CREATE_FORM: ContractorCreateForm = {
  companyName: "",
  contactPerson: "",
  email: "",
  phone: "",
  registrationNumber: "",
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export default function ContractorsPage() {
  const { role } = useAuth();
  const [contractors, setContractors] = useState<ContractorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<ContractorCreateForm>(EMPTY_CREATE_FORM);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);
  const [createdEmailSent, setCreatedEmailSent] = useState<boolean | null>(null);

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

  const canCreateContractorUser = role === "admin" || role === "manager";

  async function handleCreateContractor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setCreatedInviteLink(null);
    setCreatedEmailSent(null);

    const companyName = createForm.companyName.trim();
    const contactPerson = createForm.contactPerson.trim();
    const email = createForm.email.trim();
    const phone = createForm.phone.trim();
    const registrationNumber = createForm.registrationNumber.trim();

    if (!companyName || !contactPerson || !email || !phone || !registrationNumber) {
      setCreateError("All contractor user fields are required.");
      return;
    }

    setCreateBusy(true);

    try {
      const response = await authFetch(API_ROUTES.CONTRACTORS, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName,
          contactPerson,
          email,
          phone,
          contactPhone: phone,
          registrationNumber,
          companyRegistrationNumber: registrationNumber,
          role: "contractor",
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        contractor?: ContractorListItem;
        contractorId?: string;
        passwordResetLink?: string;
        emailSent?: boolean;
      } | null;

      if (!response.ok || payload?.success !== true || !payload.contractor) {
        throw new Error(payload?.error ?? `Failed to create contractor user (${response.status})`);
      }

      setContractors((current) => [payload.contractor as ContractorListItem, ...current]);
      setCreatedInviteLink(payload.passwordResetLink ?? null);
      setCreatedEmailSent(payload.emailSent ?? false);
      setCreateForm(EMPTY_CREATE_FORM);
    } catch (createErrorValue) {
      setCreateError(createErrorValue instanceof Error ? createErrorValue.message : "Failed to create contractor user.");
    } finally {
      setCreateBusy(false);
    }
  }

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
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex self-start rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
              Live contractor files
            </span>
            {canCreateContractorUser ? (
              <button
                type="button"
                onClick={() => setShowCreateForm((current) => !current)}
                className="rounded-full border border-emerald-400/30 bg-emerald-500 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white"
              >
                {showCreateForm ? "Close" : "Create Contractor User"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {canCreateContractorUser && showCreateForm ? (
        <section className="rounded-2xl border border-slate-800 bg-[#111827] p-5 text-slate-100">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Create Contractor User</h2>
            <p className="mt-1 text-sm text-slate-400">
              Creates Firebase Auth, users record, contractor record, contractor role, and onboarding invitation.
            </p>
          </div>
          <form onSubmit={handleCreateContractor} className="grid gap-4 md:grid-cols-2">
            {[
              ["companyName", "Company Name"],
              ["contactPerson", "Contact Person"],
              ["email", "Email"],
              ["phone", "Mobile Number"],
              ["registrationNumber", "Registration Number"],
            ].map(([field, label]) => (
              <label key={field} className="grid gap-1 text-sm font-medium text-slate-200">
                {label}
                <input
                  value={createForm[field as keyof ContractorCreateForm]}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      [field]: event.target.value,
                    }))
                  }
                  type={field === "email" ? "email" : "text"}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                  disabled={createBusy}
                  required
                />
              </label>
            ))}
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={createBusy}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {createBusy ? "Creating..." : "Create Contractor User"}
              </button>
              {createError ? <p className="mt-3 text-sm font-medium text-rose-200">{createError}</p> : null}
              {createdInviteLink ? (
                <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-950/40 p-3 text-sm text-emerald-100">
                  <p className="font-semibold">
                    {createdEmailSent ? "Onboarding email sent." : "Onboarding invitation generated for manual recovery."}
                  </p>
                  <a href={createdInviteLink} className="break-all text-emerald-200 underline">
                    {createdInviteLink}
                  </a>
                </div>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}

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
                lastDocumentUpdateAt={contractor.lastDocumentUpdateAt ?? contractor.updatedAt}
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
