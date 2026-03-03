"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase/index";
import { canDelete, canReview, canUpload } from "@/lib/auth/roleUtils";
import type { DocumentRecord } from "@/lib/firebase/storage/uploadDealDocuments";
import TenderProjectionPanel from "@/components/intelligence/TenderProjectionPanel";
import TenderRiskPanel from "@/components/intelligence/TenderRiskPanel";
import { tenderRiskRadar } from "@/lib/intelligence/tenderRiskRadar";
import {
  projectTenderImprovement,
  type TenderCategoryScores,
} from "@/lib/intelligence/tenderImprovementEngine";
import {
  calculateWinProbabilityIndex,
} from "@/lib/intelligence/winProbabilityIndex";
import WinProbabilityPanel from "@/components/intelligence/WinProbabilityPanel";
import {
  tenderTrajectory,
  type WpiHistoryPoint,
} from "@/lib/intelligence/tenderTrajectory";
import TenderTrajectoryPanel from "@/components/intelligence/TenderTrajectoryPanel";
import ImpactAttributionPanel from "@/components/intelligence/ImpactAttributionPanel";
import { calculateImpactAttribution } from "@/lib/intelligence/impactAttribution";

type DealDocument = Omit<DocumentRecord, "uploadedAt" | "updatedAt" | "expiryDate" | "reviewedAt"> & {
  uploadedAt?: { toDate?: () => Date };
  updatedAt?: { toDate?: () => Date };
  expiryDate?: { toDate?: () => Date };
  reviewedAt?: { toDate?: () => Date };
};

export default function DealDetailsClient({ dealId }: { dealId: string }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  const [documents, setDocuments] = useState<DealDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);
  const [previousWpi, setPreviousWpi] = useState<WpiHistoryPoint | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!dealId) return;

    const q = query(collection(db, "deals", dealId, "documents"), orderBy("uploadedAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((snapshotDoc) => {
          const data = snapshotDoc.data() as Omit<DealDocument, "id">;
          return {
            id: snapshotDoc.id,
            ...data,
          };
        });

        setDocuments(docs);
        setIsLoadingDocs(false);
      },
      (error) => {
        console.error("Failed to subscribe documents:", error);
        setIsLoadingDocs(false);
      }
    );

    return () => unsubscribe();
  }, [dealId]);

  useEffect(() => {
    if (!dealId) return;

    async function loadPreviousWpi() {
      try {
        const historyDocRef = doc(db, "deals", dealId, "analytics", "wpiHistory");
        const snapshot = await getDoc(historyDocRef);
        if (!snapshot.exists()) {
          setPreviousWpi(null);
          return;
        }

        const data = snapshot.data() as {
          probability?: number;
          riskScore?: number;
          timestamp?: number;
        };

        if (typeof data.probability === "number" && typeof data.riskScore === "number") {
          setPreviousWpi({
            probability: data.probability,
            riskScore: data.riskScore,
            timestamp: typeof data.timestamp === "number" ? data.timestamp : undefined,
          });
        } else {
          setPreviousWpi(null);
        }
      } catch (error) {
        console.warn("WPI history load skipped:", error);
        setPreviousWpi(null);
      }
    }

    void loadPreviousWpi();
  }, [dealId]);

  const handleStatusUpdate = async (documentId: string, newStatus: "approved" | "rejected") => {
    if (!user || !canReview(role)) return;

    setBusyDocumentId(documentId);
    try {
      await updateDoc(doc(db, "deals", dealId, "documents", documentId), {
        status: newStatus,
        reviewedByUid: user.uid,
        reviewedByRole: role,
        reviewedAt: serverTimestamp(),
        rejectionReason: newStatus === "rejected" ? "Rejected by reviewer" : "",
        updatedAt: serverTimestamp(),
      });
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
      if (docItem.storagePath) {
        await deleteObject(ref(storage, docItem.storagePath));
      }

      await deleteDoc(doc(db, "deals", dealId, "documents", docItem.id));
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setBusyDocumentId(null);
    }
  };

  if (loading || isLoadingDocs) {
    return <div style={{ padding: 40 }}>Loading documents...</div>;
  }

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
      0
    );
    return Math.round((weightedTotal / totalWeight) * 10) / 10;
  }, [categoryScores]);

  const projectionResult = useMemo(() => {
    return projectTenderImprovement(categoryScores as TenderCategoryScores);
  }, [categoryScores]);

  const deadlineAndDocs = useMemo(() => {
    const missingDocuments = documents.filter((item) => item.status !== "approved").length;
    const datedDocuments = documents
      .map((item) => item.expiryDate?.toDate?.())
      .filter((value): value is Date => value instanceof Date);

    const earliestDeadline = datedDocuments.length
      ? Math.min(...datedDocuments.map((value) => value.getTime()))
      : Number.POSITIVE_INFINITY;

    const daysUntilDeadline =
      earliestDeadline === Number.POSITIVE_INFINITY
        ? 999
        : Math.ceil((earliestDeadline - Date.now()) / (1000 * 60 * 60 * 24));

    return {
      missingDocuments,
      daysUntilDeadline,
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

  const trajectory = useMemo(() => {
    return tenderTrajectory(winProbability, previousWpi);
  }, [winProbability, previousWpi]);

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

    const previousSnapshot = {
      probability: previousWpi.probability,
      riskScore: previousWpi.riskScore,
      // Historical values are not persisted in current minimal history schema.
      // Reuse current baselines to avoid invented deltas.
      missingDocuments: deadlineAndDocs.missingDocuments,
      overallScore,
      daysUntilDeadline: deadlineAndDocs.daysUntilDeadline,
    };

    const currentSnapshot = {
      probability: winProbability.probability,
      riskScore: riskRadar.riskScore,
      missingDocuments: deadlineAndDocs.missingDocuments,
      overallScore,
      daysUntilDeadline: deadlineAndDocs.daysUntilDeadline,
    };

    return calculateImpactAttribution({
      previousSnapshot,
      currentSnapshot,
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
    if (!dealId) return;

    async function persistWpiHistory() {
      try {
        const historyDocRef = doc(db, "deals", dealId, "analytics", "wpiHistory");
        await setDoc(
          historyDocRef,
          {
            timestamp: Date.now(),
            probability: winProbability.probability,
            riskScore: riskRadar.riskScore,
          },
          { merge: true }
        );
      } catch (error) {
        console.warn("WPI history persistence skipped:", error);
      }
    }

    void persistWpiHistory();
  }, [dealId, winProbability.probability, riskRadar.riskScore]);

  if (!user) return null;

  return (
    <div style={{ padding: 40 }}>
      <h1>Deal Documents</h1>
      <p style={{ opacity: 0.6 }}>Deal ID: {dealId}</p>
      <TenderProjectionPanel categoryScores={categoryScores} />
      <TenderRiskPanel risk={riskRadar} />
      <WinProbabilityPanel result={winProbability} />
      <TenderTrajectoryPanel trajectory={trajectory} points={trajectoryPoints} />
      {impactAttribution && (
        <ImpactAttributionPanel
          deltaProbability={impactAttribution.deltaProbability}
          explanationLines={impactAttribution.explanationLines}
        />
      )}

      {canUpload(role) && (
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => router.push(`/dashboard/deals/${dealId}/upload`)}
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
                  <td>{docItem.uploadedAt?.toDate?.() ? docItem.uploadedAt.toDate().toLocaleString() : "-"}</td>
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
