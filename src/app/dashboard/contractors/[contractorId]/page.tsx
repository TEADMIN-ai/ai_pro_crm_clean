"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import UploadDocumentModal from "@/components/modals/UploadDocumentModal";
import { useAuth } from "@/context/AuthContext";
import { API_ROUTES } from "@/lib/apiRoutes";
import { authFetch } from "@/lib/client/authFetch";

type ContractorApiDocument = {
  documentType?: string | null;
  status?: string | null;
  aiStatus?: string | null;
  verified?: boolean | null;
  aiData?: {
    valid?: boolean | null;
  } | null;
  isExpired?: boolean | null;
  confidenceScore?: number | null;
  fileUrl?: string | null;
  extractedFields?: Record<string, string | null> | null;
  validationError?: string | null;
  validationErrors?: string[] | null;
  issues?: string[] | null;
};

type ContractorApiPayload = {
  success?: boolean;
  error?: string;
  name?: string | null;
  companyName?: string | null;
  complianceScore?: number | null;
  complianceStatus?: string | null;
  complianceCompleted?: number | null;
  complianceMissing?: number | null;
  readinessScore?: number | null;
  readinessStatus?: string | null;
  documentRecords?: ContractorApiDocument[] | null;
};

type DashboardDocument = {
  id: string;
  documentType: string;
  status: string;
  aiStatus: string;
  verified: boolean;
  aiValid: boolean | null;
  isExpired: boolean;
  confidenceScore: number | null;
  fileUrl: string | null;
  extractedFields: Record<string, string | null>;
  validationError: string | null;
  validationErrors: string[];
};

type ActivityItem = {
  id: string;
  contractorId: string;
  action: string;
  performedBy: string;
  timestamp: string | null;
};

type ReadinessStatus = "READY" | "RISK" | "BLOCKED";
type StatusTone = "success" | "warning" | "danger";

type DashboardData = {
  name: string;
  complianceScore: number;
  complianceStatus: string;
  complianceCompleted: number;
  complianceMissing: number;
  readinessScore: number;
  readinessStatus: ReadinessStatus;
  documents: DashboardDocument[];
};

type UploadContractor = {
  id: string;
  name: string;
  companyName: string;
};

type InsightItem = {
  id: string;
  issue: string;
  recommendation: string;
  tone: StatusTone;
};

const DEFAULT_DASHBOARD_DATA: DashboardData = {
  name: "Contractor",
  complianceScore: 0,
  complianceStatus: "No compliance data",
  complianceCompleted: 0,
  complianceMissing: 0,
  readinessScore: 0,
  readinessStatus: "BLOCKED",
  documents: [],
};

function clampScore(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeReadinessStatus(value: string, readinessScore: number): ReadinessStatus {
  const normalized = value.trim().toUpperCase();

  if (normalized === "READY" || normalized === "RISK" || normalized === "BLOCKED") {
    return normalized;
  }

  if (readinessScore >= 80) {
    return "READY";
  }

  if (readinessScore >= 50) {
    return "RISK";
  }

  return "BLOCKED";
}

function normalizeDashboardData(payload: ContractorApiPayload): DashboardData {
  const documents = Array.isArray(payload.documentRecords)
    ? payload.documentRecords.map((document, index) => ({
        id: `${toText(document.documentType) || "document"}-${index}`,
        documentType: toText(document.documentType) || `Document ${index + 1}`,
        status: toText(document.status) || "missing",
        aiStatus: toText(document.aiStatus) || "pending",
        verified: document.verified === true,
        aiValid:
          document.aiData && typeof document.aiData.valid === "boolean"
            ? document.aiData.valid
            : null,
        isExpired: document.isExpired === true,
        confidenceScore: toNumber(document.confidenceScore),
        fileUrl: toText(document.fileUrl) || null,
        extractedFields:
          document.extractedFields && typeof document.extractedFields === "object"
            ? document.extractedFields
            : {},
        validationError: toText(document.validationError) || null,
        validationErrors: Array.isArray(document.validationErrors)
          ? document.validationErrors.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
          : Array.isArray(document.issues)
            ? document.issues.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            : [],
      }))
    : [];

  const explicitComplianceScore = toNumber(payload.complianceScore);
  const explicitCompleted = toNumber(payload.complianceCompleted);
  const explicitMissing = toNumber(payload.complianceMissing);
  const uploadedCount = documents.filter((document) => document.status.toLowerCase() !== "missing").length;
  const inferredCompleted = explicitCompleted ?? uploadedCount;
  const inferredMissing = explicitMissing ?? Math.max(documents.length - inferredCompleted, 0);
  const inferredComplianceScore =
    explicitComplianceScore ??
    (documents.length > 0 ? Math.round((inferredCompleted / documents.length) * 100) : 0);
  const readinessScore = clampScore(toNumber(payload.readinessScore) ?? 0);

  return {
    name: toText(payload.name) || toText(payload.companyName) || "Contractor",
    complianceScore: clampScore(inferredComplianceScore),
    complianceStatus: toText(payload.complianceStatus) || "Compliance in progress",
    complianceCompleted: inferredCompleted,
    complianceMissing: inferredMissing,
    readinessScore,
    readinessStatus: normalizeReadinessStatus(toText(payload.readinessStatus), readinessScore),
    documents,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unable to load contractor intelligence.";
}

function getReadinessTone(status: ReadinessStatus): StatusTone {
  switch (status) {
    case "READY":
      return "success";
    case "RISK":
      return "warning";
    case "BLOCKED":
    default:
      return "danger";
  }
}

function getReadinessBadgeTone(status: ReadinessStatus): BadgeTone {
  switch (status) {
    case "READY":
      return "success";
    case "RISK":
      return "warning";
    case "BLOCKED":
    default:
      return "danger";
  }
}

function getStatusPanelClasses(tone: StatusTone): string {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "danger":
    default:
      return "border-rose-200 bg-rose-50 text-rose-900";
  }
}

function getProgressBarClasses(score: number): string {
  if (score >= 80) {
    return "bg-emerald-500";
  }

  if (score >= 50) {
    return "bg-amber-500";
  }

  return "bg-rose-500";
}

function getReadinessRingClasses(score: number): string {
  if (score >= 80) {
    return "stroke-emerald-500";
  }

  if (score >= 50) {
    return "stroke-amber-500";
  }

  return "stroke-rose-500";
}

function getAiStatusMeta(aiStatus: string): { label: string; classes: string } {
  switch (aiStatus.trim().toLowerCase()) {
    case "complete":
      return {
        label: "Validated",
        classes: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "failed":
      return {
        label: "Failed",
        classes: "border-rose-200 bg-rose-50 text-rose-700",
      };
    case "pending":
    default:
      return {
        label: "Processing",
        classes: "border-amber-200 bg-amber-50 text-amber-700",
      };
  }
}

function getUploadStatusMeta(status: string): { label: string; classes: string } {
  const normalized = status.trim().toLowerCase();

  if (normalized === "uploaded" || normalized === "complete" || normalized === "available") {
    return {
      label: "Uploaded",
      classes: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }

  if (normalized === "missing") {
    return {
      label: "Missing",
      classes: "border-slate-200 bg-slate-50 text-slate-600",
    };
  }

  return {
    label: normalized ? titleCase(normalized) : "Pending",
    classes: "border-slate-200 bg-slate-50 text-slate-700",
  };
}

function formatConfidenceScore(value: number | null): string {
  if (typeof value !== "number") {
    return "N/A";
  }

  return `${clampScore(value)}%`;
}

function formatDebugValue(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? "null";
}

function formatActivityTime(value: string | null): string {
  if (!value) {
    return "Unknown time";
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(parsed));
}

function getActivityIcon(action: string): string {
  const normalized = action.trim().toLowerCase();

  if (normalized.includes("uploaded")) return "↑";
  if (normalized.includes("ai validated")) return "AI";
  if (normalized.includes("alert resolved")) return "✓";
  if (normalized.includes("alert triggered")) return "!";
  return "•";
}

function buildAiInsights(documents: DashboardDocument[], readinessStatus: ReadinessStatus): InsightItem[] {
  const insights: InsightItem[] = [];

  documents.forEach((document) => {
    const normalizedStatus = document.status.trim().toLowerCase();
    const normalizedAiStatus = document.aiStatus.trim().toLowerCase();

    if (normalizedStatus === "missing") {
      insights.push({
        id: `${document.id}-missing`,
        issue: `${document.documentType} is missing.`,
        recommendation: `Upload ${document.documentType} to improve compliance coverage.`,
        tone: "danger",
      });
    }

    if (normalizedAiStatus === "failed") {
      insights.push({
        id: `${document.id}-failed`,
        issue: `AI validation failed for ${document.documentType}.`,
        recommendation: "Review file quality, replace the document if needed, then rerun validation later.",
        tone: "danger",
      });
    }

    if (normalizedAiStatus === "pending") {
      insights.push({
        id: `${document.id}-pending`,
        issue: `${document.documentType} is still processing.`,
        recommendation: "Allow the AI workflow to finish before relying on this document in readiness checks.",
        tone: "warning",
      });
    }

    if (document.isExpired) {
      insights.push({
        id: `${document.id}-expired`,
        issue: `${document.documentType} is expired.`,
        recommendation: `Upload a current version of ${document.documentType} to restore compliance readiness.`,
        tone: "danger",
      });
    }

    if (typeof document.confidenceScore === "number" && document.confidenceScore < 70) {
      insights.push({
        id: `${document.id}-confidence`,
        issue: `${document.documentType} has low AI confidence at ${clampScore(document.confidenceScore)}%.`,
        recommendation: "Check image clarity, page completeness, and text legibility to improve extraction quality.",
        tone: "warning",
      });
    }
  });

  if (insights.length === 0) {
    insights.push({
      id: "healthy",
      issue:
        readinessStatus === "READY"
          ? "No active validation issues detected."
          : "No document-level AI issues detected.",
      recommendation:
        readinessStatus === "READY"
          ? "Maintain current document freshness and continue monitoring readiness."
          : "Focus on completing remaining compliance items to move readiness forward.",
      tone: readinessStatus === "READY" ? "success" : "warning",
    });
  }

  return insights.slice(0, 6);
}

function getTimelineStepState(document: DashboardDocument, step: "uploaded" | "processing" | "validated") {
  const uploadStatus = document.status.trim().toLowerCase();
  const aiStatus = document.aiStatus.trim().toLowerCase();
  const hasUpload = uploadStatus !== "missing";

  if (step === "uploaded") {
    return hasUpload ? "complete" : "pending";
  }

  if (step === "processing") {
    if (!hasUpload) return "pending";
    if (aiStatus === "complete" || aiStatus === "failed" || aiStatus === "pending") return "complete";
    return "pending";
  }

  if (!hasUpload) return "pending";
  if (aiStatus === "complete") return "complete";
  if (aiStatus === "failed") return "failed";
  return "pending";
}

function getTimelineDotClasses(state: "complete" | "pending" | "failed"): string {
  switch (state) {
    case "complete":
      return "bg-emerald-500";
    case "failed":
      return "bg-rose-500";
    case "pending":
    default:
      return "bg-slate-300";
  }
}

function getTimelineLineClasses(state: "complete" | "pending" | "failed"): string {
  switch (state) {
    case "complete":
      return "bg-emerald-400";
    case "failed":
      return "bg-rose-300";
    case "pending":
    default:
      return "bg-slate-200";
  }
}

function ContractorIntelligenceDashboard() {
  const params = useParams();
  const { loading: authLoading, user, role } = useAuth();
  const contractorId = typeof params?.contractorId === "string" ? params.contractorId : "";

  const [dashboard, setDashboard] = useState<DashboardData>(DEFAULT_DASHBOARD_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const uploadedDocumentsCount = useMemo(
    () =>
      dashboard.documents.filter(
        (document) => document.status.trim().toLowerCase() !== "missing"
      ).length,
    [dashboard.documents]
  );

  const latestDocumentWithFile = useMemo(
    () => dashboard.documents.find((document) => Boolean(document.fileUrl)),
    [dashboard.documents]
  );

  const uploadedDocuments = useMemo(
    () => dashboard.documents.filter((document) => Boolean(document.fileUrl)),
    [dashboard.documents]
  );

  const missingDocuments = useMemo(
    () =>
      dashboard.documents.filter(
        (document) => document.status.trim().toLowerCase() === "missing"
      ),
    [dashboard.documents]
  );

  const aiInsights = useMemo(
    () => buildAiInsights(dashboard.documents, dashboard.readinessStatus),
    [dashboard.documents, dashboard.readinessStatus]
  );

  const primaryMissingDocument = useMemo(
    () =>
      missingDocuments[0]?.documentType ?? dashboard.documents[0]?.documentType ?? "cipc",
    [dashboard.documents, missingDocuments]
  );

  const uploadContractor: UploadContractor | null = contractorId
    ? {
        id: contractorId,
        name: dashboard.name,
        companyName: dashboard.name,
      }
    : null;

  useEffect(() => {
    function handleContractorUpdated() {
      setRefreshToken((current) => current + 1);
    }

    window.addEventListener("contractor-updated", handleContractorUpdated);
    return () => {
      window.removeEventListener("contractor-updated", handleContractorUpdated);
    };
  }, []);

  useEffect(() => {
    if (authLoading || !user || !contractorId) {
      return;
    }

    let cancelled = false;

    async function loadContractorDashboard(showSkeleton = false) {
      try {
        if (showSkeleton) {
          setLoading(true);
        }

        setError(null);

        const response = await authFetch(API_ROUTES.CONTRACTOR_DETAIL(contractorId));
        const payload = (await response.json()) as ContractorApiPayload;
        const activityResponse = await authFetch(`/api/contractor-activity?contractorId=${encodeURIComponent(contractorId)}`);
        const activityPayload = (await activityResponse.json()) as ActivityItem[];

        if (cancelled) {
          return;
        }

        if (payload.success === false) {
          throw new Error(toText(payload.error) || "Unable to fetch contractor.");
        }

        setDashboard(normalizeDashboardData(payload));
        setActivity(Array.isArray(activityPayload) ? activityPayload : []);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        console.error("Failed to load contractor dashboard:", loadError);
        setError(getErrorMessage(loadError));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadContractorDashboard(true);

    const intervalId = window.setInterval(() => {
      void loadContractorDashboard(false);
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [authLoading, contractorId, refreshToken, user]);

  function openUploadModal(documentType?: string) {
    setSelectedDocType(documentType ?? primaryMissingDocument);
    setIsUploadOpen(true);
  }

  function openFile(fileUrl: string | null) {
    if (!fileUrl) {
      return;
    }

    window.open(fileUrl, "_blank", "noopener,noreferrer");
  }

  if (authLoading || loading) {
    return (
      <div className="bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Loading contractor intelligence...</p>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Card className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-rose-900">Contractor dashboard unavailable</h1>
            <p className="mt-2 text-sm text-rose-800">{error}</p>
          </Card>
        </div>
      </div>
    );
  }

  const readinessTone = getReadinessTone(dashboard.readinessStatus);
  const complianceBarClasses = getProgressBarClasses(dashboard.complianceScore);
  const readinessRadius = 42;
  const readinessCircumference = 2 * Math.PI * readinessRadius;
  const readinessOffset =
    readinessCircumference - (dashboard.readinessScore / 100) * readinessCircumference;

  return (
    <>
      <div className="bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                    Contractor Intelligence
                  </p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    Auto-refresh 5s
                  </span>
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                  {dashboard.name}
                </h1>
                <p className="max-w-2xl text-sm text-slate-600">
                  Compliance health, AI verification outcomes, and submission readiness in one
                  view.
                </p>
              </div>

              <div className="flex flex-col items-start gap-3 sm:items-end">
                <Badge tone={getReadinessBadgeTone(dashboard.readinessStatus)} className="px-4 py-1.5">
                  {dashboard.readinessStatus}
                </Badge>
                <div className={`rounded-2xl border px-4 py-3 text-sm ${getStatusPanelClasses(readinessTone)}`}>
                  <p className="font-semibold">Readiness Status</p>
                  <p className="mt-1">{dashboard.readinessStatus}</p>
                </div>
              </div>
            </div>
          </Card>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Compliance %</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                {dashboard.complianceScore}%
              </p>
              <p className="mt-2 text-sm text-slate-600">{dashboard.complianceStatus}</p>
            </Card>

            <Card className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Readiness Score</p>
              <div className="mt-4 flex items-center gap-4">
                <div className="relative h-24 w-24 shrink-0">
                  <svg viewBox="0 0 100 100" width="96" height="96" className="h-24 w-24 shrink-0 -rotate-90">
                    <circle
                      cx="50"
                      cy="50"
                      r={readinessRadius}
                      className="fill-none stroke-slate-200"
                      strokeWidth="10"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={readinessRadius}
                      className={`fill-none transition-all duration-500 ${getReadinessRingClasses(
                        dashboard.readinessScore
                      )}`}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={readinessCircumference}
                      strokeDashoffset={readinessOffset}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-slate-900">
                    {dashboard.readinessScore}%
                  </div>
                </div>

                <div>
                  <p className="text-lg font-semibold text-slate-900">
                    {dashboard.readinessStatus}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Circular readiness progress based on AI and document state.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Documents Uploaded</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                {uploadedDocumentsCount}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {dashboard.documents.length} tracked document
                {dashboard.documents.length === 1 ? "" : "s"}
              </p>
            </Card>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="space-y-4">
              <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Compliance Bar</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {dashboard.complianceCompleted} complete, {dashboard.complianceMissing} missing
                    </p>
                  </div>
                  <span className="text-sm font-medium text-slate-600">
                    {dashboard.complianceScore}% completed
                  </span>
                </div>

                <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all ${complianceBarClasses}`}
                    style={{ width: `${dashboard.complianceScore}%` }}
                  />
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <p className="font-semibold">Green</p>
                    <p className="mt-1">Complete</p>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="font-semibold">Yellow</p>
                    <p className="mt-1">Partial</p>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    <p className="font-semibold">Red</p>
                    <p className="mt-1">Risk</p>
                  </div>
                </div>
              </Card>

              <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Document Table</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      AI validation, expiry, confidence, action controls, and timeline state for each document.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    onClick={() => openUploadModal()}
                  >
                    Upload Document
                  </button>
                </div>

                {dashboard.documents.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                    <p className="text-sm font-medium text-slate-700">No documents uploaded yet.</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Start by uploading the first contractor document.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead>
                        <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          <th className="px-4 py-3">Document Type</th>
                          <th className="px-4 py-3">Upload Status</th>
                          <th className="px-4 py-3">AI Status</th>
                          <th className="px-4 py-3">Expiry Status</th>
                          <th className="px-4 py-3">Confidence Score</th>
                          <th className="px-4 py-3">Timeline</th>
                          <th className="px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {dashboard.documents.map((document) => {
                          const uploadStatus = getUploadStatusMeta(document.status);
                          const aiStatus = getAiStatusMeta(document.aiStatus);
                          const uploadedState = getTimelineStepState(document, "uploaded");
                          const processingState = getTimelineStepState(document, "processing");
                          const validatedState = getTimelineStepState(document, "validated");

                          return (
                            <tr key={document.id} className="align-top">
                              <td className="px-4 py-4">
                                <div>
                                  <p className="font-medium text-slate-900">{document.documentType}</p>
                                  <p className="mt-1 text-sm text-slate-500">
                                    Source status: {document.status}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${uploadStatus.classes}`}>
                                  {uploadStatus.label}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${aiStatus.classes}`}>
                                  {aiStatus.label}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                                    document.isExpired
                                      ? "border-rose-200 bg-rose-50 text-rose-700"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  }`}
                                >
                                  {document.isExpired ? "Expired" : "Valid"}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-sm font-medium text-slate-700">
                                {formatConfidenceScore(document.confidenceScore)}
                              </td>
                              <td className="px-4 py-4">
                                <div className="min-w-[220px]">
                                  <div className="flex items-center">
                                    <div className="flex min-w-0 grow items-center gap-2">
                                      <span className={`h-2.5 w-2.5 rounded-full ${getTimelineDotClasses(uploadedState)}`} />
                                      <span className="text-xs font-medium text-slate-600">Uploaded</span>
                                    </div>
                                    <span className={`h-0.5 w-8 ${getTimelineLineClasses(processingState)}`} />
                                    <div className="flex min-w-0 grow items-center gap-2">
                                      <span className={`h-2.5 w-2.5 rounded-full ${getTimelineDotClasses(processingState)}`} />
                                      <span className="text-xs font-medium text-slate-600">Processing</span>
                                    </div>
                                    <span className={`h-0.5 w-8 ${getTimelineLineClasses(validatedState)}`} />
                                    <div className="flex min-w-0 grow items-center gap-2">
                                      <span className={`h-2.5 w-2.5 rounded-full ${getTimelineDotClasses(validatedState)}`} />
                                      <span className="text-xs font-medium text-slate-600">Validated</span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                                    onClick={() => openUploadModal(document.documentType)}
                                  >
                                    Upload Document
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
                                    onClick={() => openFile(document.fileUrl)}
                                    disabled={!document.fileUrl}
                                  >
                                    View File
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500"
                                    disabled
                                    title="Future placeholder"
                                  >
                                    Re-run AI
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {role === "admin" ? (
                <Card className="rounded-3xl border border-amber-200 bg-amber-50/40 p-6 shadow-sm">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Temporary Verification Debug</h2>
                    <p className="mt-1 text-sm text-slate-700">
                      Admin-only raw verification state for uploaded compliance documents.
                    </p>
                  </div>

                  {uploadedDocuments.length === 0 ? (
                    <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-white px-5 py-8 text-center">
                      <p className="text-sm font-medium text-slate-700">No uploaded compliance documents to inspect.</p>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-4">
                      {uploadedDocuments.map((document) => (
                        <div key={`${document.id}-debug`} className="rounded-2xl border border-amber-200 bg-white p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-semibold text-slate-900">{document.documentType}</p>
                            <div className="flex flex-wrap gap-2 text-xs font-medium">
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                                verified: {String(document.verified)}
                              </span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                                aiValid: {document.aiValid === null ? "null" : String(document.aiValid)}
                              </span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                                isExpired: {String(document.isExpired)}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Extracted Fields
                              </p>
                              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-slate-700">
                                {formatDebugValue(document.extractedFields)}
                              </pre>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Validation Errors
                              </p>
                              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-slate-700">
                                {formatDebugValue(
                                  document.validationErrors.length > 0
                                    ? document.validationErrors
                                    : document.validationError
                                      ? [document.validationError]
                                      : []
                                )}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ) : null}

              <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Activity Timeline</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Newest contractor actions appear first and refresh automatically.
                  </p>
                </div>

                {activity.length === 0 ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                    <p className="text-sm font-medium text-slate-700">No activity recorded yet.</p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {activity.map((item, index) => (
                      <div key={item.id} className="flex gap-4">
                        <div className="flex w-10 flex-col items-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                            {getActivityIcon(item.action)}
                          </div>
                          {index < activity.length - 1 ? <div className="mt-2 h-full w-px bg-slate-200" /> : null}
                        </div>
                        <div className="grow rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-semibold text-slate-900">{item.action}</p>
                            <span className="text-xs font-medium text-slate-500">
                              {formatActivityTime(item.timestamp)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            Performed by: <span className="font-medium text-slate-800">{item.performedBy}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </section>

            <aside className="space-y-4">
              <Card className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Readiness Badge</h2>
                <div className={`mt-4 rounded-2xl border p-4 ${getStatusPanelClasses(readinessTone)}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Submission readiness</p>
                    <Badge tone={getReadinessBadgeTone(dashboard.readinessStatus)}>
                      {dashboard.readinessStatus}
                    </Badge>
                  </div>
                  <p className="mt-3 text-3xl font-semibold">{dashboard.readinessScore}%</p>
                </div>
              </Card>

              <Card className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Missing Documents</h2>
                <div className="mt-4 space-y-3">
                  {missingDocuments.length === 0 ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                      <p className="font-semibold">No missing documents</p>
                      <p className="mt-1">Current tracked items are already uploaded.</p>
                    </div>
                  ) : (
                    missingDocuments.map((document) => (
                      <div
                        key={document.id}
                        className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-amber-950">
                              {document.documentType}
                            </p>
                            <p className="mt-1 text-sm text-amber-800">
                              Upload required to improve compliance readiness.
                            </p>
                          </div>
                          <button
                            type="button"
                            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100"
                            onClick={() => openUploadModal(document.documentType)}
                          >
                            Quick Upload
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">AI Insight</h2>
                <div className="mt-4 space-y-3">
                  {aiInsights.map((insight) => (
                    <div
                      key={insight.id}
                      className={`rounded-2xl border px-4 py-4 ${getStatusPanelClasses(insight.tone)}`}
                    >
                      <p className="text-sm font-semibold">{insight.issue}</p>
                      <p className="mt-2 text-sm">{insight.recommendation}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
                <div className="mt-4 space-y-3">
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
                    onClick={() => openUploadModal()}
                  >
                    Upload Document
                  </button>
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => openFile(latestDocumentWithFile?.fileUrl ?? null)}
                    disabled={!latestDocumentWithFile?.fileUrl}
                  >
                    View File
                  </button>
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-500"
                    disabled
                    title="Future placeholder"
                  >
                    Re-run AI
                  </button>
                </div>
              </Card>
            </aside>
          </div>
        </div>
      </div>

      <UploadDocumentModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setSelectedDocType(null);
        }}
        contractor={uploadContractor}
        docType={selectedDocType}
      />
    </>
  );
}

export default function ContractorPage() {
  return <ContractorIntelligenceDashboard />;
}
