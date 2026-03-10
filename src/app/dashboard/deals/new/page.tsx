"use client";

import { useState, useEffect } from "react";
import { authFetch } from "@/lib/client/authFetch";
import { API_ROUTES } from "@/lib/routes";
import { useAuth } from "@/context/AuthContext";

type ContractorOption = {
  id: string;
  companyName: string;
};

export default function NewDealPage() {
  const { user, role } = useAuth();
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [contractors, setContractors] = useState<ContractorOption[]>([]);
  const [contractorId, setContractorId] = useState("");

  useEffect(() => {
    async function loadContractors() {
      try {
        const response = await authFetch(API_ROUTES.CONTRACTORS);
        if (!response.ok) {
          throw new Error(`Failed to fetch contractors: ${response.status}`);
        }

        const data = (await response.json()) as unknown;
        if (
          typeof data !== "object" ||
          data === null ||
          !Array.isArray((data as { contractors?: unknown[] }).contractors)
        ) {
          throw new Error("Malformed contractor response");
        }

        const source = (data as { contractors: unknown[] }).contractors;
        const normalized: ContractorOption[] = source
          .map((item) => ({
            id:
              typeof item === "object" &&
              item !== null &&
              typeof (item as { id?: unknown }).id === "string"
                ? (item as { id: string }).id
                : "",
            companyName:
              typeof item === "object" &&
              item !== null &&
              typeof (item as { companyName?: unknown }).companyName === "string"
                ? (item as { companyName: string }).companyName
                : "",
          }))
          .filter((item) => item.id.length > 0);

        setContractors(normalized);

        if (role === "contractor" && user?.contractorId) {
          setContractorId(user.contractorId);
        }
      } catch {
        setContractors([]);
      }
    }

    void loadContractors();
  }, [role, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const resolvedContractorId = role === "contractor" ? user?.contractorId ?? contractorId : contractorId;
    const selectedContractor = contractors.find((contractor) => contractor.id === resolvedContractorId);

    const res = await authFetch(API_ROUTES.DEALS, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        value: Number(value),
        contractorId: resolvedContractorId,
        contractorName: selectedContractor?.companyName ?? "",
      }),
    });

    if (res.ok) {
      alert("Deal created successfully");
      window.location.href = "/dashboard/deals";
    } else {
      alert("Failed to create deal");
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>New Deal</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Deal Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div>
          <label>Contractor</label>
          <select
            value={contractorId}
            onChange={(e) => setContractorId(e.target.value)}
            required
            disabled={role === "contractor"}
          >
            <option value="">Select contractor</option>
            {contractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.companyName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Value</label>
          <input value={value} onChange={(e) => setValue(e.target.value)} required />
        </div>

        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
