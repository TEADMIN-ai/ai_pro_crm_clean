"use client";

import { useState } from "react";
import { API_ROUTES } from "@/lib/routes";

type ContractorPayload = {
  contractorId: string;
  companyName?: string | null;
  companyRegistrationNumber?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  directors?: string | null;
  directorNames?: string | null;
};

type Props = {
  contractor: ContractorPayload;
};

export default function GenerateSBD4Button({ contractor }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerateSBD4(data: ContractorPayload) {
    setIsGenerating(true);

    try {
      const res = await fetch(API_ROUTES.SBD4_GENERATE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error(`Failed to generate SBD4 (${res.status})`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = "SBD4.pdf";
      a.click();

      window.URL.revokeObjectURL(url);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <button type="button" onClick={() => void handleGenerateSBD4(contractor)} disabled={isGenerating}>
      {isGenerating ? "Generating..." : "Generate SBD4"}
    </button>
  );
}
