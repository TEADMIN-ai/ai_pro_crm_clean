"use client";

import { EnterpriseKpiCard } from "@/components/ui/EnterpriseUI";

type Props = {
  label: string;
  value: number | string;
};

export default function KpiCard({ label, value }: Props) {
  return <EnterpriseKpiCard label={label} value={value} />;
}
