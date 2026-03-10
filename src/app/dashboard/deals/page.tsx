"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { canCreateDeal } from "@/lib/auth/roleUtils";
import Table from "@/components/ui/Table";
import { API_ROUTES } from "@/lib/routes";
import { authFetch } from "@/lib/client/authFetch";

type DealListItem = {
  id: string;
  title: string;
  contractorId: string;
  contractorName: string;
  value: number;
  status: "draft" | "submitted" | "awarded";
  createdAt: number;
};

export default function DealsPage() {
  const router = useRouter();
  const { role } = useAuth();
  const [deals, setDeals] = useState<DealListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDeals() {
      try {
        setLoading(true);
        setError(null);

        const res = await authFetch(API_ROUTES.DEALS, {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          throw new Error(`Failed to load deals (${res.status})`);
        }

        const payload = (await res.json()) as { deals?: DealListItem[] };
        setDeals(Array.isArray(payload.deals) ? payload.deals : []);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load deals");
      } finally {
        setLoading(false);
      }
    }

    void loadDeals();
  }, []);

  return (
    <div>
      <h1>{role === "contractor" ? "My Deals" : "Deals"}</h1>

      {canCreateDeal(role) && (
        <div style={{ marginTop: 20 }}>
          <Link
            href="/dashboard/deals/new"
            style={{
              padding: "10px 16px",
              background: "#2563eb",
              color: "white",
              borderRadius: 6,
              display: "inline-block",
            }}
          >
            Create Deal
          </Link>
        </div>
      )}

      {loading && <p style={{ marginTop: 20 }}>Loading deals...</p>}
      {error && <p style={{ marginTop: 20, color: "#b00020" }}>{error}</p>}

      {!loading && !error && (
        <div style={{ marginTop: 20 }}>
          <Table>
            <thead>
              <tr>
                <th>Deal Title</th>
                <th>Contractor</th>
                <th>Value</th>
                <th>Status</th>
                <th>Created Date</th>
              </tr>
            </thead>
            <tbody>
              {deals.length === 0 ? (
                <tr>
                  <td colSpan={5}>No deals found.</td>
                </tr>
              ) : (
                deals.map((deal) => (
                  <tr
                    key={deal.id}
                    onClick={() => router.push(`/dashboard/deals/${deal.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{deal.title || "Untitled deal"}</td>
                    <td>{deal.contractorName || deal.contractorId || "-"}</td>
                    <td>{Number(deal.value ?? 0).toLocaleString()}</td>
                    <td>{deal.status}</td>
                    <td>{deal.createdAt ? new Date(deal.createdAt).toLocaleDateString() : "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
