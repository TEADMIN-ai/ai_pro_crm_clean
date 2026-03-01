"use client";

import { useEffect, useState } from "react";
import { API_ROUTES } from "@/lib/routes";

interface Contractor {
  id: string;
  companyName?: string;
  email?: string;
  [key: string]: any;
}

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContractors = async () => {
      try {
        const res = await fetch(API_ROUTES.CONTRACTORS);

        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }

        const data = await res.json();

        // 🔒 Strict contract validation
        if (!data || !Array.isArray(data.contractors)) {
          setError("Malformed contractor response");
          setContractors([]);
          return;
        }

        setContractors(data.contractors);
      } catch (err) {
        console.error("Failed to load contractors:", err);
        setError("Failed to load contractors");
      } finally {
        setLoading(false);
      }
    };

    fetchContractors();
  }, []);

  if (loading) {
    return <div style={{ padding: "2rem" }}>Loading contractors...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", color: "red" }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Contractors</h1>

      {contractors.length === 0 ? (
        <p>No contractors found.</p>
      ) : (
        <table style={{ width: "100%", marginTop: "1rem", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Company</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Email</th>
            </tr>
          </thead>
          <tbody>
            {contractors.map((contractor) => (
              <tr key={contractor.id}>
                <td style={{ padding: "0.5rem 0" }}>
                  {contractor.companyName || "—"}
                </td>
                <td style={{ padding: "0.5rem 0" }}>
                  {contractor.email || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
