"use client";

import { useEffect, useState } from "react";
import { API_ROUTES } from "@/lib/apiRoutes";
import { authFetch } from "@/lib/client/authFetch";

type Contractor = {
  id: string;
  name?: string;
  company?: string;
  companyName?: string;
  companyRegistrationNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string;
};

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadContractors() {
    try {
      setLoading(true);
      setError(null);

      const res = await authFetch(API_ROUTES.CONTRACTORS);

      const data = (await res.json()) as Contractor[];
      setContractors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(" FRONTEND FETCH ERROR:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch contractors");
    } finally {
      setLoading(false);
    }
  }

  async function createContractor(data: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
  }) {
    try {
      const res = await authFetch(API_ROUTES.CONTRACTORS, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const newContractor = (await res.json()) as Contractor;

      setContractors((prev) => [newContractor, ...prev]);
    } catch (err) {
      console.error(" CREATE CONTRACTOR ERROR:", err);
    }
  }

  useEffect(() => {
    void loadContractors();
  }, []);

  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>
        Contractors
      </h1>

      <button
        onClick={() =>
          void createContractor({
            name: "Test Contractor",
            email: "test@demo.com",
          })
        }
        style={{ marginTop: "12px", marginBottom: "12px" }}
      >
        Add Test Contractor
      </button>

      {error && (
        <p style={{ color: "red", marginTop: "10px" }}>
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading contractors...</p>
      ) : contractors.length === 0 ? (
        <p>No contractors found</p>
      ) : (
        <ul style={{ marginTop: "20px" }}>
          {contractors.map((contractor) => (
            <li key={contractor.id} style={{ marginBottom: "10px" }}>
              <strong>{contractor.companyName || contractor.company || contractor.name || contractor.id}</strong> <br />
              Registration: {contractor.companyRegistrationNumber || "-"} <br />
              Email: {contractor.email || "-"} <br />
              Phone: {contractor.phone || "-"} <br />
              Status: {contractor.status || "-"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
