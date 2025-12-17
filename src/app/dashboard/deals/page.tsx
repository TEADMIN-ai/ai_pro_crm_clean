'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/config';
import { getUserRole } from '@/lib/firebase/getUserRole';
import { logDealActivity } from '@/lib/firebase/logDealActivity';

const COLUMNS = ['prospect', 'qualified', 'proposal', 'won', 'lost'];

export default function DealsKanban() {
  const [deals, setDeals] = useState<any[]>([]);
  const [dragging, setDragging] = useState<any>(null);
  const [role, setRole] = useState<string>('staff');
  const user = auth.currentUser;

  useEffect(() => {
    fetch('/api/deals').then(r => r.json()).then(setDeals);

    auth.onAuthStateChanged(async u => {
      if (u) {
        const r = await getUserRole(u.uid);
        setRole(r);
      }
    });
  }, []);

  const onDrop = async (status: string) => {
    if (!dragging || role !== 'admin' || !user) return;

    const previous = dragging.status;

    setDeals(ds =>
      ds.map(d => (d.id === dragging.id ? { ...d, status } : d))
    );

    const token = await user.getIdToken();

    await fetch('/api/deals/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: \Bearer \\,
      },
      body: JSON.stringify({ id: dragging.id, status }),
    });

    await logDealActivity({
      dealId: dragging.id,
      action: 'status_change',
      fromStatus: previous,
      toStatus: status,
      userId: user.uid,
      userEmail: user.email || '',
    });

    setDragging(null);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Deals Pipeline ({role})</h1>

      <div style={{ display: 'flex', gap: 16 }}>
        {COLUMNS.map(col => (
          <div
            key={col}
            onDragOver={e => e.preventDefault()}
            onDrop={() => onDrop(col)}
            style={{ flex: 1, background: '#f4f4f4', padding: 12 }}
          >
            <h3>{col.toUpperCase()}</h3>

            {deals
              .filter(d => d.status === col)
              .map(d => (
                <div
                  key={d.id}
                  draggable={role === 'admin'}
                  onDragStart={() => role === 'admin' && setDragging(d)}
                  style={{
                    background: '#fff',
                    padding: 10,
                    marginBottom: 8,
                    borderRadius: 4,
                    cursor: role === 'admin' ? 'grab' : 'not-allowed',
                    opacity: role === 'admin' ? 1 : 0.6,
                  }}
                >
                  <strong>{d.title}</strong>
                  <div>€{d.amount}</div>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
