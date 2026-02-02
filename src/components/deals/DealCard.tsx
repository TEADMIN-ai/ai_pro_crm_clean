"use client";

import { Deal } from "@/types/deal";
import DealStatusUpdater from "./DealStatusUpdater";
import TenderActions from "@/components/tender/TenderActions";
import TenderAuditTimeline from "@/components/tender/TenderAuditTimeline";
import { TenderAuditEvent } from "@/types/tenderAudit";

type Props = {
  deal: Deal;

  /** callbacks handled ONLY in client */
  onChangeAction: (deal: Deal) => void;
  onSubmitAction: (deal: Deal) => void;

  /** read-only data */
  auditEvents?: TenderAuditEvent[];
};

export default function DealCard({
  deal,
  onChangeAction,
  onSubmitAction,
  auditEvents = [],
}: Props) {
  return (
    <div className="rounded-xl bg-white/70 p-5 shadow-sm mb-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold">{deal.title}</h3>

        {deal.isTenderLocked && (
          <span className="text-xs px-2 py-1 bg-gray-200 rounded flex items-center gap-1">
            🔒 Locked
          </span>
        )}
      </div>

      {/* Meta */}
      <p className="text-sm text-gray-600 mb-4">
        Stage: {deal.stage} • Value: ZAR {deal.value}
      </p>

      {/* Stage selector */}
      <DealStatusUpdater
        deal={deal}
        onChangeAction={onChangeAction}
      />

      {/* Tender actions */}
      <div className="mt-4">
        <TenderActions
          deal={deal}
          onSubmitAction={onSubmitAction}
        />
      </div>

      {/* Audit timeline (read-only) */}
      {auditEvents.length > 0 && (
        <TenderAuditTimeline events={auditEvents} />
      )}
    </div>
  );
}