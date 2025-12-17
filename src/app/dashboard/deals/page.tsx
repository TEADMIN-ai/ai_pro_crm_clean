'use client';

import { useEffect, useState } from 'react';

const COLUMNS = ['prospect', 'qualified', 'proposal', 'won', 'lost'];

export default function DealsKanban() {
  const [deals, setDeals] = useState<any[]>([]);
  const [dragging, setDragging] = useState<any>(null);

  useEffect(() => {
    fetch('/api/deals')
      .then(res => res.json())
      .then(setDeals);
  }, []);

  const onDrop = async (status: string) => {
    if (!dragging) return;

    setDeals(ds =>
      ds.map(d =>
        d.id === dragging.id ? { ...d, status } : d
      )
    );

    await fetch('/api/deals/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: dragging.id, status }),
    });

    setDragging(null);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Deals Pipeline</h1>

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
                  draggable
                  onDragStart={() => setDragging(d)}
                  style={{
                    background: '#fff',
                    padding: 10,
                    marginBottom: 8,
                    borderRadius: 4,
                    cursor: 'grab',
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
