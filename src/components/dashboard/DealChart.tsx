"use client";

import {
  Bar,
  BarChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import MeasuredResponsiveContainer from "@/components/charts/MeasuredResponsiveContainer";
import { DashboardCard, InsightPanel, StatusBadge } from "@/components/tex/ExecutivePrimitives";

type DealChartDatum = {
  name: string;
  value: number;
};

export default function DealChart({ data }: { data: DealChartDatum[] }) {
  return (
    <DashboardCard className="p-6 md:p-7">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="dashboard-eyebrow">Analytics</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--tex-text-strong)] md:text-2xl">
            Contractor Readiness Distribution
          </h2>
          <p className="tex-copy mt-2 max-w-2xl text-sm">
            Operational overview of submission readiness across active tenders
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.map((item) => (
            <StatusBadge key={item.name}>
              {item.name}: {item.value}
            </StatusBadge>
          ))}
        </div>
      </div>

      <InsightPanel className="mb-4" title="Executive Analytics Framing">
        <p className="text-sm leading-6">
          This distribution highlights where submission momentum is strongest and where intervention is required before tender conversion.
        </p>
      </InsightPanel>

      <div className="rounded-[18px] border border-[color:var(--tex-border)] bg-[color:var(--tex-surface)] p-3 sm:p-4">
        <div className="h-[260px] min-h-[260px] min-w-0 w-full sm:h-[310px] sm:min-h-[310px]">
          <MeasuredResponsiveContainer minHeight={260}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
              <XAxis
                dataKey="name"
                stroke="var(--tex-text-muted)"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--tex-text-muted)", fontSize: 12 }}
              />
              <YAxis
                stroke="var(--tex-text-muted)"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--tex-text-muted)", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "rgba(148,163,184,0.08)" }}
                contentStyle={{
                  backgroundColor: "var(--tex-card-strong)",
                  borderColor: "var(--tex-border)",
                  borderRadius: "16px",
                  color: "var(--tex-text)",
                  boxShadow: "var(--tex-shadow-md)",
                }}
              />
              <Bar dataKey="value" fill="var(--tex-chart-blue)" radius={[12, 12, 4, 4]} maxBarSize={72} />
            </BarChart>
          </MeasuredResponsiveContainer>
        </div>
      </div>
    </DashboardCard>
  );
}
