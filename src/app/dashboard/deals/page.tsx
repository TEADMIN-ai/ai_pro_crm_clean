"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";
import KanbanBoard from "@/components/deals/KanbanBoard";
import { useAuthContext } from "@/context/AuthContext";
import { db } from "@/lib/firebase";

type Deal = {
  id: string;
  title?: string;
  status?: string;
  assignedTo?: string | null;
  companyId?: string;
  createdAt?: any;
  updatedAt?: any;
  slaDueAt?: any;
};

const STATUSES = ["new", "contacted", "negotiation", "won", "lost"] as const;

export default function DealsPage() {
  const { user, loading } = useAuthContext();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDrag = useMemo(() => {
    if (!user) return false;
    return user.role === "admin" || user.role === "manager" || user.role === "staff";
  }, [user]);

  const loadDeals = async () => {
    if (!user) return;

    setError(null);
    try {
      const dealsRef = collection(db, "deals");

      // Admin/Manager: all company deals
      // Staff: only assigned deals
      const q =
        user.role === "staff"
          ? query(
              dealsRef,
              where("companyId", "==", user.companyId),
              where("assignedTo", "==", user.uid),
              orderBy("createdAt", "desc")
            )
          : query(
              dealsRef,
              where("companyId", "==", user.companyId),
              orderBy("createdAt", "desc")
            );

      const snap = await getDocs(q);
      setDeals(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Deal, "id">),
        }))
      );
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to load deals");
    }
  };

  useEffect(() => {
    if (!loading && user) {
      loadDeals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.uid]);

  const moveDeal = async (dealId: string, nextStatus: string) => {
    if (!user) return;
    if (!STATUSES.includes(nextStatus as any)) return;

    // Optimistic UI update
    const prev = deals;
    setDeals((ds) =>
      ds.map((d) => (d.id === dealId ? { ...d, status: nextStatus } : d))
    );

    setBusy(true);
    setError(null);

    try {
      const ref = doc(db, "deals", dealId);
      await updateDoc(ref, {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (e: any) {
      console.error(e);
      // Rollback if failed
      setDeals(prev);
      setError(e?.message ?? "Failed to update status");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div style={{ padding: 32 }}>Loading…</div>;
  if (!user) return <div style={{ padding: 32 }}>Not signed in.</div>;

  return (
    <RequireRole allow={["admin", "manager", "staff"]}>
      <main style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Deals</h1>
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              Drag cards between columns to update status.
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              onClick={loadDeals}
              disabled={busy}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
              }}
            >
              {busy ? "Working…" : "Refresh"}
            </button>
            <LogoutButton />
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(239,68,68,0.4)",
              background: "rgba(239,68,68,0.12)",
              marginBottom: 14,
              whiteSpace: "pre-wrap",
            }}
          >
            {error}
          </div>
        )}

        <KanbanBoard deals={deals} onMove={moveDeal} canDrag={canDrag} />
      </main>
    </RequireRole>
  );
}