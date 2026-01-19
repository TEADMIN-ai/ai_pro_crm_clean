'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import HeroBanner from '@/components/hero/HeroBanner';
import { Deal } from '@/types/deal';

export default function StaffDashboardPage() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadDeals = async () => {
      const q = query(
        collection(db, 'deals'),
        where('ownerId', '==', user.uid)
      );
      const snap = await getDocs(q);
      setDeals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Deal)));
      setLoading(false);
    };

    loadDeals();
  }, [user]);

  return (
    <div>
      {/* HERO */}
      <HeroBanner role="staff" />

      {/* KPI ROW */}
      <div style={kpiGrid}>
        <KpiCard label="My Deals" value={deals.length} />
        <KpiCard
          label="Open"
          value={deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').length}
        />
        <KpiCard
          label="Won"
          value={deals.filter((d) => d.stage === 'won').length}
        />
      </div>

      {/* DEAL LIST */}
      {loading ? (
        <p>Loading deals…</p>
      ) : deals.length === 0 ? (
        <p>No deals assigned to you.</p>
      ) : (
        <div style={list}>
          {deals.map((deal) => (
            <div key={deal.id} style={dealRow}>
              <strong>{deal.title}</strong>
              <span style={{ opacity: 0.7 }}>{deal.stage}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===== UI ===== */

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={kpiCard}>
      <div style={{ opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const kpiGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 20,
  marginTop: 24,
};

const kpiCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 16,
  padding: 20,
};

const list: React.CSSProperties = {
  marginTop: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const dealRow: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  padding: 16,
  borderRadius: 12,
  display: 'flex',
  justifyContent: 'space-between',
};