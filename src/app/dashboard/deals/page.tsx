'use client';

import { useEffect, useState } from 'react';

const COLUMNS = ['prospect', 'qualified', 'proposal', 'won', 'lost'];

export default function DealsKanban() {
  const [deals, setDeals] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/deals')
      .then(res => res.json())
      .then(setDeals);
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Deals Pipeline</h1>

      <div style={{ display: 'flex', gap: 16 }}>
        {COLUMNS.map(col => (
          <div key={col} style={{ flex: 1, background: '#f4f4f4', padding: 12 }}>
            <h3>{col.toUpperCase()}</h3>

            {deals
              .filter(d => d.status === col)
              .map(d => (
                <div
                  key={d.id}
                  style={{
                    background: '#fff',
                    padding: 10,
                    marginBottom: 8,
                    borderRadius: 4,
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
