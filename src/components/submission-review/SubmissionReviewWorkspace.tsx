"use client";

import { EnterpriseEmptyState, EnterprisePanel } from "@/components/ui/EnterpriseUI";
import { submissionReviewState } from "@/lib/submission-review";

export default function SubmissionReviewWorkspace() {
  if (submissionReviewState.requiredDocuments.length === 0) {
    return (
      <main className="space-y-6 p-4 md:p-6">
        <EnterprisePanel title="Submission review" eyebrow="Operational data">
          <EnterpriseEmptyState
            title="No submission review record is connected."
            detail="Connect the production submission review source to render readiness, validation, signatures, BOQ, pricing, and approval flow."
          />
        </EnterprisePanel>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-4 md:p-6">
      <EnterprisePanel title="Submission review" eyebrow="Operational data">
        <EnterpriseEmptyState
          title="No submission review record is connected."
          detail="Connect the production submission review source to render readiness, validation, signatures, BOQ, pricing, and approval flow."
        />
      </EnterprisePanel>
    </main>
  );
}
