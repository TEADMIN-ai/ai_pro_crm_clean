"use client";

import { useParams } from "next/navigation";
import ContractorOnboardingView from "@/components/contractors/ContractorOnboardingView";
import { ReturnButton } from "@/components/navigation/ReturnButton";

export default function ContractorPage() {
  const params = useParams();
  const contractorId = typeof params?.contractorId === "string" ? params.contractorId : "";

  return (
    <div className="bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4">
        <ReturnButton fallbackHref="/dashboard/contractors" label="Back to Contractors" />
      </div>
      <ContractorOnboardingView contractorId={contractorId} />
    </div>
  );
}
