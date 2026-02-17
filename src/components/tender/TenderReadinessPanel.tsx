"use client";

import { useTenderReadiness } from "@/hooks/useTenderReadiness";
import type { Deal } from "@/types/deal";

type Props = {
  deal: Deal;
};

export default function TenderReadinessPanel({ deal }: Props) {
  const { isReady, completionPercent, missingDocuments } =
    useTenderReadiness(deal);

  return (
    <div className="rounded-lg bg-white/70 p-4 mt-3">
      <div className="flex justify-between items-center mb-2">
        <strong>Tender Readiness</strong>
        <span>{completionPercent}%</span>
      </div>

      <div className="h-2 w-full bg-gray-200 rounded">
        <div
          className={`h-2 rounded ${
            isReady ? "bg-green-500" : "bg-blue-500"
          }`}
          style={{ width: `${completionPercent}%` }}
        />
      </div>

      {!isReady && (
        <ul className="mt-3 text-sm text-gray-700 list-disc ml-5">
          {missingDocuments.map(doc => (
            <li key={doc}>{doc}</li>
          ))}
        </ul>
      )}

      {isReady && (
        <div className="mt-2 text-green-700 font-medium">
          ✅ Ready for submission
        </div>
      )}
    </div>
  );
}

