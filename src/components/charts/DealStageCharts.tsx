'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Deal } from '@/types/deal';

const COLORS = {
  lead: '#60a5fa',
  tender: '#38bdf8',
  proposal: '#818cf8',
  negotiation: '#a78bfa',
  won: '#22c55e',
  lost: '#ef4444',
  closed: '#9ca3af',
};

export default function DealStageChart({ deals }: { deals: Deal[] }) {
  const data = Object.entries(
    deals.reduce<Record<string, number>>((acc, deal) => {
      const stage = deal.stage ?? 'unknown';
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={90}>
          {data.map(entry => (
            <Cell
              key={entry.name}
              fill={COLORS[entry.name as keyof typeof COLORS] ?? '#64748b'}
            />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}