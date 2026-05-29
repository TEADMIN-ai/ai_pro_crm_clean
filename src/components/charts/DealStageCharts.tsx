"use client";

import { PieChart, Pie, Cell, Tooltip } from "recharts";
import type { Deal } from "@/types/deal";
import MeasuredResponsiveContainer from "@/components/charts/MeasuredResponsiveContainer";
import { empireColors } from "@/theme/empireTheme";

const COLORS: Record<string, string> = {
  draft: "#94A3B8",
  lead: "#00F0FF",
  in_review: "#38BDF8",
  tender: "#22D3EE",
  proposal: "#7C3AED",
  negotiation: "#A855F7",
  pricing: "#F59E0B",
  manager_review: "#8B5CF6",
  won: "#00FF9D",
  awarded: "#10B981",
  lost: "#FF4D4D",
  rejected: "#DC2626",
  closed: "#64748B",
  submitted: "#2563EB",
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
    <div className="relative mx-auto flex h-[260px] min-h-[260px] min-w-0 w-full max-w-[420px] items-center justify-center overflow-hidden">
      <MeasuredResponsiveContainer minHeight={260}>
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
      </MeasuredResponsiveContainer>
    </div>
  );
}

