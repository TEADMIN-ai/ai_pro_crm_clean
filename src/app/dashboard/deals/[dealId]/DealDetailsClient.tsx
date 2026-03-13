"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { canDelete, canReview, canUpload } from "@/lib/auth/roleUtils";
import TenderReadinessPanel from "@/components/deals/TenderReadinessPanel";
import TenderProjectionPanel from "@/components/intelligence/TenderProjectionPanel";
import TenderRiskPanel from "@/components/intelligence/TenderRiskPanel";
import { tenderRiskRadar } from "@/lib/intelligence/tenderRiskRadar";
import {
  projectTenderImprovement,
  type TenderCategoryScores,
} from "@/lib/intelligence/tenderImprovementEngine";
import { calculateWinProbabilityIndex } from "@/lib/intelligence/winProbabilityIndex";
import WinProbabilityPanel from "@/components/intelligence/WinProbabilityPanel";
import {
  tenderTrajectory,
  type WpiHistoryPoint,
} from "@/lib/intelligence/tenderTrajectory";
import TenderTrajectoryPanel from "@/components/intelligence/TenderTrajectoryPanel";
import ImpactAttributionPanel from "@/components/intelligence/ImpactAttributionPanel";
import { calculateImpactAttribution } from "@/lib/intelligence/impactAttribution";
import { type DocumentIntelligenceResult } from "@/lib/intelligence/documentIntelligenceEngine";
import { generateAutoFillPreview } from "@/lib/pdf/autoFillPreviewEngine";
import DocumentIntelligence from "@/components/deals/DocumentIntelligence";
import { evaluateTenderReadiness } from "@/lib/tender/evaluateTenderReadiness";
import { API_ROUTES } from "@/lib/routes";
import type { DocumentAnalysis } from "@/types/tenderAudit";
import { authFetch } from "@/lib/client/authFetch";

type DealDocument = {
  id: string;
  dealId: string;
  name: string;
  status: "pending" | "approved" | "rejected";
  size?: number;
  storagePath?: string;
  downloadURL?: string;
  uploadedByUid?: string;
  uploadedAt?: string;
  updatedAt?: string;
  reviewedAt?: string;
};

export default function DealDetailsClient({ dealId }: { dealId: string }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ dealId?: string | string[] }>();
  const routeDealId = Array.isArray(params.dealId) ? params.dealId[0] : params.dealId;
  const resolvedDealId = decodeURIComponent(routeDealId ?? dealId);

  const [documents, setDocuments] = useState<DealDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);
  const [previousWpi, setPreviousWpi] = useState<WpiHistoryPoint | null>(null);
  const [documentIntelligence, setDocumentIntelligence] = useState<DocumentIntelligenceResult | null>(null);
  const [readinessUpdatedAt, setReadinessUpdatedAt] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!resolvedDealId) return;

    let active = true;

    async function loadDealState() {
      try {
        const [dealResponse, documentsResponse] = await Promise.all([
          authFetch(API_ROUTES.DEAL_DETAIL(resolvedDealId)),
          authFetch(API_ROUTES.DEAL_DOCUMENTS(resolvedDealId)),
        ]);

        if (dealResponse.ok) {
          const dealPayload = (await dealResponse.json()) as {
            analytics?: {
              readinessUpdatedAt?: string;
              previousWpi?: WpiHistoryPoint | null;
            };
          };

          if (active) {
            setReadinessUpdatedAt(dealPayload.analytics?.readinessUpdatedAt);
            setPreviousWpi(dealPayload.analytics?.previousWpi ?? null);
          }
        }

        if (documentsResponse.ok) {
          const payload = (await documentsResponse.json()) as { documents?: DealDocument[] };
          if (active) {
            setDocuments(Array.isArray(payload.documents) ? payload.documents : []);
          }
        }
      } catch (error) {
        console.error("Failed to load deal details:", error);
      } finally {
        if (active) {
          setIsLoadingDocs(false);
        }
      }
    }

    void loadDealState();
    const interval = window.setInterval(() => {
      void loadDealState();
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [resolvedDealId]);

  const handleStatusUpdate = async (documentId: string, newStatus: "approved" | "rejected") => {
    if (!user || !canReview(role)) return;

    setBusyDocumentId(documentId);
    try {
      const response = await authFetch(API_ROUTES.DEAL_DOCUMENTS(resolvedDealId), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error(`Status update failed with status ${response.status}`);
      }

      const payload = (await response.json()) as { document?: DealDocument };
      if (payload.document) {
        setDocuments((current) =>
          current.map((item) => (item.id === payload.document?.id ? payload.document : item)),
        );
      }
    } catch (error) {
      console.error("Status update failed:", error);
    } finally {
      setBusyDocumentId(null);
    }
  };

  const handleDelete = async (docItem: DealDocument) => {
    if (!user || !canDelete(role, docItem.uploadedByUid, user.uid)) return;

    setBusyDocumentId(docItem.id);
    try {
      const response = await authFetch(
        `${API_ROUTES.DEAL_DOCUMENTS(resolvedDealId)}?documentId=${encodeURIComponent(docItem.id)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(`Delete failed with status ${response.status}`);
      }

      setDocuments((current) => current.filter((item) => item.id !== docItem.id));
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setBusyDocumentId(null);
    }
  };

  const categoryScores = useMemo(() => {
    const total = documents.length;
    const approved = documents.filter((item) => item.status === "approved").length;
    const rejected = documents.filter((item) => item.status === "rejected").length;
    const reviewed = approved + rejected;

    return {
      documentationCoverage: {
        score: Math.min(100, total * 20),
        weight: 0.35,
      },
      reviewCompletion: {
        score: total > 0 ? Math.round((reviewed / total) * 100) : 0,
        weight: 0.4,
      },
      approvalQuality: {
        score: total > 0 ? Math.round((approved / total) * 100) : 0,
        weight: 0.25,
      },
    };
  }, [documents]);

  const overallScore = useMemo(() => {
    const entries = Object.values(categoryScores);
    const totalWeight = entries.reduce((sum, category) => sum + category.weight, 0);
    if (totalWeight <= 0) return 0;
    const weightedTotal = entries.reduce(
      (sum, category) => sum + category.score * category.weight,
      0,
    );
    return Math.round((weightedTotal / totalWeight) * 10) / 10;
  }, [categoryScores]);

  const projectionResult = useMemo(
    () => projectTenderImprovement(categoryScores as TenderCategoryScores),
    [categoryScores],
  );

  const deadlineAndDocs = useMemo(() => {
    const missingDocuments = documents.filter((item) => item.status !== "approved").length;
    return {
      missingDocuments,
      daysUntilDeadline: 999,
    };
  }, [documents]);

  const riskRadar = useMemo(() => {
    return tenderRiskRadar({
      categoryScores,
      missingDocuments: deadlineAndDocs.missingDocuments,
      daysUntilDeadline: deadlineAndDocs.daysUntilDeadline,
    });
  }, [categoryScores, deadlineAndDocs]);

  const winProbability = useMemo(() => {
    return calculateWinProbabilityIndex({
      overallScore,
      riskScore: riskRadar.riskScore,
      improvementDelta: projectionResult.improvementDelta,
      daysUntilDeadline: deadlineAndDocs.daysUntilDeadline,
      missingDocuments: deadlineAndDocs.missingDocuments,
    });
  }, [overallScore, riskRadar.riskScore, projectionResult.improvementDelta, deadlineAndDocs]);

  const trajectory = useMemo(() => tenderTrajectory(winProbability, previousWpi), [winProbability, previousWpi]);

  const trajectoryPoints = useMemo(() => {
    const points: { probability: number; timestamp?: number }[] = [];
    if (previousWpi) {
      points.push({
        probability: previousWpi.probability,
        timestamp: previousWpi.timestamp,
      });
    }
    points.push({
      probability: winProbability.probability,
      timestamp: Date.now(),
    });
    return points;
  }, [previousWpi, winProbability.probability]);

  const impactAttribution = useMemo(() => {
    if (!previousWpi) return null;

    return calculateImpactAttribution({
      previousSnapshot: {
        probability: previousWpi.probability,
        riskScore: previousWpi.riskScore,
        missingDocuments: deadlineAndDocs.missingDocuments,
        overallScore,
        daysUntilDeadline: deadlineAndDocs.daysUntilDeadline,
      },
      currentSnapshot: {
        probability: winProbability.probability,
        riskScore: riskRadar.riskScore,
        missingDocuments: deadlineAndDocs.missingDocuments,
        overallScore,
        daysUntilDeadline: deadlineAndDocs.daysUntilDeadline,
      },
    });
  }, [
    previousWpi,
    deadlineAndDocs.missingDocuments,
    deadlineAndDocs.daysUntilDeadline,
    overallScore,
    winProbability.probability,
    riskRadar.riskScore,
  ]);

  useEffect(() => {
    if (!resolvedDealId) return;

    void authFetch(API_ROUTES.DEAL_ANALYTICS(resolvedDealId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        winProbability: winProbability.probability,
        riskScore: riskRadar.riskScore,
      }),
    }).catch((error) => {
      console.warn("WPI history persistence skipped:", error);
    });
  }, [resolvedDealId, winProbability.probability, riskRadar.riskScore]);

  const analyzedDocumentCandidates = useMemo(() => {
    return documents
      .filter((item) => Boolean(item.downloadURL))
      .map((item) => ({
        id: item.id,
        name: item.name,
        downloadURL: item.downloadURL,
      }));
  }, [documents]);

  const tenderEvaluation = useMemo(() => {
    const analysis: DocumentAnalysis | undefined = documentIntelligence
      ? {
          registrationNumber: documentIntelligence.extractedFields.registrationNumbers[0],
          expiryDate: documentIntelligence.extractedFields.expiryDates[0],
          confidence: documentIntelligence.confidenceScore,
          expired: documentIntelligence.flags.expired,
          duplicate: documentIntelligence.flags.duplicatePatternDetected,
        }
      : undefined;

    return evaluateTenderReadiness(analysis);
  }, [documentIntelligence]);

  useEffect(() => {
    let cancelled = false;
    if (!analyzedDocumentCandidates.length) {
      setDocumentIntelligence({
        extractedFields: {
          expiryDates: [],
          registrationNumbers: [],
        },
        flags: {
          expired: false,
          duplicatePatternDetected: false,
        },
        confidenceScore: 0,
      });
      return;
    }

    async function analyzeDocuments() {
      try {
        const response = await authFetch(API_ROUTES.DOCUMENT_EXECUTE(analyzedDocumentCandidates[0].id), {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error(`Document execution failed with status ${response.status}`);
        }

        const payload = (await response.json()) as {
          analyses?: DocumentAnalysis[];
          readiness?: { readinessUpdatedAt?: string };
        };

        const analyses = Array.isArray(payload.analyses) ? payload.analyses : [];
        const allExpiryDates = analyses
          .map((analysis) => analysis.expiryDate)
          .filter((value): value is string => typeof value === "string" && value.length > 0);
        const allRegistrationNumbers = analyses
          .map((analysis) => analysis.registrationNumber)
          .filter((value): value is string => typeof value === "string" && value.length > 0);
        const uniqueExpiryDates = Array.from(new Set(allExpiryDates));
        const uniqueRegistrationNumbers = Array.from(new Set(allRegistrationNumbers));

        const duplicatePatternDetected =
          uniqueRegistrationNumbers.length < allRegistrationNumbers.length ||
          analyses.some((analysis) => analysis.duplicate === true);

        const merged: DocumentIntelligenceResult = {
          extractedFields: {
            expiryDates: uniqueExpiryDates,
            registrationNumbers: uniqueRegistrationNumbers,
          },
          flags: {
            expired: analyses.some((analysis) => analysis.expired === true),
            duplicatePatternDetected,
          },
          confidenceScore:
            analyses.length > 0
              ? Math.round(
                  analyses.reduce((sum, analysis) => sum + (analysis.confidence ?? 0), 0) /
                    analyses.length,
                )
              : 0,
        };

        if (!cancelled) {
          setDocumentIntelligence(merged);
          setReadinessUpdatedAt(payload.readiness?.readinessUpdatedAt);
        }
      } catch (error) {
        console.warn("Document intelligence analysis skipped:", error);
      }
    }

    void analyzeDocuments();
    return () => {
      cancelled = true;
    };
  }, [analyzedDocumentCandidates]);

  const autoFillPreview = useMemo(() => {
    return generateAutoFillPreview(
      documentIntelligence?.extractedFields ?? { expiryDates: [], registrationNumbers: [] },
      "SBD1_SBD4",
    );
  }, [documentIntelligence]);

  const documentIntelligencePayload = useMemo(() => {
    return {
      ...documentIntelligence,
      autoFillPreview,
      updatedAt: Date.now(),
    };
  }, [autoFillPreview, documentIntelligence]);

  const deal = useMemo(
    () => ({
      documentAnalysis: documentIntelligence,
    }),
    [documentIntelligence],
  );

  useEffect(() => {
    if (!resolvedDealId || !documentIntelligence) return;

    void authFetch(API_ROUTES.DEAL_ANALYTICS(resolvedDealId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentIntelligence: documentIntelligencePayload,
      }),
    }).catch((error) => {
      console.warn("Document intelligence persistence skipped:", error);
    });
  }, [resolvedDealId, documentIntelligence, documentIntelligencePayload]);

  const isPageLoading = loading || isLoadingDocs;

  if (isPageLoading) {
    return <div style={{ padding: 40 }}>Loading documents...</div>;
  }

  if (!user) return null;

  return (
    <div style={{ padding: 40 }}>
      <h1>Deal Documents</h1>
      <p style={{ opacity: 0.6 }}>Deal ID: {resolvedDealId}</p>
      <TenderProjectionPanel categoryScores={categoryScores} />
      <TenderRiskPanel risk={riskRadar} />
      <WinProbabilityPanel result={winProbability} />
      <TenderTrajectoryPanel trajectory={trajectory} points={trajectoryPoints} />
      <TenderReadinessPanel
        evaluation={tenderEvaluation}
        readinessUpdatedAt={readinessUpdatedAt}
      />
      {impactAttribution && (
        <ImpactAttributionPanel
          deltaProbability={impactAttribution.deltaProbability}
          explanationLines={impactAttribution.explanationLines}
        />
      )}

      <section style={{ marginTop: 20 }}>
        <h2 style={{ marginBottom: 8 }}>Document Intelligence</h2>
        <p style={{ marginTop: 0, opacity: 0.7 }}>
          Heuristic extraction and preview mapping for SBD auto-fill.
        </p>
        <DocumentIntelligence analysis={deal.documentAnalysis} />
      </section>

      {canUpload(role) && (
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => router.push(`/dashboard/deals/${resolvedDealId}/upload`)}
            style={{
              padding: "10px 16px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Upload PDF
          </button>
        </div>
      )}

      {documents.length === 0 ? (
        <p>No documents uploaded yet.</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 20,
          }}
        >
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Name</th>
              <th>Status</th>
              <th>Uploaded</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((docItem) => {
              const canDeleteThisDoc = canDelete(role, docItem.uploadedByUid, user.uid);
              const isBusy = busyDocumentId === docItem.id;

              return (
                <tr key={docItem.id}>
                  <td>{docItem.name}</td>
                  <td>{docItem.status ?? "pending"}</td>
                  <td>{docItem.uploadedAt ? new Date(docItem.uploadedAt).toLocaleString() : "-"}</td>
                  <td>
                    <button
                      onClick={() => window.open(docItem.downloadURL, "_blank", "noopener,noreferrer")}
                      style={{
                        marginRight: 8,
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      View
                    </button>

                    {canReview(role) && (
                      <>
                        <button
                          onClick={() => handleStatusUpdate(docItem.id, "approved")}
                          disabled={isBusy}
                          style={{
                            marginRight: 8,
                            background: "#16a34a",
                            color: "white",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: 6,
                            cursor: "pointer",
                            opacity: isBusy ? 0.65 : 1,
                          }}
                        >
                          Approve
                        </button>

                        <button
                          onClick={() => handleStatusUpdate(docItem.id, "rejected")}
                          disabled={isBusy}
                          style={{
                            marginRight: 8,
                            background: "#f97316",
                            color: "white",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: 6,
                            cursor: "pointer",
                            opacity: isBusy ? 0.65 : 1,
                          }}
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {canDeleteThisDoc && (
                      <button
                        onClick={() => handleDelete(docItem)}
                        disabled={isBusy}
                        style={{
                          background: "#dc2626",
                          color: "white",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: 6,
                          cursor: "pointer",
                          opacity: isBusy ? 0.65 : 1,
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
