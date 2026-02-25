"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/client/authFetch";
import type { Contractor } from "@/types/contractor";
import { API_ROUTES } from "@/lib/routes";

function contractorLabel(contractor: Contractor): string {
  return (
    contractor.companyName?.trim() ||
    contractor.name?.trim() ||
    contractor.contactPerson?.trim() ||
    contractor.email?.trim() ||
    contractor.id
  );
}

export default function NewDealPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [contractorId, setContractorId] = useState("");
  const [value, setValue] = useState("");
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loadingContractors, setLoadingContractors] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadContractors() {
      try {
        const result = await authFetch(API_ROUTES.CONTRACTORS);
        if (!result.ok) {
          if (result.code === "AUTH") {
            setError("Session expired. Please login again.");
            router.push("/login");
            return;
          }
          throw new Error(result.message);
        }

        const { response: res } = result;

        if (!res.ok) {
          throw new Error("Failed to fetch contractors");
        }

        const data = await res.json() as { contractors?: Contractor[] };

        setContractors(data.contractors || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load contractors");
      } finally {
        setLoadingContractors(false);
      }
    }

    loadContractors();
  }, [router]);

  const selectedContractorName = useMemo(
    () => {
      const selected = contractors.find((item) => item.id === contractorId);
      return selected ? contractorLabel(selected) : "";
    },
    [contractorId, contractors]
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const parsedValue = Number(value);
      const safeValue = Number.isFinite(parsedValue) ? parsedValue : 0;

      const result = await authFetch(API_ROUTES.DEALS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          contractorId,
          contractorName: selectedContractorName,
          value: safeValue,
          status: "draft",
        }),
      });
      if (!result.ok) {
        if (result.code === "AUTH") {
          setError("Session expired. Please login again.");
          router.push("/login");
          return;
        }
        throw new Error(result.message);
      }

      const { response: res } = result;

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to create deal");
      }

      router.push("/dashboard/deals");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create deal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1>New Deal</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label htmlFor="deal-title">Deal Title</label>
        <input
          id="deal-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />

        <label htmlFor="deal-contractor">Contractor</label>
        <select
          id="deal-contractor"
          value={contractorId}
          onChange={(event) => setContractorId(event.target.value)}
          disabled={loadingContractors}
          required
        >
          <option value="">{loadingContractors ? "Loading contractors..." : "Select contractor"}</option>
          {contractors.map((contractor) => (
            <option key={contractor.id} value={contractor.id}>
              {contractorLabel(contractor)}
            </option>
          ))}
        </select>

        <label htmlFor="deal-value">Value</label>
        <input
          id="deal-value"
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
        />

        <button type="submit" disabled={submitting || loadingContractors}>
          {submitting ? "Creating..." : "Submit"}
        </button>
      </form>
      {error ? <p style={{ color: "#b00020", marginTop: 12 }}>{error}</p> : null}
    </div>
  );
}


