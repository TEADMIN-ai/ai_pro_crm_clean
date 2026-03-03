"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { Deal } from "@/types/deal";
import { empireColors } from "@/theme/empireTheme";

const COLORS: Record<string, string> = {
  lead: "#00F0FF",
  tender: "#22D3EE",
  proposal: "#7C3AED",
  negotiation: "#A855F7",
  won: "#00FF9D",
  lost: "#FF4D4D",
  closed: "#64748B",
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
        <Tooltip
          contentStyle={{
            background: empireColors.surface,
            border: `1px solid ${empireColors.border}`,
            color: empireColors.textPrimary,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

