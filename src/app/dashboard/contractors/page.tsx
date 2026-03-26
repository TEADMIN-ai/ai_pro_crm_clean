"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Card, { IdentityCardHeader } from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";

type ContractorStatus = "pending" | "active" | "inactive";

interface Contractor {
  id: string;
  companyName?: string | null;
  companyRegistrationNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  readinessScore?: number | null;
  status?: string | null;
}

interface ContractorFormState {
  companyName: string;
  companyRegistrationNumber: string;
  email: string;
  phone: string;
  status: ContractorStatus;
}

const INITIAL_FORM_STATE: ContractorFormState = {
  companyName: "",
  companyRegistrationNumber: "",
  email: "",
  phone: "",
  status: "pending",
};

function resolveBadgeTone(status?: string | null): "warning" | "success" | "neutral" {
  if (status === "active") {
    return "success";
  }

  if (status === "inactive") {
    return "neutral";
  }

  return "warning";
}

export default function ContractorsPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState<ContractorFormState>(INITIAL_FORM_STATE);

  async function loadContractors() {
    setError(null);

    try {
      const response = await authFetch(API_ROUTES.CONTRACTORS);

      if (!response.ok) {
        throw new Error(`Failed to fetch contractors (${response.status})`);
      }

      const payload = (await response.json()) as { contractors?: Contractor[] };
      setContractors(Array.isArray(payload.contractors) ? payload.contractors : []);
    } catch (loadError) {
      console.error("Failed to load contractors:", loadError);
      setError("Failed to load contractors");
      setContractors([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (role === "contractor") {
      router.replace(`/dashboard/contractors/${encodeURIComponent(user?.contractorId ?? "")}`);
      return;
    }

    void loadContractors();
  }, [authLoading, role, router, user?.contractorId]);

  function openCreateModal() {
    setForm(INITIAL_FORM_STATE);
    setSubmitError(null);
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    if (isSubmitting) {
      return;
    }

    setIsCreateModalOpen(false);
    setSubmitError(null);
  }

  async function handleCreateContractor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await authFetch(API_ROUTES.CONTRACTORS, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create contractor");
      }

      setIsCreateModalOpen(false);
      setForm(INITIAL_FORM_STATE);
      await loadContractors();
    } catch (submitFailure) {
      console.error("Create contractor error:", submitFailure);
      setSubmitError(submitFailure instanceof Error ? submitFailure.message : "Failed to create contractor");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return <div className="enterprise-page">Loading contractors...</div>;
  }

  if (role !== "admin" && role !== "manager" && role !== "staff") {
    return <div className="enterprise-page">Access denied</div>;
  }

  return (
    <div className="enterprise-page enterprise-grid">
      <Card>
        <IdentityCardHeader title="Contractors" subtitle="Workspace for onboarding, oversight, and compliance readiness">
          <Badge tone="info">Total {contractors.length}</Badge>
          <button type="button" onClick={openCreateModal}>
            Create Contractor
          </button>
        </IdentityCardHeader>
      </Card>

      <Card>
        <h2>Contractor Register</h2>
        <p>Track supplier onboarding and open each contractor workspace from a single operational view.</p>
        {error ? <p className="enterprise-form-error">{error}</p> : null}
        {contractors.length === 0 ? (
          <p>No contractors found.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Registration Number</th>
                <th>Contact Email</th>
                <th>Contact Phone</th>
                <th>READINESS</th>
                <th>Status</th>
                <th>Workspace</th>
              </tr>
            </thead>
            <tbody>
              {contractors.map((contractor) => {
                const readinessScore = contractor.readinessScore ?? 0;

                let readinessLabel = "BLOCKED";

                if (readinessScore >= 80) {
                  readinessLabel = "READY";
                } else if (readinessScore >= 60) {
                  readinessLabel = "RISK";
                }

                return (
                  <tr key={contractor.id}>
                    <td>{contractor.companyName ?? "-"}</td>
                    <td>{contractor.companyRegistrationNumber ?? "-"}</td>
                    <td>{contractor.email ?? "-"}</td>
                    <td>{contractor.phone ?? "-"}</td>
                    <td>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${
                          readinessLabel === "READY"
                            ? "bg-green-500/20 text-green-400 border border-green-500/30"
                            : readinessLabel === "RISK"
                              ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                              : "bg-red-500/20 text-red-400 border border-red-500/30"
                        }`}
                      >
                        {readinessLabel} {readinessScore}%
                      </span>
                    </td>
                    <td>
                      <Badge tone={resolveBadgeTone(contractor.status)}>
                        {contractor.status ?? "pending"}
                      </Badge>
                    </td>
                    <td>
                      <Link href={`/dashboard/contractors/${encodeURIComponent(contractor.id)}`}>
                        Open workspace
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {isCreateModalOpen ? (
        <div
          className="enterprise-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-contractor-title"
          onClick={closeCreateModal}
        >
          <div className="enterprise-modal" onClick={(event) => event.stopPropagation()}>
            <div className="enterprise-modal-header">
              <div>
                <h2 id="create-contractor-title">Create Contractor</h2>
                <p>Add a contractor record to the CRM and initialize compliance tracking.</p>
              </div>
              <button type="button" className="enterprise-button-secondary" onClick={closeCreateModal}>
                Close
              </button>
            </div>

            <form className="enterprise-form-grid" onSubmit={handleCreateContractor}>
              <label className="enterprise-field">
                <span>Company name</span>
                <input
                  className="enterprise-input"
                  value={form.companyName}
                  onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
                  required
                />
              </label>

              <label className="enterprise-field">
                <span>Registration number</span>
                <input
                  className="enterprise-input"
                  value={form.companyRegistrationNumber}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, companyRegistrationNumber: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="enterprise-field">
                <span>Contact email</span>
                <input
                  className="enterprise-input"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  required
                />
              </label>

              <label className="enterprise-field">
                <span>Contact phone</span>
                <input
                  className="enterprise-input"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  required
                />
              </label>

              <label className="enterprise-field">
                <span>Status</span>
                <select
                  className="enterprise-input"
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value as ContractorStatus }))
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>

              {submitError ? <p className="enterprise-form-error">{submitError}</p> : null}

              <div className="enterprise-form-actions">
                <button type="button" className="enterprise-button-secondary" onClick={closeCreateModal}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Contractor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
