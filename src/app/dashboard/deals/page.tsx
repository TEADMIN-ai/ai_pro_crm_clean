"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useAuth } from "@/context/AuthContext";
import { canCreateDeal } from "@/lib/auth/roleUtils";
import Table from "@/components/ui/Table";
import { auth } from "@/lib/firebase";
import { API_ROUTES } from "@/lib/routes";
import { authFetch } from "@/lib/client/authFetch";

type DealContractorSummary = {
  companyName?: string | null;
  contractorName?: string | null;
  registrationNumber?: string | null;
};

type DealListItem = {
  id: string;
  title: string;
  contractorId: string;
  contractorName: string;
  contractor?: DealContractorSummary;
  value: number;
  status: "draft" | "submitted" | "awarded";
  createdAt: number;
};

export default function DealsPage() {
  const router = useRouter();
  const { role } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [deals, setDeals] = useState<DealListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔐 AUTH STATE
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      try {
        if (nextUser) {
          await nextUser.getIdToken(true);
          setUser(nextUser);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error(err);
        setUser(null);
        setError("Authentication failed");
      } finally {
        setLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 📡 FETCH DEALS FROM API (NO FIRESTORE HERE)
  useEffect(() => {
    if (loadingAuth) return;

    if (!user) {
      setDeals([]);
      setLoading(false);
      return;
    }

    async function loadDeals() {
      try {
        setLoading(true);
        setError(null);

        const res = await authFetch(API_ROUTES.DEALS, {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch deals");
        }

        setDeals(data.deals || []);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load deals");
      } finally {
        setLoading(false);
      }
    }

    loadDeals();
  }, [loadingAuth, user]);

  // 📄 GENERATE TENDER PACK
  const handleGenerateTenderPack = async (deal: DealListItem) => {
    try {
      const token = await user.getIdToken();

      const res = await fetch("/api/tender-pack/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dealId: deal.id,
          contractorId: deal.contractorId,
        }),
      });

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "tender-pack.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("Tender pack failed:", err);
    }
  };

  const handleSendEmail = async (deal: DealListItem) => {
    try {
      const token = await user.getIdToken();

      const res = await fetch("/api/tender-pack/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dealId: deal.id,
          contractorId: deal.contractorId,
        }),
      });

      const data = await res.json();

      const email = prompt("Enter recipient email:");

      if (!email) return;

      await fetch("/api/tender-pack/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          pdfBase64: data.base64,
        }),
      });

      alert("Tender Pack sent successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to send email");
    }
  };

  // 🧱 AUTH STATES
  if (loadingAuth) return <p>Authenticating...</p>;
  if (!user) return <p>Not authenticated</p>;

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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deals.length === 0 ? (
                <tr>
                  <td colSpan={6}>No deals found.</td>
                </tr>
              ) : (
                deals.map((deal) => (
                  <tr
                    key={deal.id}
                    onClick={() => router.push(`/dashboard/deals/${deal.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{deal.title || "Untitled deal"}</td>
                    <td>
                      {deal.contractor?.companyName ||
                        deal.contractor?.registrationNumber ||
                        (deal.contractorId ? "Unlinked Contractor" : "Unknown Contractor")}
                    </td>
                    <td>{Number(deal.value ?? 0).toLocaleString()}</td>
                    <td>{deal.status}</td>
                    <td>
                      {deal.createdAt
                        ? new Date(deal.createdAt).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleGenerateTenderPack(deal);
                        }}
                        className="px-3 py-1 bg-green-600 text-white rounded"
                      >
                        Generate Tender Pack
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleSendEmail(deal);
                        }}
                        className="px-3 py-1 bg-blue-600 text-white rounded ml-2"
                      >
                        Send Email
                      </button>
                    </td>
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
