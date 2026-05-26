"use client";

import type { Deal } from "@/types/deal";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { empireColors } from "@/theme/empireTheme";

type Props = {
  deals: Deal[];
};

export default function PipelineChart({ deals }: Props) {
  const counts: Record<string, number> = {};

  for (const deal of deals ?? []) {
    const stage = (deal as any)?.stage;
    if (!stage) continue;
    counts[String(stage)] = (counts[String(stage)] ?? 0) + 1;
  }

  const data = Object.keys(counts).map((stage) => ({
    stage,
    count: counts[stage],
  }));

  if (!data.length) {
    return <div style={{ opacity: 0.6 }}>No pipeline data</div>;
  }

  return (
    <div className="relative mx-auto flex h-[260px] w-full max-w-[420px] items-center justify-center overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="rgba(30, 41, 59, 0.8)" strokeDasharray="3 3" />
          <XAxis dataKey="stage" stroke={empireColors.textSecondary} />
          <YAxis allowDecimals={false} stroke={empireColors.textSecondary} />
          <Tooltip
            contentStyle={{
              background: empireColors.surface,
              border: `1px solid ${empireColors.border}`,
              color: empireColors.textPrimary,
            }}
          />
          <Bar dataKey="count" fill={empireColors.primary} radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

