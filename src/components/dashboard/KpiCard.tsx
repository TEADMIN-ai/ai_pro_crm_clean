"use client";

import { EnterpriseKpiCard } from "@/components/ui/EnterpriseUI";

type Props = {
  title: string;
  value: number | string;
  description?: string;
  trend?: string;
};

export default function KpiCard({ title, value, description, trend }: Props) {
  return (
    <EnterpriseKpiCard
      label={title}
      value={value}
      helper={description ?? "Updated from the latest portfolio summary."}
      trend={trend ?? "Stable monitoring"}
      className="tex-card--interactive"
    />
  );
}
