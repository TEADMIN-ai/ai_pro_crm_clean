"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { useAuth } from "@/context/AuthContext";
import HeroBanner from "@/components/hero/HeroBanner";
import { getHeroImage } from "@/config/heroRules";

import type { Deal } from "@/types/deal";

export default function StaffDashboardPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchDeals = async () => {
      try {
        const q = query(
          collection(db, "deals"),
          where("ownerId", "==", user.uid)
        );

        const snap = await getDocs(q);
        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Deal, "id">),
        }));

        setDeals(data);
      } catch (err) {
        console.error("Failed to load staff deals", err);
        setDeals([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, [user]);

  if (authLoading) {
    return <div style={{ padding: 24 }}>Loading dashboard…</div>;
  }

  // 🔒 Normalize role for hero system
  const heroRole =
    role === "admin" ? "manager" : role === "staff" ? "staff" : "manager";

  const heroImage = getHeroImage({
    role: heroRole,
  });

  return (
    <div style={{ padding: 24 }}>
      <HeroBanner
        image={heroImage}
        title="Staff Dashboard"
        subtitle="Your assigned deals and actions"
      />

      <div style={{ marginTop: 28 }}>
        <h3>Your Deals</h3>

        {loading && <div>Loading deals…</div>}
        {!loading && deals.length === 0 && <div>No deals assigned.</div>}

        {!loading &&
          deals.slice(0, 6).map((deal) => (
            <div
              key={deal.id}
              style={{
                padding: 16,
                borderRadius: 14,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.10)",
                marginBottom: 10,
              }}
            >
              <strong>{deal.title}</strong>
              <div style={{ opacity: 0.85, fontSize: 13, marginTop: 6 }}>
                Stage: {deal.stage ?? "lead"} • Value: ZAR{" "}
                {(deal.value ?? 0).toLocaleString("en-ZA")}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}