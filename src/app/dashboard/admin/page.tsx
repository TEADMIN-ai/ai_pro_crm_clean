'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Deal } from '@/types/deal';

export default function AdminDashboardPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const snap = await getDocs(collection(db, 'deals'));

        const data: Deal[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Deal, 'id'>), // 🔑 FIX
        }));

        setDeals(data);
      } catch (err) {
        console.error('Failed to load deals', err);
        setDeals([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Admin Dashboard</h1>

      {loading && <div>Loading deals…</div>}

      {!loading && deals.length === 0 && <div>No deals found.</div>}

      {!loading &&
        deals.map((deal) => (
          <div
            key={deal.id}
            style={{
              marginTop: 12,
              padding: 16,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.06)',
            }}
          >
            <strong>{deal.title}</strong>
            <div style={{ opacity: 0.8, fontSize: 13 }}>
              Stage: {deal.stage ?? 'unknown'}
            </div>
          </div>
        ))}
    </div>
  );
}