"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useEffect, useState } from "react";
import { API_ROUTES } from "@/lib/apiRoutes";
import { authFetch } from "@/lib/client/authFetch";
import { useAuth } from "@/context/AuthContext";
import { getPermissions } from "@/lib/permissions";
import {
  requestTenderPackGeneration,
  type TenderPackGenerateResponse,
} from "@/lib/tender/requestTenderPackGeneration";

type Deal = {
  id: string;
  name?: string;
  title?: string;
  status?: string;
  contractorId?: string;
  value?: number;
  readinessScore?: number;
  isTenderLocked?: boolean;
  missingDocs?: string[];
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  suggestions?: string[];
  aiInsights?: string | null;
  analysis?: {
    requirements?: Record<string, boolean>;
    missing?: string[];
    score?: number;
    risk?: string;
  };
};

type Contractor = {
  id: string;
  name?: string;
  company?: string;
  companyName?: string;
};

type TenderAnalysisResult = {
  requirements: {
    taxClearance: boolean;
    bbbee: boolean;
    cipc: boolean;
    coida: boolean;
  };
  missing: string[];
  score: number;
  risk: string;
};

function getDealTitle(deal: Deal): string {
  return deal.title || deal.name || deal.id;
}

export default function DealsPage() {
  const { role } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const permissions = getPermissions(role);

  async function loadDeals() {
    const dealsRes = await authFetch(API_ROUTES.DEALS);

    if (!dealsRes.ok) {
      throw new Error("Failed to fetch deals");
    }

    const dealsData = await dealsRes.json();
    const normalizedDeals: Deal[] = Array.isArray(dealsData)
      ? dealsData
      : Array.isArray(dealsData?.data)
        ? dealsData.data
        : Array.isArray(dealsData?.deals)
          ? dealsData.deals
          : [];

    setDeals(normalizedDeals);
  }

  async function loadContractors() {
    const contractorsRes = await authFetch(API_ROUTES.CONTRACTORS);

    const contractorsData = await contractorsRes.json();
    setContractors(Array.isArray(contractorsData) ? contractorsData : []);
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([loadDeals(), loadContractors()]);
      } catch (err) {
        console.error(" Error loading deals:", err);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  async function createDeal(data: {
    contractorId: string;
    title: string;
    value?: number;
    tenderText?: string;
  }) {
    try {
      const res = await authFetch(API_ROUTES.DEALS, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const newDeal = await res.json();

      setDeals((prev) => [newDeal, ...prev]);
    } catch (err) {
      console.error(" CREATE DEAL ERROR:", err);
    }
  }

  async function analyzeTender(text: string): Promise<TenderAnalysisResult | undefined> {
    try {
      const res = await authFetch(API_ROUTES.TENDER_ANALYZE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      return await res.json();
    } catch (err) {
      console.error(" ANALYSIS ERROR:", err);
      return undefined;
    }
  }

  async function runDealAnalysis(dealId: string, text: string) {
    try {
      const analysis = await analyzeTender(text);

      if (!analysis) {
        throw new Error("Analysis failed");
      }

      const response = await authFetch(API_ROUTES.DEAL_ANALYZE(dealId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(analysis),
      });

      void response;
      await loadDeals();
    } catch (err) {
      console.error(" DEAL ANALYSIS FLOW ERROR:", err);
    }
  }

  async function uploadAndAnalyze(dealId: string, file: File) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("dealId", dealId);

      const res = await authFetch(API_ROUTES.DOCUMENT_UPLOAD_ANALYZE, {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      console.log(result);

      await loadDeals();
    } catch (err) {
      console.error(" PIPELINE ERROR:", err);
    }
  }

  async function generateTenderPackRequest(dealId: string): Promise<TenderPackGenerateResponse> {
    return requestTenderPackGeneration(dealId);
  }

  function decodeBase64Pdf(base64: string): Blob {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], { type: "application/pdf" });
  }

  async function previewPack(dealId: string) {
    try {
      const result = await generateTenderPackRequest(dealId);

      if (!result.base64) {
        throw new Error("Tender pack response did not include PDF content");
      }

      const blob = decodeBase64Pdf(result.base64);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      console.error(" PDF PREVIEW ERROR:", err);
      alert("Failed to load PDF");
    }
  }

  async function downloadPack(dealId: string) {
    try {
      const result = await generateTenderPackRequest(dealId);

      if (!result.base64) {
        throw new Error("Tender pack response did not include PDF content");
      }

      const blob = decodeBase64Pdf(result.base64);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = "tender-pack.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(" DOWNLOAD ERROR:", err);
      alert("Download failed");
    }
  }

  async function emailPack(dealId: string) {
    try {
      const res = await authFetch(API_ROUTES.TENDER_EMAIL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dealId }),
      });

      alert("Email triggered");
    } catch (err) {
      console.error(" EMAIL ERROR:", err);
      alert("Email failed");
    }
  }

  const handleGenerate = async (deal: Deal) => {
    try {
      if (!deal?.id) {
        throw new Error("Missing deal ID");
      }

      await generateTenderPackRequest(deal.id);
      alert("Tender pack generated");
    } catch (err: any) {
      console.error(" Generate Error:", err);
      alert(err.message);
    }
  };

  const handlePreviewPDF = async (deal: Deal) => {
    try {
      if (!deal?.id) throw new Error("Missing deal ID");
      await previewPack(deal.id);
    } catch (err: any) {
      console.error(" Preview Error:", err);
      alert(err.message || "Preview failed");
    }
  };

  const firstContractorId = contractors[0]?.id ?? "";
  if (loading) {
    return <div className="p-6">Loading deals...</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">My Deals</h1>

      {permissions.canEditDeal && (
        <button
          onClick={() => {
            if (!firstContractorId) {
              console.error(" CREATE DEAL ERROR: No contractor available");
              return;
            }

            void createDeal({
              contractorId: firstContractorId,
              title: "RFQ - Electrical Maintenance",
              value: 50000,
            });
          }}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Add Test Deal
        </button>
      )}

      {deals.length === 0 && (
        <div className="text-gray-500">No deals found</div>
      )}

      {deals.map((deal) => (
        <div key={deal.id} className="border rounded-lg p-4 shadow-sm bg-white">
          {(() => {
            const readinessScore = typeof deal.readinessScore === "number" ? deal.readinessScore : 0;
            const isLocked = deal.isTenderLocked ?? readinessScore < 60;

            return (
              <>
          <h2 className="text-lg font-semibold">{getDealTitle(deal)}</h2>

          <p className="text-sm text-gray-500">
            Status: {deal.status || "unknown"}
          </p>

          <p className="text-sm text-gray-500">
            Readiness Score: {typeof deal.readinessScore === "number" ? `${deal.readinessScore}%` : "Pending"}
          </p>

          <p className="text-sm text-gray-500">
            Risk: {deal.riskLevel || "UNKNOWN"}
          </p>

          {Array.isArray(deal.missingDocs) && deal.missingDocs.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm text-amber-700">
              {deal.missingDocs.map((doc) => (
                <li key={doc}>Missing: {doc}</li>
              ))}
            </ul>
          )}

          {Array.isArray(deal.suggestions) && deal.suggestions.length > 0 && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <strong>Action Required:</strong>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {deal.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          {deal.aiInsights ? (
            <div className="mt-3 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-cyan-900">
              <strong>AI Insight:</strong>
              <p className="mt-2 whitespace-pre-line text-sm">{deal.aiInsights}</p>
            </div>
          ) : null}

          <div className="flex gap-3 mt-4">
            {permissions.canGeneratePack && (
              <button
                onClick={() => handleGenerate(deal)}
                disabled={isLocked}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                title={isLocked ? "Generate Tender Pack unlocks at 60% readiness" : undefined}
              >
                Generate Tender Pack
              </button>
            )}

            <button
              onClick={() => handlePreviewPDF(deal)}
              className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900"
            >
              Preview Pack
            </button>

            <button
              onClick={() => void downloadPack(deal.id)}
              className="bg-slate-700 text-white px-4 py-2 rounded hover:bg-slate-800"
            >
              Download Pack
            </button>

            <button
              onClick={() => void emailPack(deal.id)}
              className="bg-violet-700 text-white px-4 py-2 rounded hover:bg-violet-800"
            >
              Email Pack
            </button>

            {permissions.canAnalyzeDeal && (
              <button
                onClick={() =>
                  void runDealAnalysis(
                    deal.id,
                    "This tender requires tax clearance, BBBEE and COIDA."
                  )
                }
                className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700"
              >
                Analyze Deal
              </button>
            )}

            {permissions.canUploadDocs && (
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void uploadAndAnalyze(deal.id, file);
                    e.currentTarget.value = "";
                  }
                }}
                className="block text-sm"
              />
            )}
          </div>
              </>
            );
          })()}
        </div>
      ))}
    </div>
  );
}
