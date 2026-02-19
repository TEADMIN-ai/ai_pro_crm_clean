"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useAuth } from "@/context/AuthContext";
import { canViewContractorList } from "@/lib/auth/roleUtils";
import { getContractors } from "@/lib/contractors/getContractors";
import type { Contractor } from "@/types/contractor";

export default function ContractorsPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!canViewContractorList(role)) {
      router.replace("/dashboard");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const rows = await getContractors();
        if (!cancelled) {
          setContractors(rows);
        }
      } catch (listError) {
        if (!cancelled) {
          const message =
            listError instanceof Error ? listError.message : "Failed to load contractors";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user, role, router]);

  if (loading || isLoading) {
    return <div style={{ padding: 40 }}>Loading contractors...</div>;
  }

  if (!user || !canViewContractorList(role)) {
    return null;
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Contractors</h1>

      {error ? (
        <p style={{ color: "#dc2626" }}>{error}</p>
      ) : contractors.length === 0 ? (
        <p>No contractors found.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 16,
          }}
        >
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={cellStyle}>Company Name</th>
              <th style={cellStyle}>Contact Person</th>
              <th style={cellStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {contractors.map((contractor) => (
              <tr key={contractor.id}>
                <td style={cellStyle}>
                  <Link href={`/dashboard/contractors/${contractor.id}`}>
                    {contractor.companyName}
                  </Link>
                </td>
                <td style={cellStyle}>{contractor.contactPerson}</td>
                <td style={cellStyle}>{contractor.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const cellStyle: CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px 6px",
};
