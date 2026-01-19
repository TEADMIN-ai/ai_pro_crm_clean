"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import RequireRole from "@/components/auth/RequireRole";
import LogoutButton from "@/components/auth/LogoutButton";
import DealCard from "@/components/deals/DealCard";
import { useAuthContext } from "@/context/AuthContext";

type Deal = {
  id: string;
  title: string;
  status: string;
  assignedTo?: string | null;
  companyId: string;
  createdAt?: any;
};

const STATUSES = ["new", "contacted", "negotiation", "won", "lost"];

export default function DealsPage() {
  const { user } = useAuthContext();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadDeals = async () => {
      let q;

      if (user.role === "staff") {
        // 🔐 Staff only sees assigned deals
        q = query(
          collection(db, "deals"),
          where("assignedTo", "==", user.uid),
          where("companyId", "==", user.companyId),
          orderBy("createdAt", "desc")
        );
      } else {
        // Admin & Manager see all company deals
        q = query(
          collection(db, "deals"),
          where("companyId", "==", user.companyId),
          orderBy("createdAt", "desc")
        );
      }

      const snap = await getDocs(q);
      setDeals(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Deal),
        }))
      );

      setLoading(false);
    };

    loadDeals();
  }, [user]);

  if (loading) {
    return <div style={{ padding: 32 }}>Loading deals…</div>;
  }

  return (
    <RequireRole allow={["admin", "manager", "staff"]}>
      <main style={{ padding: 32 }}>
        <LogoutButton />

        <h1 style={{ marginBottom: 24 }}>Deals</h1>

        {/* 🔷 Deal Board */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${STATUSES.length}, 1fr)`,
            gap: 16,
          }}
        >
          {STATUSES.map((status) => (
            <div key={status}>
              <h3
                style={{
                  textTransform: "capitalize",
                  marginBottom: 12,
                  opacity: 0.8,
                }}
              >
                {status}
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {deals
                  .filter((d) => d.status === status)
                  .map((deal) => (
                    <DealCard
                      key={deal.id}
                      title={deal.title}
                      status={deal.status}
                      assignedTo={deal.assignedTo || undefined}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </RequireRole>
  );
}