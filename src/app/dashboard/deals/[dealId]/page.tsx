// src/app/dashboard/deals/[dealId]/page.tsx

import { use } from "react";
import DealDocumentUpload from "@/components/deals/DealDocumentUpload";
import DealDocumentList from "@/components/deals/DealDocumentList";

export default function DealDetailsPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = use(params);

  const userId = "CURRENT_USER_ID";

  return (
    <div style={{ padding: 40 }}>
      <h1>Deal Files</h1>
      <p style={{ opacity: 0.6 }}>Deal ID: {dealId}</p>

      <div style={{ marginTop: 20 }}>
        <DealDocumentUpload dealId={dealId} userId={userId} />
      </div>

      <div style={{ marginTop: 30 }}>
        <DealDocumentList dealId={dealId} />
      </div>
    </div>
  );
}