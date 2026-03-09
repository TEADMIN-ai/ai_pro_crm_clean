"use client";

import type { DocumentAnalysis } from "@/types/tenderAudit";
import { evaluateTenderReadiness } from "@/lib/tender/evaluateTenderReadiness";
import TenderReadinessPanel from "./TenderReadinessPanel";
import DocumentIntelligence from "./DocumentIntelligence";

type Deal = {
  id: string;
  title?: string;
  status?: string;
  createdAt?: string;
  documentAnalysis?: DocumentAnalysis;
};

interface Props {
  deal: Deal;
}

export default function DealDetailsClient({ deal }: Props) {
  const readiness = evaluateTenderReadiness(deal.documentAnalysis);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
        <h1 className="text-xl font-bold text-white">{deal.title ?? "Deal"}</h1>

        <p className="text-sm text-gray-400">Status: {deal.status ?? "Unknown"}</p>

        {deal.createdAt && <p className="mt-1 text-xs text-gray-500">Created: {deal.createdAt}</p>}
      </div>

      <TenderReadinessPanel evaluation={readiness} />
      <DocumentIntelligence analysis={deal.documentAnalysis ?? null} />
    </div>
  );
}
