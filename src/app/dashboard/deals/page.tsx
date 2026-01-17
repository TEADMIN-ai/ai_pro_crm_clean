"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthContext } from "@/context/AuthContext";

type Deal = {
  id: string;
  title: string;
  status: string;
  assignedTo?: string;
  companyId: string;
};

const STATUSES = ["new", "contacted", "negotiation", "won", "lost"];

export default function DealsPage() {
  const { user, loading } = useAuthContext();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function loadDeals() {
      try {
        let q;

        // 🔐 STAFF: only their assigned deals
        if (user.role === "staff") {
          q = query(
            collection(db, "deals"),
            where("assignedTo", "==", user.uid),
            where("companyId", "==", user.companyId)
          );
        }

        // 🔐 MANAGER + ADMIN: all company deals
        else {
          q = query(
            collection(db, "deals"),
            where("companyId", "==", user.companyId)
          );
        }

        const snap = await getDocs(q);
        const results: Deal[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Deal, "id">),
        }));

        setDeals(results);
      } catch (err) {
        console.error("Failed to load deals:", err);
      } finally {
        setLoadingDeals(false);
      }
    }

    loadDeals();
  }, [user]);

  if (loading || loadingDeals) {
    return <div style={{ padding: 40 }}>Loading deals…</div>;
  }

  const countByStatus = (status: string) =>
    deals.filter((d) => d.status === status).length;

  return (
    <div>
      {/* KPI CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 20,
          marginBottom: 32,
        }}
      >
        {STATUSES.map((status) => (
          <div
            key={status}
            style={{
              padding: 20,
              borderRadius: 16,
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))",
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {status.toUpperCase()}
            </div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>
              {countByStatus(status)}
            </div>
          </div>
        ))}
      </div>

      {/* KANBAN BOARD */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 20,
        }}
      >
        {STATUSES.map((status) => (
          <div
            key={status}
            style={{
              padding: 16,
              borderRadius: 18,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
              minHeight: 420,
            }}
          >
            <h3 style={{ marginBottom: 16 }}>{status.toUpperCase()}</h3>

            {deals
              .filter((d) => d.status === status)
              .map((deal) => (
                <div
                  key={deal.id}
                  style={{
                    padding: 16,
                    marginBottom: 14,
                    borderRadius: 14,
                    background:
                      "linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.05))",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
                    transition: "all 0.25s ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.transform = "translateY(-3px)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.transform = "translateY(0)")
                  }
                >
                  <strong>{deal.title}</strong>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}