'use client';

import { useEffect, useState } from 'react';

export default function DealsPage() {
  const [deals, setDeals] = useState([]);

  useEffect(() => {
    async function fetchDeals() {
      const res = await fetch('/api/deals');
      const data = await res.json();
      setDeals(data.data);
    }

    fetchDeals();
  }, []);

  return (
    <div>
      <h1>Deals Kanban</h1>
      <ul>
        {deals.map((deal: any) => (
          <li key={deal.id}>{deal.title} - {deal.status}</li>
        ))}
      </ul>
    </div>
  );
}
