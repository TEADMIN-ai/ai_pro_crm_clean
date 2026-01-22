"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

import HeroBanner from "@/components/hero/HeroBanner";
import { Deal, DealStage } from "@/types/deal";

/* ------------------ STAGES (SINGLE SOURCE) ------------------ */
const DEAL_STAGES: DealStage[] = [
  "lead",
  "tender",
  "proposal",
  "negotiation",
  "won",
  "lost",
  "closed",
];

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const snap = await getDocs(collection(db, "deals"));
        const data: Deal[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Deal, "id">),
        }));
        setDeals(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load deals", err);
        setDeals([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      {/* HERO */}
      <HeroBanner
        title="Deals"
        subtitle="View and manage all active deals"
        backgroundImage="/images/hero-deals.jpg"
      />

      {/* CONTENT */}
      <div style={{ marginTop: 32 }}>
        {loading && <div>Loading deals…</div>}

        {!loading && deals.length === 0 && (
          <div>No deals found.</div>
        )}

        {!loading &&
          DEAL_STAGES.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage);
            if (stageDeals.length === 0) return null;

            return (
              <div key={stage} style={{ marginBottom: 32 }}>
                <h3
                  style={{
                    textTransform: "capitalize",
                    marginBottom: 12,
                    color: "#f8fafc",
                  }}
                >
                  {stage}
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                    gap: 16,
                  }}
                >
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      style={{
                        padding: 16,
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.08)",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                      }}
                    >
                      <strong>{deal.title}</strong>

                      <div
                        style={{
                          fontSize: 13,
                          opacity: 0.8,
                          marginTop: 4,
                        }}
                      >
                        Client: {deal.clientName ?? "—"}
                      </div>

                      {typeof deal.value === "number" && (
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          {deal.currency ?? "ZAR"}{" "}
                          {deal.value.toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}