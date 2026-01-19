'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import HeroBanner from '@/components/hero/HeroBanner';
import DealCard from '@/components/deals/DealCard';
import { Deal } from '@/types/deal';
import { DealStage } from '@/types/deal';

const STAGES: DealStage[] = [
  'lead',
  'tender',
  'proposal',
  'negotiation',
  'won',
  'lost',
  'closed',
];

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDeals = async () => {
      const snap = await getDocs(collection(db, 'deals'));
      setDeals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Deal)));
      setLoading(false);
    };

    loadDeals();
  }, []);

  return (
    <div>
      {/* HERO */}
      <HeroBanner role="deals" />

      {/* KPI ROW */}
      <div style={kpiGrid}>
        {STAGES.map((stage) => (
          <KpiCard
            key={stage}
            label={stage.toUpperCase()}
            value={deals.filter((d) => d.stage === stage).length}
          />
        ))}
      </div>

      {/* PIPELINE */}
      {loading ? (
        <p>Loading deals…</p>
      ) : (
        <div style={pipeline}>
          {STAGES.map((stage) => (
            <div key={stage} style={column}>
              <h4>{stage}</h4>
              {deals.filter((d) => d.stage === stage).length === 0 ? (
                <p style={{ opacity: 0.5 }}>No deals</p>
              ) : (
                deals
                  .filter((d) => d.stage === stage)
                  .map((deal) => <DealCard key={deal.id} deal={deal} />)
              )}
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
      <div style={{ fontSize: 26, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const kpiGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 16,
  marginTop: 24,
};

const kpiCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 16,
  padding: 16,
};

const pipeline: React.CSSProperties = {
  marginTop: 32,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 24,
};

const column: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  borderRadius: 16,
  padding: 16,
};