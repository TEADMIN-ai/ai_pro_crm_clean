"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getContractors } from "@/lib/contractors/getContractors";

type Contractor = {
  id: string;
  companyName: string;
  name?: string;
  email?: string;
  status?: string;
};

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await getContractors();
        setContractors(result);
      } catch (err: any) {
        console.error("Failed to fetch contractors:", err);
        setError(err.message || "Failed to load contractors");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return <div>Loading contractors...</div>;
  }

  if (error) {
    return <div style={{ color: "red" }}>{error}</div>;
  }

  return (
    <div>
      <h1>Contractors</h1>

      {contractors.length === 0 && (
        <div>No contractors found.</div>
      )}

      {contractors.map((contractor) => (
        <div key={contractor.id}>
          <Link href={`/dashboard/contractors/${contractor.id}`}>
            {contractor.companyName}
          </Link>
        </div>
      ))}
    </div>
  );
}19