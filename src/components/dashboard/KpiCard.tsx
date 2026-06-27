"use client";

import { MetricCard } from "@/components/tex/ExecutivePrimitives";

type Props = {
  title: string;
  value: number | string;
  description?: string;
  trend?: string;
};

export default function KpiCard({
  title,
  value,
  description,
  trend,
}: Props) {
  return (
    <MetricCard
      label={title}
      value={value}
      description={description ?? "Updated from the latest portfolio summary."}
      trend={trend ?? "Stable monitoring"}
      className="tex-card--interactive"
    />
  );
}
