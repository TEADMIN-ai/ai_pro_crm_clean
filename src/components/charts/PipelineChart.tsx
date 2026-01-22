"use client";

import type { Deal } from "@/types/deal";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

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
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <XAxis dataKey="stage" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#2563eb" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
