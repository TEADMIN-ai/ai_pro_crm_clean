"use client";

import { EnterpriseKpiCard } from "@/components/ui/EnterpriseUI";

type EmpireKpiCardProps = {
  title: string;
  value: number | string;
};

export default function EmpireKpiCard({ title, value }: EmpireKpiCardProps) {
  return <EnterpriseKpiCard label={title} value={value} />;
}
