"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { Deal } from "@/types/deal";

const COLORS: Record<string, string> = {
  lead: "#60a5fa",
  tender: "#38bdf8",
  proposal: "#818cf8",
  negotiation: "#a78bfa",
  won: "#22c55e",
  lost: "#ef4444",
  closed: "#9ca3af",
};

export default function DealStageCharts({ deals }: { deals: Deal[] }) {
  const counts: Record<string, number> = {};

  for (const deal of deals ?? []) {
    const stage = String(deal.stage ?? "unknown");
    counts[stage] = (counts[stage] ?? 0) + 1;
  }

  const data = Object.entries(counts).map(([name, value]) => ({
    name,
    value,
  }));

  if (!data.length) return null;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          outerRadius={90}
        >
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={COLORS[entry.name] ?? "#64748b"}
            />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

