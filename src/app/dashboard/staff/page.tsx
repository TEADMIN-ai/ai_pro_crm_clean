"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import DealCard from "@/components/deals/DealCard";

type Deal = {
  id: string;
  title: string;
  status: string;
  assignedTo?: string;
};

export default function StaffDashboardPage() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "won" | "lost" | "all">("open");

  useEffect(() => {
    if (!user) return;

    const loadDeals = async () => {
      setLoading(true);

      const q = query(
        collection(db, "deals"),
        where("assignedTo", "==", user.uid)
      );

      const snap = await getDocs(q);

      const rows: Deal[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Deal, "id">),
      }));

      setDeals(rows);
      setLoading(false);
    };

    loadDeals();
  }, [user]);

  // ✅ OPEN = new + contacted + negotiation
  const filteredDeals =
    filter === "all"
      ? deals
      : filter === "open"
      ? deals.filter((d) =>
          ["new", "contacted", "negotiation"].includes(d.status)
        )
      : deals.filter((d) => d.status === filter);

  const openCount = deals.filter((d) =>
    ["new", "contacted", "negotiation"].includes(d.status)
  ).length;

  const wonCount = deals.filter((d) => d.status === "won").length;
  const lostCount = deals.filter((d) => d.status === "lost").length;

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>My Deals</h1>
      <p style={{ opacity: 0.7, marginBottom: 24 }}>
        Deals assigned to you
      </p>

      {/* KPI CARDS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 20,
          marginBottom: 32,
        }}
      >
        <KpiCard label="My Deals" value={deals.length} />
        <KpiCard label="Open" value={openCount} />
        <KpiCard label="Won" value={wonCount} />
        <KpiCard label="Lost" value={lostCount} />
      </div>

      {/* FILTER BUTTONS */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <FilterButton
          active={filter === "open"}
          onClick={() => setFilter("open")}
          label={`Open (${openCount})`}
        />
        <FilterButton
          active={filter === "won"}
          onClick={() => setFilter("won")}
          label={`Won (${wonCount})`}
        />
        <FilterButton
          active={filter === "lost"}
          onClick={() => setFilter("lost")}
          label={`Lost (${lostCount})`}
        />
        <FilterButton
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
        />
      </div>

      {/* DEAL LIST */}
      {loading ? (
        <div style={{ opacity: 0.7 }}>Loading deals…</div>
      ) : filteredDeals.length === 0 ? (
        <div style={{ opacity: 0.6 }}>No deals in this view.</div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {filteredDeals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================
   UI HELPERS
========================= */

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ fontSize: 14, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px",
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        background: active
          ? "linear-gradient(135deg,#2563eb,#1e40af)"
          : "rgba(255,255,255,0.08)",
        color: "#fff",
        fontSize: 14,
      }}
    >
      {label}
    </button>
  );
}