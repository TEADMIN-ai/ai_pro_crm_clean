'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

import HeroBanner from '@/components/hero/HeroBanner';
import PipelineChart from '@/components/charts/PipelineChart';

import { getHeroImage } from '@/config/heroRules';
import { Deal } from '@/types/deal';

export default function ManagerDashboardPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const snap = await getDocs(collection(db, 'deals'));
        const data: Deal[] = snap.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as Omit<Deal, 'id'>),
        }));
        setDeals(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load deals', err);
        setDeals([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, []);

  /* ---------- SAFE KPIs ---------- */
  const totalDeals = deals.length;
  const unassignedDeals = deals.filter(d => !d.ownerId).length;
  const wonDeals = deals.filter(d => d.stage === 'won').length;
  const lostDeals = deals.filter(d => d.stage === 'lost').length;

  const heroImage = getHeroImage({
    role: 'manager',
    totalDeals,
    unassignedDeals,
    isMonthEnd: new Date().getDate() >= 25,
  });

  return (
    <div style={{ padding: 24 }}>
      {/* HERO */}
      <HeroBanner
        image={heroImage}
        title="Manager Dashboard"
        subtitle="Monitor deals, performance, and pipeline health"
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
        <KpiCard label="Total Deals" value={totalDeals} />
        <KpiCard label="Unassigned" value={unassignedDeals} />
        <KpiCard label="Won" value={wonDeals} />
        <KpiCard label="Lost" value={lostDeals} />
      </div>

      {/* CHARTS */}
      <div style={{ marginTop: 32 }}>
        <PipelineChart deals={deals} />
      </div>

      {/* RECENT DEALS */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ marginBottom: 12 }}>Recent Deals</h3>

        {loading && <div>Loading deals…</div>}

        {!loading && deals.length === 0 && (
          <div>No deals found.</div>
        )}

        {!loading &&
          deals.slice(0, 5).map(deal => (
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
                Stage: {deal.stage ?? 'unknown'}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ---------- KPI CARD ---------- */
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