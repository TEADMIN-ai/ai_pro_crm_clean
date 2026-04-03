"use client";

import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { API_ROUTES } from "@/lib/apiRoutes";

type Contractor = {
  id: string;
  companyName?: string;
  companyRegistrationNumber?: string;
  email?: string;
  phone?: string;
  status?: string;
};

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContractors = async () => {
    try {
      setLoading(true);
      setError(null);

      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error("User not logged in");
      }

      const token = await user.getIdToken();

      const res = await fetch(API_ROUTES.CONTRACTORS, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to fetch contractors");
      }

      const data = await res.json();
      setContractors(data.contractors || []);
    } catch (err: any) {
      console.error("CONTRACTORS FETCH ERROR:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContractors();
  }, []);

  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>
        Contractors
      </h1>

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
              <strong>{contractor.companyName || contractor.id}</strong> <br />
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
