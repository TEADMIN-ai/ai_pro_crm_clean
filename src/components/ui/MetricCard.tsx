"use client";

import type { ReactNode } from "react";

type MetricCardProps = {
  label: string;
  value: string | number;
  change?: string;
  gradientClassName: string;
  chartBars?: number[];
  icon?: ReactNode;
};

function clampBarHeight(value: number): number {
  if (!Number.isFinite(value)) {
    return 20;
  }

  return Math.max(18, Math.min(100, Math.round(value)));
}

export default function MetricCard({
  label,
  value,
  change,
  gradientClassName,
  chartBars = [32, 44, 58, 50, 70, 64, 84],
  icon,
}: MetricCardProps) {
  return (
    <article
      className={`enterprise-card overflow-hidden border-l-4 border-l-[color:var(--tex-primary)] text-[color:var(--tex-text)] ${gradientClassName}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-[color:var(--tex-text-subtle)]">{label}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          <p className="text-xs font-medium text-[color:var(--tex-text-subtle)]">{change ?? "Trend snapshot updated just now"}</p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--tex-primary-soft)]">
          {icon ?? <div className="h-3 w-3 rounded-full bg-[color:var(--tex-primary)]" />}
        </div>
      </div>

      <div className="mt-6 flex h-16 items-end gap-2">
        {chartBars.map((bar, index) => (
          <span
            key={`${label}-${index}`}
            className="w-full rounded-full bg-[color:var(--tex-primary)]/20"
            style={{ height: `${clampBarHeight(bar)}%` }}
          />
        ))}
      </div>
    </article>
  );
}
