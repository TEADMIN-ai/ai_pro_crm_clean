"use client";

import RequireRole from "@/components/auth/RequireRole";
import SubmissionReviewWorkspace from "@/components/submission-review/SubmissionReviewWorkspace";

export default function SubmissionReviewPage() {
  return (
    <RequireRole allow={["admin", "manager", "staff"]}>
      <SubmissionReviewWorkspace />
    </RequireRole>
  );
}
