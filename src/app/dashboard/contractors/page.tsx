"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_ROUTES } from "@/lib/constants/routes";
import { authFetch } from "@/lib/client/authFetch";
import { useAuth } from "@/context/AuthContext";

interface Contractor {
  id: string;
  companyName?: string;
  email?: string;
  [key: string]: any;
}

export default function ContractorsPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (role === "contractor") {
      router.replace(`/dashboard/contractors/${encodeURIComponent(user?.contractorId ?? "")}`);
      return;
    }

    const fetchContractors = async () => {
      try {
        const res = await authFetch(API_ROUTES.CONTRACTORS);

        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }

        const data = await res.json();
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

    void fetchContractors();
  }, [authLoading, role, router, user?.contractorId]);

  if (authLoading || loading) {
    return <div style={{ padding: "2rem" }}>Loading contractors...</div>;
  }

  if (error) {
    return <div style={{ padding: "2rem", color: "red" }}>{error}</div>;
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Contractors</h1>

      {contractors.length === 0 ? (
        <p>No contractors found.</p>
      ) : (
        <table
          style={{
            width: "100%",
            marginTop: "1rem",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Company</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Email</th>
            </tr>
          </thead>
          <tbody>
            {contractors.map((contractor) => (
              <tr key={contractor.id}>
                <td style={{ padding: "0.5rem 0" }}>{contractor.companyName || "-"}</td>
                <td style={{ padding: "0.5rem 0" }}>{contractor.email || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
