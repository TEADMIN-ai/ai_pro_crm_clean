"use client";

import {
  Bar,
  BarChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import MeasuredResponsiveContainer from "@/components/charts/MeasuredResponsiveContainer";

type DealChartDatum = {
  name: string;
  value: number;
};

export default function DealChart({ data }: { data: DealChartDatum[] }) {
  return (
    <div className="dashboard-panel rounded-[28px] p-6 md:p-7">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="dashboard-eyebrow">Analytics</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white md:text-2xl">
            Contractor Readiness Distribution
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Operational overview of submission readiness across active tenders
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.map((item) => (
            <span
              key={item.name}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300"
            >
              {item.name}: {item.value}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-4 rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-3">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          Executive Analytics Framing
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          This distribution highlights where submission momentum is strongest and where intervention is required before tender conversion.
        </p>
      </div>

      <div className="rounded-[24px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_45%),rgba(2,6,23,0.45)] p-3 sm:p-4">
        <div className="h-[260px] min-h-[260px] min-w-0 w-full sm:h-[310px] sm:min-h-[310px]">
          <MeasuredResponsiveContainer minHeight={260}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#94a3b8", fontSize: 12 }}
              />
              <YAxis
                stroke="#94a3b8"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#94a3b8", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "rgba(148,163,184,0.08)" }}
                contentStyle={{
                  backgroundColor: "rgba(8, 15, 30, 0.96)",
                  borderColor: "rgba(148, 163, 184, 0.16)",
                  borderRadius: "16px",
                  color: "#e2e8f0",
                  boxShadow: "0 18px 40px rgba(2, 8, 23, 0.38)",
                }}
              />
              <Bar dataKey="value" fill="#38bdf8" radius={[12, 12, 4, 4]} maxBarSize={72} />
            </BarChart>
          </MeasuredResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
