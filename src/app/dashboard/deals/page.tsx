"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import DealCard from "@/components/deals/DealCard";

type Deal = {
  id: string;
  title?: string;
  status?: string;
  assignedTo?: string;
  slaDueAt?: any;
};

const STATUSES = ["new", "contacted", "negotiation", "won", "lost"];

/* ========= SLA SORTING ========= */
function getSlaPriority(deal: Deal) {
  if (!deal.slaDueAt) return 3;

  const due =
    typeof deal.slaDueAt.toDate === "function"
      ? deal.slaDueAt.toDate()
      : new Date(deal.slaDueAt);

  const now = new Date();
  const diffMinutes = Math.floor(
    (due.getTime() - now.getTime()) / 60000
  );

  if (diffMinutes <= 0) return 0; // breached
  if (diffMinutes <= 60) return 1; // urgent
  return 2; // healthy
}

function sortBySlaUrgency(deals: Deal[]) {
  return [...deals].sort(
    (a, b) => getSlaPriority(a) - getSlaPriority(b)
  );
}
/* ============================== */

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDeals() {
      const snap = await getDocs(collection(db, "deals"));
      const rows: Deal[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      setDeals(rows);
      setLoading(false);
    }

    loadDeals();
  }, []);

  if (loading) {
    return (
      <div style={{ opacity: 0.6 }}>Loading deals…</div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 24 }}>
        Deals
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 20,
        }}
      >
        {STATUSES.map((status) => {
          const columnDeals = sortBySlaUrgency(
            deals.filter(
              (d) =>
                (d.status ?? "new").toLowerCase() ===
                status
            )
          );

          return (
            <div
              key={status}
              style={{
                background:
                  "rgba(255,255,255,0.03)",
                borderRadius: 16,
                padding: 16,
                minHeight: 300,
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  marginBottom: 12,
                  textTransform: "uppercase",
                  opacity: 0.85,
                }}
              >
                {status}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {columnDeals.length === 0 && (
                  <div
                    style={{
                      opacity: 0.4,
                      fontSize: 13,
                    }}
                  >
                    No deals
                  </div>
                )}

                {columnDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}