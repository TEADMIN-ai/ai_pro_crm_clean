'use client';

import { useEffect, useState } from 'react';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(setData);
  }, []);

  if (!data) return <p>Loading analytics…</p>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Pipeline Analytics</h1>

      <ul>
        <li>?? Pipeline Value: €{data.pipelineValue}</li>
        <li>?? Won Value: €{data.wonValue}</li>
        <li>?? Lost Value: €{data.lostValue}</li>
        <li>?? Win Rate: {data.winRate}%</li>
        <li>? Avg Deal Duration: {data.avgDealDuration} days</li>
      </ul>
    </div>
  );
}
