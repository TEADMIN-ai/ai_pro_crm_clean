'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';

import HeroBanner from '@/components/hero/HeroBanner';
import { getHeroImage } from '@/config/heroRules';

import { Deal } from '@/types/deal';
import { getStaffKpis } from '@/config/kpiDefinitions';

export default function StaffDashboardPage() {
  const { user } = useAuth();

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchDeals = async () => {
      try {
        const q = query(
          collection(db, 'deals'),
          where('ownerId', '==', user.uid)
        );

        const snap = await getDocs(q);

        const data: Deal[] = snap.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as Omit<Deal, 'id'>),
        }));

        setDeals(data);
      } catch (err) {
        console.error('Failed to load staff deals', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, [user]);

  /* =========================
     KPI COMPUTATION (LOCKED)
  ========================= */

  const kpis = getStaffKpis(deals, user?.uid ?? '');

  /* =========================
     HERO IMAGE (DATA DRIVEN)
  ========================= */

  const heroImage = getHeroImage({
    role: 'staff',
    myDeals: kpis.myDeals,
    openDeals: kpis.open,
  });

  return (
    <div style={{ padding: 24 }}>
      {/* HERO */}
      <HeroBanner
        image={heroImage}
        title="Staff Dashboard"
        subtitle="Your assigned deals and daily actions"
      />

      {/* KPI ROW */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginTop: 24,
        }}
      >
        <KpiCard label="My Deals" value={kpis.myDeals} />
        <KpiCard label="Open" value={kpis.open} />
        <KpiCard label="Won" value={kpis.won} />
        <KpiCard label="Lost" value={kpis.lost} />
      </div>

      {/* DEAL LIST */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ marginBottom: 12 }}>My Deals</h3>

        {loading && <div>Loading deals…</div>}

        {!loading && deals.length === 0 && (
          <div>No deals assigned to you.</div>
        )}

        {!loading &&
          deals.map(deal => (
            <div
              key={deal.id}
              style={{
                padding: 16,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                marginBottom: 10,
              }}
            >
              <strong>{deal.title}</strong>
              <div style={{ opacity: 0.7, fontSize: 13 }}>
                Stage: {deal.stage}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

/* =========================
   KPI CARD
========================= */

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 14,
        background: 'rgba(255,255,255,0.04)',
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>{value}</div>
    </div>
  );
}