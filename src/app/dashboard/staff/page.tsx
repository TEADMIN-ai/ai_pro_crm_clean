'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import RequireRole from '@/components/auth/RequireRole';
import LogoutButton from '@/components/auth/LogoutButton';
import SalesBotPanel from '@/components/bot/SalesBotPanel';
import { useAuthContext } from '@/context/AuthContext';
import { Deal } from '@/types/deal';

export default function StaffDashboardPage() {
  const { user, loading: authLoading } = useAuthContext();
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

  if (authLoading || loading) {
    return <div style={{ padding: 24 }}>Loading staff dashboard…</div>;
  }

  return (
    <RequireRole allow={['staff']}>
      <main style={{ padding: 24 }}>
        <LogoutButton />

        <h1 style={{ marginBottom: 16 }}>Staff Dashboard</h1>

        {/* MAIN LAYOUT */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: 20,
            alignItems: 'start',
          }}
        >
          {/* LEFT — DEALS */}
          <div>
            <h3 style={{ marginBottom: 12 }}>My Assigned Deals</h3>

            {deals.length === 0 && (
              <div style={{ opacity: 0.7 }}>No deals assigned.</div>
            )}

            {deals.map(deal => (
              <div
                key={deal.id}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)',
                  marginBottom: 12,
                }}
              >
                <strong>{deal.title}</strong>
                <div style={{ fontSize: 13, opacity: 0.7 }}>
                  Stage: {deal.stage}
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT — SALES BOT */}
          <SalesBotPanel />
        </div>
      </main>
    </RequireRole>
  );
}