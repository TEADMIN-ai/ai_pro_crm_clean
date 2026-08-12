"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ContractorOpportunityWorkspace from "@/components/contractor-opportunities/ContractorOpportunityWorkspace";
import ContractorBusinessIdCard from "@/components/contractors/ContractorBusinessIdCard";
import ContractorLifecycleControls from "@/components/contractors/ContractorLifecycleControls";
import SarsTcsVerificationCard from "@/components/contractors/SarsTcsVerificationCard";
import UploadDocumentModal from "@/components/modals/UploadDocumentModal";
import { useAuth } from "@/context/AuthContext";
import { API_ROUTES } from "@/lib/apiRoutes";
import { authFetch } from "@/lib/client/authFetch";
import {
  hasContractorDocumentViewLocator,
  openContractorDocument,
  resolveContractorDocumentViewType,
} from "@/lib/contractors/contractorDocumentViewer";
import {
  getDocumentTypeLabel,
  normalizeSupportedDocumentType,
  resolveContractorDocumentStatus,
  SUPPORTED_DOCUMENT_TYPES,
  type SupportedDocumentType,
} from "@/lib/compliance/contractorCompliance";
import { buildContractorOpportunityWorkspaces } from "@/lib/contractor-opportunities/workspaceService";
import type { ContractorTenderSummary } from "@/types/deal";
import type { ContractorDocument } from "@/types/document";
import type { ContractorTimelineItem } from "@/types/intelligenceCenter";

type ContractorRecord = {
  id?: string;
  archived?: boolean | null;
  contractorId?: string;
  name?: string | null;
  companyName?: string | null;
  taxPin?: string | null;
  taxNumber?: string | null;
  taxReferenceNumber?: string | null;
  csdNumber?: string | null;
  csdMNumber?: string | null;
  mNumber?: string | null;
  status?: string | null;
  overallStatus?: string | null;
  complianceScore?: number | null;
  readinessScore?: number | null;
  docsMissing?: number | null;
  complianceApproved?: boolean | null;
  requiredDocsApprovedCount?: number | null;
  requiredDocsTotalCount?: number | null;
  reviewRequiredCount?: number | null;
  taxPinStatus?: string | null;
  csdStatus?: string | null;
  riskGrade?: string | null;
  reviewRecommendations?: string[] | null;
  createdAt?: string | number | null;
  updatedAt?: string | number | null;
  logoUrl?: string | null;
  businessLogoUrl?: string | null;
};

type ContractorNote = {
  id: string;
  note: string;
  contractorVisible: boolean;
  createdAt?: string | null;
};

type ContractorCommandNote = {
  id: string;
  contractorId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  noteType: "INFO" | "ACTION_REQUIRED" | "CLIENT_CONTACT" | "APPROVAL" | "WARNING" | "REJECTION";
  title: string;
  message: string;
  createdAt: string;
};

type ContractorLastAction = {
  id: string;
  actionType: string;
  summary: string;
  performedBy: string;
  timestamp: string;
  nextAction: string;
};

type AcknowledgementRecord = {
  id: string;
  signatureText: string;
  signedByName: string;
  signedByCapacity: string;
  signedAt: string;
  acknowledgementVersion: string;
};

type LinkedDeal = {
  id: string;
  title: string;
  stage: string;
  status?: string;
  tenderLockStatus?: string;
  readinessScore?: number;
  riskLevel?: string;
  updatedAt?: string | null;
  tenderAnalysis?: {
    deadline?: string | null;
    scope?: string | null;
    requiredCertificates?: string[];
  } | null;
  contractorTenderSummary?: ContractorTenderSummary | null;
};

type CanonicalDecision = { readinessScore: number | null; readinessDecisionStatus: string; complianceDecisionStatus: string; assignmentAllowed: boolean; identityMatchStatus: string; csdValidationStatus: string; archived: boolean; historicalDecision: { readinessScore: unknown; complianceStatus: unknown; }; };
type OnboardingPayload = {
  contractor: ContractorRecord;
  canonicalDecision?: CanonicalDecision;
  documents: ContractorDocument[];
  notes: ContractorNote[];
  commandNotes: ContractorCommandNote[];
  timeline: ContractorTimelineItem[];
  lastAction: ContractorLastAction | null;
  linkedDeals: LinkedDeal[];
  historicalDealCount?: number;
  acknowledgement: AcknowledgementRecord | null;
  viewer: {
    role: string;
    contractorId?: string | null;
    isPrivileged: boolean;
  };
};

type Props = {
  contractorId: string;
};

type DocumentGroup = {
  key: string;
  title: string;
  matches: string[];
  uploadType?: string;
  uploadLabel?: string;
};

type UploadTarget = {
  documentType: string;
  displayLabel: string;
};

const DOCUMENT_GROUPS: DocumentGroup[] = [
  { key: "registration", title: "Registration Documents", matches: ["cipc", "registration", "companyregistration"], uploadType: "cipc", uploadLabel: "CIPC" },
  { key: "tax", title: "Tax Documents", matches: ["tax", "taxclearance", "tcspin"], uploadType: "taxClearance", uploadLabel: "Tax Clearance" },
  { key: "csd", title: "CSD Documents", matches: ["csd", "csdmnumber"], uploadType: "csd", uploadLabel: "CSD" },
  { key: "bbbee", title: "B-BBEE", matches: ["bbbee", "bbee"], uploadType: "bbbee", uploadLabel: "BBBEE" },
  { key: "coida", title: "COIDA", matches: ["coida"], uploadType: "coida", uploadLabel: "COIDA" },
  { key: "bank", title: "Bank Confirmation", matches: ["bank", "bankconfirmation", "bankletter"], uploadType: "bankConfirmation", uploadLabel: "Bank Confirmation" },
  { key: "cidb", title: "CIDB", matches: ["cidb"], uploadType: "cidb", uploadLabel: "CIDB" },
];

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeToken(value: unknown): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatDate(value?: string | number | null): string {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return date.toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function documentLabel(document: ContractorDocument): string {
  return clean(document.documentName) || clean(document.documentType) || clean(document.docType) || clean(document.fileName) || "Document";
}

function documentStatus(document: ContractorDocument): string {
  if (document.verificationStatus === "VERIFIED_MANUAL") return "Manually Verified";
  if (document.verificationStatus === "REJECTED_MANUAL") return "Rejected";
  if (document.verified) return "Verified";
  if (document.fileUrl && isExtractionFailed(document)) return "Uploaded - Review Required";
  if (document.validationStatus === "REVIEW" || document.manualDecisionAvailable) return "Pending Review";
  return clean(document.status) || (document.fileUrl ? "Uploaded" : "Missing");
}

function documentStatusClasses(document: ContractorDocument): string {
  if (document.verificationStatus === "VERIFIED_MANUAL") return "border-sky-200 bg-sky-50 text-sky-700";
  if (document.verificationStatus === "REJECTED_MANUAL" || document.validationStatus === "FAIL") return "border-rose-200 bg-rose-50 text-rose-700";
  if (document.verified || document.validationStatus === "PASS") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function isExtractionFailed(document: ContractorDocument): boolean {
  if (!document.fileUrl) return false;
  return (
    document.extractionSource === "EMPTY" ||
    document.aiStatus === "failed" ||
    document.validationStatus === "REVIEW" ||
    document.manualDecisionAvailable === true ||
    document.extractedTextLength === 0 ||
    (typeof document.extractedText === "string" && document.extractedText.trim().length === 0)
  );
}

function documentSectionSummary(documents: ContractorDocument[]): string {
  if (documents.length === 0) return "No file on record";
  const uploadedCount = documents.filter((document) => Boolean(document.fileUrl)).length;
  const reviewCount = documents.filter(isExtractionFailed).length;
  if (reviewCount > 0) return `${uploadedCount} uploaded, ${reviewCount} requiring review`;
  return `${uploadedCount || documents.length} record(s)`;
}

function documentReviewNote(document: ContractorDocument): string | null {
  if (!document.fileUrl || !isExtractionFailed(document)) return null;
  return document.reviewReason || document.validationError || document.aiError || "File is uploaded, but no usable text was extracted. Manual review remains available.";
}

function getLastDocumentUpdate(documents: ContractorDocument[]): number | null {
  const values = documents
    .map((document) => document.updatedAt ?? document.uploadedAt ?? document.createdAt ?? null)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return values.length ? Math.max(...values) : null;
}

function groupDocuments(documents: ContractorDocument[]) {
  const grouped = DOCUMENT_GROUPS.map((group) => ({
    ...group,
    documents: documents.filter((document) => {
      const token = normalizeToken(document.documentType ?? document.docType ?? document.documentName ?? document.fileName);
      return group.matches.some((match) => token.includes(match));
    }),
  }));

  const groupedIds = new Set(grouped.flatMap((group) => group.documents.map((document) => document.id)));
  const contractorUploaded = documents.filter((document) => Boolean(document.fileUrl));
  const requestedMissing = documents.filter((document) => {
    const status = normalizeToken(document.status);
    return !document.fileUrl && (status === "missing" || Boolean(document.reviewReason || document.validationError));
  });
  const uncategorized = documents.filter((document) => !groupedIds.has(document.id));

  return { grouped, contractorUploaded, requestedMissing, uncategorized };
}

function resolveUploadTarget(group: DocumentGroup, firstDocument?: ContractorDocument): UploadTarget | null {
  const documentType = clean(firstDocument?.documentType) || clean(firstDocument?.docType) || clean(group.uploadType);

  if (!documentType) {
    return null;
  }

  return {
    documentType,
    displayLabel: group.uploadLabel ?? group.title,
  };
}

function getCompanyName(contractor: ContractorRecord): string {
  return clean(contractor.companyName) || clean(contractor.name) || "Contractor";
}

export function buildReadinessSummary(documents: ContractorDocument[], contractor: ContractorRecord, _decision?: CanonicalDecision) {
  void _decision;
  const verifiedTypes = new Set<SupportedDocumentType>();
  const missingLabels: string[] = [];

  for (const document of documents) {
    const normalizedType = normalizeSupportedDocumentType(document.documentType ?? document.docType ?? document.id);
    if (!normalizedType) {
      continue;
    }

    const status = resolveContractorDocumentStatus(document);
    if (status === "verified" || status === "expiringSoon") {
      verifiedTypes.add(normalizedType);
    }
  }

  for (const type of SUPPORTED_DOCUMENT_TYPES) {
    if (!verifiedTypes.has(type)) {
      missingLabels.push(getDocumentTypeLabel(type));
    }
  }

  const reviewRequiredCount = documents.filter(isExtractionFailed).length;
  const requiredDocsApprovedCount = verifiedTypes.size;
  const docsMissing = missingLabels.length;
  const readinessScore =
    typeof contractor.readinessScore === "number" && Number.isFinite(contractor.readinessScore)
      ? contractor.readinessScore
      : Math.round((requiredDocsApprovedCount / SUPPORTED_DOCUMENT_TYPES.length) * 100);

  return {
    readinessScore,
    requiredDocsApprovedCount,
    requiredDocsTotalCount: SUPPORTED_DOCUMENT_TYPES.length,
    docsMissing,
    reviewRequiredCount,
    missingLabels,
    canApprove: readinessScore === 100 && docsMissing === 0 && reviewRequiredCount === 0,
  };
}

export default function ContractorOnboardingView({ contractorId }: Props) {
  const { loading: authLoading, role } = useAuth();
  const [payload, setPayload] = useState<OnboardingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null);
  const [selectedDocLabel, setSelectedDocLabel] = useState<string | null>(null);
  const [signedByName, setSignedByName] = useState("");
  const [signedByCapacity, setSignedByCapacity] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [noteType, setNoteType] = useState<ContractorCommandNote["noteType"]>("INFO");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteMessage, setNoteMessage] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [activeDocumentSectionKey, setActiveDocumentSectionKey] = useState(DOCUMENT_GROUPS[0].key);
  const [approvingOnboarding, setApprovingOnboarding] = useState(false);

  async function loadOnboarding() {
    const response = await authFetch(API_ROUTES.CONTRACTOR_ONBOARDING(contractorId), {
      cache: "no-store",
    });
    const data = (await response.json()) as OnboardingPayload & { error?: string };

    if (!response.ok) {
      throw new Error(data.error || "Unable to load contractor onboarding.");
    }

    setPayload(data);
  }

  useEffect(() => {
    if (authLoading || !contractorId) {
      return;
    }

    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOnboarding()
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load contractor onboarding.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, contractorId]);

  const groupedDocuments = useMemo(
    () => groupDocuments(payload?.documents ?? []),
    [payload?.documents],
  );
  const activeDocumentSectionIndex = Math.max(
    0,
    groupedDocuments.grouped.findIndex((group) => group.key === activeDocumentSectionKey),
  );
  const activeDocumentSection = groupedDocuments.grouped[activeDocumentSectionIndex] ?? groupedDocuments.grouped[0];
  const previousDocumentSection = groupedDocuments.grouped[activeDocumentSectionIndex - 1] ?? null;
  const nextDocumentSection = groupedDocuments.grouped[activeDocumentSectionIndex + 1] ?? null;

  async function submitAcknowledgement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSigning(true);
    setError(null);

    try {
      const trimmedName = signedByName.trim();
      const trimmedCapacity = signedByCapacity.trim();
      const response = await authFetch(API_ROUTES.CONTRACTOR_ACKNOWLEDGEMENTS(contractorId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedByName: trimmedName,
          signedByCapacity: trimmedCapacity,
          signatureText: trimmedName,
          acceptedTerms,
          authorityConfirmed,
        }),
      });
      const result = (await response.json()) as { acknowledgement?: AcknowledgementRecord; error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Unable to save acknowledgement.");
      }

      await loadOnboarding();
      setSignedByName("");
      setSignedByCapacity("");
      setAcceptedTerms(false);
      setAuthorityConfirmed(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save acknowledgement.");
    } finally {
      setSigning(false);
    }
  }

  async function submitCommandNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingNote(true);
    setError(null);

    try {
      const response = await authFetch(API_ROUTES.CONTRACTOR_NOTES(contractorId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteType,
          title: noteTitle,
          message: noteMessage,
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "Unable to save command note.");
      }

      setNoteType("INFO");
      setNoteTitle("");
      setNoteMessage("");
      await loadOnboarding();
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : "Unable to save command note.");
    } finally {
      setSavingNote(false);
    }
  }

  async function approveOnboardingPortfolio() {
    const approvalNotes = window.prompt("Approval notes for this onboarding portfolio");
    if (approvalNotes === null || approvingOnboarding) {
      return;
    }

    setApprovingOnboarding(true);
    setError(null);

    try {
      const response = await authFetch(API_ROUTES.CONTRACTOR_APPROVE(contractorId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ approvalNotes }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string; blockers?: string[] } | null;

      if (!response.ok) {
        throw new Error(result?.blockers?.join("; ") || result?.error || `Approval failed (${response.status})`);
      }

      await loadOnboarding();
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Unable to approve onboarding.");
    } finally {
      setApprovingOnboarding(false);
    }
  }

  function openUpload(documentType?: string, documentLabel?: string) {
    setSelectedDocType(documentType ?? null);
    setSelectedDocLabel(documentLabel ?? null);
    setIsUploadOpen(true);
  }

  if (authLoading || loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-medium text-slate-600">
        Loading contractor onboarding...
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        {error}
      </div>
    );
  }

  if (!payload) {
    return null;
  }

  const companyName = getCompanyName(payload.contractor);
  const lastDocumentUpdateAt = getLastDocumentUpdate(payload.documents);
  const uploadContractor = { id: contractorId, name: companyName, companyName };
  const canUpload = role === "contractor" || payload.viewer.isPrivileged;
  const opportunityWorkspaces = buildContractorOpportunityWorkspaces({
    contractorId,
    deals: payload.linkedDeals,
    documents: payload.documents,
    staffNotes: payload.commandNotes,
    contractorNotes: payload.notes,
    timeline: payload.timeline,
  });
  const readinessSummary = buildReadinessSummary(payload.documents, payload.contractor, payload.canonicalDecision);
  const canApproveOnboarding = payload.viewer.isPrivileged && payload.contractor.complianceApproved !== true;

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-6">
        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {error}
          </div>
        ) : null}

        <SarsTcsVerificationCard contractorId={contractorId} canManage={payload.viewer.isPrivileged} identityMatchStatus={payload.canonicalDecision?.identityMatchStatus} />

        <ContractorBusinessIdCard
          contractorId={contractorId}
          companyName={companyName}
          taxNumber={payload.contractor.taxPin ?? payload.contractor.taxNumber ?? payload.contractor.taxReferenceNumber}
          csdNumber={payload.canonicalDecision?.csdValidationStatus === "VALID" ? (payload.contractor.csdNumber ?? payload.contractor.csdMNumber ?? payload.contractor.mNumber) : null}
          onboardedAt={payload.contractor.createdAt}
          archived={payload.canonicalDecision?.archived === true}
          historicalReadinessScore={typeof payload.canonicalDecision?.historicalDecision.readinessScore === "number" ? payload.canonicalDecision.historicalDecision.readinessScore : null}
          status={payload.contractor.status}
          overallStatus={payload.contractor.overallStatus}
          readinessScore={readinessSummary.readinessScore}
          requiredDocsApprovedCount={readinessSummary.requiredDocsApprovedCount}
          requiredDocsTotalCount={readinessSummary.requiredDocsTotalCount}
          docsMissing={readinessSummary.docsMissing}
          reviewRequiredCount={readinessSummary.reviewRequiredCount}
          taxPinStatus={payload.contractor.taxPinStatus}
          csdStatus={payload.canonicalDecision?.csdValidationStatus === "VALID" ? "Verified" : payload.canonicalDecision?.csdValidationStatus === "INVALID" ? "Invalid" : "Unresolved"}
          lastDocumentUpdateAt={lastDocumentUpdateAt}
          logoUrl={payload.contractor.logoUrl ?? payload.contractor.businessLogoUrl}
          href={`/dashboard/contractors/${encodeURIComponent(contractorId)}`}
          canApproveOnboarding={canApproveOnboarding}
          approveDisabledReason={
            readinessSummary.canApprove
              ? null
              : `${readinessSummary.docsMissing} missing and ${readinessSummary.reviewRequiredCount} requiring review`
          }
          onApproveOnboarding={() => void approveOnboardingPortfolio()}
        />

        {payload.lastAction ? <LastActionBanner action={payload.lastAction} /> : null}



        <ContractorLifecycleControls contractorId={contractorId} contractorName={companyName} status={payload.contractor.status} archived={payload.contractor.archived === true} role={role} onComplete={loadOnboarding} />

        <ExecutiveContractorProfile
          contractor={payload.contractor}
          documents={payload.documents}
          deals={payload.linkedDeals}
          timeline={payload.timeline}
          readinessSummary={readinessSummary}
        />


        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-xl font-semibold text-slate-950">Business Documentation</h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Documents remain linked to the existing contractor document file.
                  </p>
                </div>
                {canUpload ? (
                  <button
                    type="button"
                    onClick={() => openUpload()}
                    className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
                  >
                    Upload Document
                  </button>
                ) : null}
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Section {activeDocumentSectionIndex + 1} of {groupedDocuments.grouped.length}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-950">{activeDocumentSection.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">{documentSectionSummary(activeDocumentSection.documents)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!previousDocumentSection}
                      onClick={() => previousDocumentSection && setActiveDocumentSectionKey(previousDocumentSection.key)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={!nextDocumentSection}
                      onClick={() => nextDocumentSection && setActiveDocumentSectionKey(nextDocumentSection.key)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Next
                    </button>
                    {canUpload && resolveUploadTarget(activeDocumentSection, activeDocumentSection.documents[0]) ? (
                      <button
                        type="button"
                        onClick={() => {
                          const uploadTarget = resolveUploadTarget(activeDocumentSection, activeDocumentSection.documents[0]);
                          if (uploadTarget) openUpload(uploadTarget.documentType, uploadTarget.displayLabel);
                        }}
                        className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                      >
                        Upload {activeDocumentSection.uploadLabel ?? activeDocumentSection.title}
                      </button>
                    ) : null}
                  </div>
                </div>

                <nav aria-label="Document sections" className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {groupedDocuments.grouped.map((group, index) => {
                    const active = group.key === activeDocumentSection.key;
                    const hasReview = group.documents.some(isExtractionFailed);
                    return (
                      <button
                        key={group.key}
                        type="button"
                        onClick={() => setActiveDocumentSectionKey(group.key)}
                        aria-current={active ? "step" : undefined}
                        className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${
                          active
                            ? "border-sky-300 bg-sky-50 text-sky-800"
                            : hasReview
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {index + 1}. {group.title}
                      </button>
                    );
                  })}
                </nav>

                <div className="mt-4 space-y-3">
                  {activeDocumentSection.documents.length ? (
                    activeDocumentSection.documents.map((document) => (
                      <DocumentRow
                        key={document.id}
                        contractorId={contractorId}
                        document={document}
                        onUpdated={loadOnboarding}
                        canReview={payload.viewer.isPrivileged}
                        canUpload={canUpload}
                        onUploadReplacement={(documentType, label) => openUpload(documentType, label)}
                      />
                    ))
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-600">
                      No file on record for {activeDocumentSection.title.toLowerCase()}.
                    </p>
                  )}
                </div>
              </div>

              {groupedDocuments.uncategorized.length ? (
                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                  <h2 className="font-semibold text-slate-900">Other Contractor-Uploaded Documents</h2>
                  <div className="mt-3 divide-y divide-slate-100">
                    {groupedDocuments.uncategorized.map((document) => (
                      <DocumentRow
                        key={document.id}
                        contractorId={contractorId}
                        document={document}
                        onUpdated={loadOnboarding}
                        canReview={payload.viewer.isPrivileged}
                        canUpload={canUpload}
                        onUploadReplacement={(documentType, label) => openUpload(documentType, label)}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <ContractorOpportunityWorkspace opportunities={opportunityWorkspaces} />
            {payload.historicalDealCount && payload.historicalDealCount !== payload.linkedDeals.length ? <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">Historical deal references: {payload.historicalDealCount}. Current contractor opportunity workspace items: {payload.linkedDeals.length}. Historical references remain readable and are not current assignments.</p> : null}
            <ContractorTimelinePanel timeline={payload.timeline} />
          </div>

          <aside className="space-y-6">
            {payload.viewer.isPrivileged ? (
              <OnboardingApprovalPanel
                complianceApproved={payload.canonicalDecision?.archived !== true && payload.canonicalDecision?.complianceDecisionStatus === "VALID"}
                readinessScore={readinessSummary.readinessScore}
                requiredDocsApprovedCount={readinessSummary.requiredDocsApprovedCount}
                requiredDocsTotalCount={readinessSummary.requiredDocsTotalCount}
                docsMissing={readinessSummary.docsMissing}
                reviewRequiredCount={readinessSummary.reviewRequiredCount}
                missingLabels={readinessSummary.missingLabels}
                canApprove={readinessSummary.canApprove && canApproveOnboarding}
                approving={approvingOnboarding}
                onApprove={approveOnboardingPortfolio}
              />
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Missing / Requested Documents</h2>
              <div className="mt-4 space-y-3">
                {groupedDocuments.requestedMissing.length ? (
                  groupedDocuments.requestedMissing.map((document) => (
                    <div key={`${document.id}-requested`} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="font-semibold text-amber-950">{documentLabel(document)}</p>
                      <p className="mt-1 text-sm text-amber-800">
                        {document.reviewReason || document.validationError || "Staff requested this document."}
                      </p>
                      {canUpload ? (
                        <button
                          type="button"
                          onClick={() => openUpload(document.documentType ?? document.docType, document.documentType ?? document.docType)}
                          className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                        >
                          Upload Replacement
                        </button>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
                    No staff-requested missing documents.
                  </p>
                )}
              </div>
            </div>

            <AcknowledgementPanel
              acknowledgement={payload.acknowledgement}
              signedByName={signedByName}
              signedByCapacity={signedByCapacity}
              acceptedTerms={acceptedTerms}
              authorityConfirmed={authorityConfirmed}
              signing={signing}
              onSignedByNameChange={setSignedByName}
              onSignedByCapacityChange={setSignedByCapacity}
              onAcceptedTermsChange={setAcceptedTerms}
              onAuthorityConfirmedChange={setAuthorityConfirmed}
              onSubmit={submitAcknowledgement}
            />

            {payload.viewer.isPrivileged ? (
              <CommandLogPanel
                notes={payload.commandNotes}
                noteType={noteType}
                noteTitle={noteTitle}
                noteMessage={noteMessage}
                savingNote={savingNote}
                onNoteTypeChange={setNoteType}
                onNoteTitleChange={setNoteTitle}
                onNoteMessageChange={setNoteMessage}
                onSubmit={submitCommandNote}
              />
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Visible Staff Notes</h2>
              <div className="mt-4 space-y-3">
                {payload.notes.length ? (
                  payload.notes.map((note) => (
                    <div key={note.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm text-slate-800">{note.note}</p>
                      <p className="mt-2 text-xs font-medium text-slate-500">{formatDate(note.createdAt)}</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                    No contractor-visible notes on file.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>

      <UploadDocumentModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setSelectedDocType(null);
          setSelectedDocLabel(null);
          void loadOnboarding();
        }}
        contractor={uploadContractor}
        docType={selectedDocType}
        selectedLabel={selectedDocLabel}
      />
    </>
  );
}


function ExecutiveContractorProfile({
  contractor, canonicalDecision, documents, deals, timeline, readinessSummary,
}: {
  contractor: ContractorRecord;
  canonicalDecision?: CanonicalDecision; documents: ContractorDocument[]; deals: LinkedDeal[]; timeline: ContractorTimelineItem[]; readinessSummary: ReturnType<typeof buildReadinessSummary>;
}) {
  const archived = canonicalDecision?.archived === true;
  const historicalComplianceScore = typeof contractor.complianceScore === "number" ? contractor.complianceScore : readinessSummary.readinessScore;
  const complianceScore = canonicalDecision?.readinessScore ?? readinessSummary.readinessScore;
  const verifiedCount = documents.filter((document) => document.verified || document.validationStatus === "PASS" || document.verificationStatus === "VERIFIED_MANUAL").length;
  const uploadedCount = documents.filter((document) => Boolean(document.fileUrl)).length;
  const expiringCount = documents.filter((document) => document.expiryAlert === "expiringSoon").length;
  const expiredCount = documents.filter((document) => document.expiryAlert === "expired" || document.isExpired).length;
  const tenderWins = deals.filter((deal) => { const status = (deal.stage + " " + (deal.status ?? "") + " " + (deal.tenderLockStatus ?? "")).toLowerCase(); return status.includes("won") || status.includes("award"); });
  const riskRating = clean(contractor.riskGrade) || clean(deals.find((deal) => clean(deal.riskLevel))?.riskLevel) || "Pending review";
  const submissionHistory = [...deals].sort((first, second) => new Date(second.updatedAt ?? 0).getTime() - new Date(first.updatedAt ?? 0).getTime()).slice(0, 4);
  const documentExpiryTimeline = [...documents].filter((document) => Boolean(document.expiresAt ?? document.expiryDate ?? document.aiData?.expiryDate)).sort((first, second) => new Date(first.expiresAt ?? first.expiryDate ?? first.aiData?.expiryDate ?? 0).getTime() - new Date(second.expiresAt ?? second.expiryDate ?? second.aiData?.expiryDate ?? 0).getTime()).slice(0, 5);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Executive Contractor Profile</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Performance and Readiness Overview</h2></div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{archived ? "Archived / Inactive" : "Operational view"}</span>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryItem label={archived ? "Historical Compliance Score" : "Compliance Score"} value={Math.round(archived ? historicalComplianceScore : complianceScore) + "%"} />
        <SummaryItem label={archived ? "Historical Readiness Score" : "Readiness Score"} value={archived ? "Not operational" : Math.round(readinessSummary.readinessScore) + "%"} />
        <SummaryItem label="Document Health" value={verifiedCount + "/" + readinessSummary.requiredDocsTotalCount + " verified; " + uploadedCount + " uploaded; " + expiringCount + " expiring; " + expiredCount + " expired"} />
        <SummaryItem label="Submission History" value={submissionHistory.length ? submissionHistory.length + " active records" : "No submissions recorded"} />
        <SummaryItem label="Tender Wins" value={tenderWins.length ? tenderWins.length + " recorded" : "No wins recorded"} />
        <SummaryItem label="Risk Rating" value={archived ? "Archived / Inactive" : riskRating} />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">AI Recommendations</p><p className="mt-2 text-sm text-slate-700">AI recommendations are not connected in this view.</p></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Timeline</p><div className="mt-3 space-y-2">{timeline.slice(0, 3).map((item) => (<p key={item.id} className="text-sm text-slate-700"><span className="font-semibold text-slate-900">{item.label}</span> - {formatDate(item.timestamp)}</p>))}{timeline.length === 0 ? <p className="text-sm text-slate-500">No timeline events recorded.</p> : null}</div></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Document Expiry Timeline</p><div className="mt-3 space-y-2">{documentExpiryTimeline.map((document) => (<p key={document.id} className="text-sm text-slate-700"><span className="font-semibold text-slate-900">{documentLabel(document)}</span> - {formatDate(document.expiresAt ?? document.expiryDate ?? document.aiData?.expiryDate)}</p>))}{documentExpiryTimeline.length === 0 ? <p className="text-sm text-slate-500">No document expiry dates recorded.</p> : null}</div></div>
      </div>
    </section>
  );
}

function OnboardingApprovalPanel(props: {
  complianceApproved: boolean;
  readinessScore: number;
  requiredDocsApprovedCount: number;
  requiredDocsTotalCount: number;
  docsMissing: number;
  reviewRequiredCount: number;
  missingLabels: string[];
  canApprove: boolean;
  approving: boolean;
  onApprove: () => void;
}) {
  const blockerText =
    props.missingLabels.length > 0
      ? props.missingLabels.join(", ")
      : props.reviewRequiredCount > 0
        ? `${props.reviewRequiredCount} document(s) require review`
        : "Ready for approval";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Onboarding Approval</h2>
          <p className="mt-1 text-sm text-slate-600">
            Approval is based on verified required documents.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
          props.complianceApproved
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : props.canApprove
              ? "border-sky-200 bg-sky-50 text-sky-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
        }`}>
          {props.complianceApproved ? "Approved / Compliant" : props.canApprove ? "Pending Review" : "Review Required"}
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Compliance</p>
          <p className="text-2xl font-bold text-slate-950">{props.readinessScore}%</p>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${props.readinessScore}%` }} />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Approved</dt>
            <dd className="mt-1 font-bold text-slate-950">{props.requiredDocsApprovedCount}/{props.requiredDocsTotalCount}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Missing</dt>
            <dd className="mt-1 font-bold text-slate-950">{props.docsMissing}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Review</dt>
            <dd className="mt-1 font-bold text-slate-950">{props.reviewRequiredCount}</dd>
          </div>
        </dl>
      </div>

      {!props.complianceApproved && !props.canApprove ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Approval blocked</p>
          <p className="mt-1">{blockerText}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={props.onApprove}
        disabled={props.complianceApproved || !props.canApprove || props.approving}
        className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
      >
        {props.complianceApproved ? "Onboarding Approved" : props.approving ? "Approving..." : "Approve Onboarding Portfolio"}
      </button>
    </div>
  );
}

function LastActionBanner({ action }: { action: ContractorLastAction }) {
  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Last Action</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">{action.summary}</h2>
          <p className="mt-2 text-sm text-slate-700">Next Action: {action.nextAction}</p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-white p-3">
          <p className="text-xs font-semibold text-slate-500">Performed By</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{action.performedBy}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">Action Type</p>
          <p className="mt-1 text-sm text-slate-800">{action.actionType}</p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-white p-3">
          <p className="text-xs font-semibold text-slate-500">Timestamp</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(action.timestamp)}</p>
        </div>
      </div>
    </section>
  );
}

const NOTE_TYPES: ContractorCommandNote["noteType"][] = [
  "INFO",
  "ACTION_REQUIRED",
  "CLIENT_CONTACT",
  "APPROVAL",
  "WARNING",
  "REJECTION",
];

function CommandLogPanel(props: {
  notes: ContractorCommandNote[];
  noteType: ContractorCommandNote["noteType"];
  noteTitle: string;
  noteMessage: string;
  savingNote: boolean;
  onNoteTypeChange: (value: ContractorCommandNote["noteType"]) => void;
  onNoteTitleChange: (value: string) => void;
  onNoteMessageChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Contractor Command Log</h2>
      <form className="mt-4 space-y-3" onSubmit={props.onSubmit}>
        <select
          value={props.noteType}
          onChange={(event) => props.onNoteTypeChange(event.target.value as ContractorCommandNote["noteType"])}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
        >
          {NOTE_TYPES.map((type) => (
            <option key={type} value={type}>{type.replace(/_/g, " ")}</option>
          ))}
        </select>
        <input
          value={props.noteTitle}
          onChange={(event) => props.onNoteTitleChange(event.target.value)}
          placeholder="Title"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
          required
        />
        <textarea
          value={props.noteMessage}
          onChange={(event) => props.onNoteMessageChange(event.target.value)}
          placeholder="Message"
          className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
          required
        />
        <button
          type="submit"
          disabled={props.savingNote}
          className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300"
        >
          {props.savingNote ? "Saving..." : "Add Command Note"}
        </button>
      </form>

      <div className="mt-5 space-y-3">
        {props.notes.slice(0, 6).map((note) => (
          <div key={note.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-slate-900">{note.title}</p>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {note.noteType.replace(/_/g, " ")}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{note.message}</p>
            <p className="mt-2 text-xs text-slate-500">
              {note.authorName} - {formatDate(note.createdAt)}
            </p>
          </div>
        ))}
        {props.notes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            No command notes recorded.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ContractorTimelinePanel({ timeline }: { timeline: ContractorTimelineItem[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Unified Contractor Timeline</h2>
      <div className="mt-4 space-y-3">
        {timeline.slice(0, 16).map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{item.label}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {String(item.metadata.documentType ?? item.metadata.title ?? item.targetId ?? "Contractor")}
                </p>
              </div>
              <p className="text-xs font-medium text-slate-500">{formatDate(item.timestamp)}</p>
            </div>
          </div>
        ))}
        {timeline.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            No operational timeline events recorded yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DocumentRow({
  contractorId,
  document,
  onUpdated,
  canReview,
  canUpload,
  onUploadReplacement,
}: {
  contractorId: string;
  document: ContractorDocument;
  onUpdated: () => Promise<void>;
  canReview: boolean;
  canUpload: boolean;
  onUploadReplacement: (documentType: string, label: string) => void;
}) {
  const [isOpening, setIsOpening] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [reprocessStatus, setReprocessStatus] = useState<string | null>(null);

  async function openDocument() {
    const documentType = resolveContractorDocumentViewType(document);
    if (!hasContractorDocumentViewLocator(document) || !documentType || isOpening) {
      return;
    }

    setIsOpening(true);
    setOpenError(null);

    try {
      await openContractorDocument({ contractorId, documentType });
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : "Unable to open document.");
    } finally {
      setIsOpening(false);
    }
  }

  async function reprocessDocument() {
    const documentType = resolveContractorDocumentViewType(document);
    if (!documentType || isReprocessing) {
      return;
    }

    setIsReprocessing(true);
    setReprocessStatus("Processing...");
    setOpenError(null);

    try {
      const response = await authFetch(API_ROUTES.CONTRACTOR_DOCUMENT_EXECUTE(contractorId, documentType), {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? `Reprocess failed with ${response.status}`);
      }

      setReprocessStatus("Success");
      await onUpdated();
    } catch (error) {
      setReprocessStatus("Failed");
      setOpenError(error instanceof Error ? error.message : "Unable to reprocess document.");
    } finally {
      setIsReprocessing(false);
    }
  }

  async function applyManualDecision(action: "approve" | "reject") {
    if (isReviewing) return;

    const documentType = clean(document.documentType) || clean(document.docType) || clean(document.id);
    const promptLabel = action === "approve" ? "Approval note" : "Decline reason";
    const note = window.prompt(`${promptLabel} for ${documentLabel(document)}`);
    if (!documentType || !note?.trim()) {
      setOpenError(`${promptLabel} is required.`);
      return;
    }

    setIsReviewing(true);
    setOpenError(null);

    try {
      const response = await authFetch(API_ROUTES.CONTRACTOR_DOCUMENT_REVIEW(contractorId, documentType), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action,
          reviewReason: note.trim(),
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? `Manual ${action} failed (${response.status})`);
      }

      await onUpdated();
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : `Unable to ${action} document.`);
    } finally {
      setIsReviewing(false);
    }
  }

  const documentType = clean(document.documentType) || clean(document.docType) || clean(document.id);
  const reviewNote = documentReviewNote(document);
  const metadata = [
    ["Updated", document.updatedAt ? formatDate(document.updatedAt) : "No update timestamp"],
    ["Extraction Source", document.extractionSource ?? "Not recorded"],
    ["Text Length", `${document.extractedTextLength ?? 0} chars`],
    ["OCR Length", `${document.ocrTextLength ?? 0} chars`],
    ["Analysis Time", formatDate(document.analysisTimestamp)],
    ["Manual Review", document.manualDecisionAvailable ? "Available" : canReview ? "Available to staff" : "Requires authorised staff"],
  ] as const;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-xs font-black text-sky-700">
              DOC
            </span>
            <p className="min-w-[14rem] max-w-full break-words text-sm font-semibold text-slate-950">{documentLabel(document)}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${documentStatusClasses(document)}`}>
              {documentStatus(document)}
            </span>
          </div>
          {reviewNote ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="font-semibold">Uploaded file requires review</p>
              <p className="mt-1">{reviewNote}</p>
            </div>
          ) : null}
          <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
            {metadata.map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                <dt className="font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</dt>
                <dd className="mt-1 break-words font-medium text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
          {openError ? <p className="mt-2 text-xs font-medium text-rose-600">{openError}</p> : null}
          {reprocessStatus ? <p className="mt-2 text-xs font-medium text-slate-600">{reprocessStatus}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 xl:max-w-[19rem] xl:justify-end">
          {hasContractorDocumentViewLocator(document) ? (
            <>
              <button
                type="button"
                onClick={openDocument}
                disabled={isOpening}
                className="inline-flex justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-60"
              >
                {isOpening ? "Opening..." : "View"}
              </button>
              <button
                type="button"
                onClick={reprocessDocument}
                disabled={isReprocessing}
                className="inline-flex justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                {isReprocessing ? "Processing..." : "Reprocess"}
              </button>
            </>
          ) : null}
          {canUpload && documentType ? (
            <button
              type="button"
              onClick={() => onUploadReplacement(documentType, documentLabel(document))}
              className="inline-flex justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Upload Replacement
            </button>
          ) : null}
          {canReview && hasContractorDocumentViewLocator(document) ? (
            <>
              <button
                type="button"
                onClick={() => applyManualDecision("approve")}
                disabled={isReviewing}
                className="inline-flex justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
              >
                {isReviewing ? "Saving..." : "Verify Manually"}
              </button>
              <button
                type="button"
                onClick={() => applyManualDecision("reject")}
                disabled={isReviewing}
                className="inline-flex justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
              >
                {isReviewing ? "Saving..." : "Decline"}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AcknowledgementPanel(props: {
  acknowledgement: AcknowledgementRecord | null;
  signedByName: string;
  signedByCapacity: string;
  acceptedTerms: boolean;
  authorityConfirmed: boolean;
  signing: boolean;
  onSignedByNameChange: (value: string) => void;
  onSignedByCapacityChange: (value: string) => void;
  onAcceptedTermsChange: (value: boolean) => void;
  onAuthorityConfirmedChange: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const canSubmit =
    props.signedByName.trim().length > 1 &&
    props.signedByCapacity.trim().length > 1 &&
    props.acceptedTerms &&
    props.authorityConfirmed &&
    !props.signing;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Digital Acknowledgement</h2>
      {props.acknowledgement ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Signed by {props.acknowledgement.signedByName}</p>
          <p className="mt-1">{props.acknowledgement.signedByCapacity}</p>
          <p className="mt-2 text-xs font-medium">
            {formatDate(props.acknowledgement.signedAt)} - {props.acknowledgement.acknowledgementVersion}
          </p>
        </div>
      ) : null}

      <form className="mt-4 space-y-4" onSubmit={props.onSubmit}>
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Full name</span>
          <input
            value={props.signedByName}
            onChange={(event) => props.onSignedByNameChange(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Capacity / position</span>
          <input
            value={props.signedByCapacity}
            onChange={(event) => props.onSignedByCapacityChange(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            required
          />
        </label>
        <label className="flex gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={props.acceptedTerms}
            onChange={(event) => props.onAcceptedTermsChange(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300"
          />
          <span>I accept the onboarding terms and conditions.</span>
        </label>
        <label className="flex gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={props.authorityConfirmed}
            onChange={(event) => props.onAuthorityConfirmedChange(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300"
          />
          <span>I confirm authority to sign on behalf of the company.</span>
        </label>
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex w-full justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {props.signing ? "Applying Signature..." : "Apply Digital Signature"}
        </button>
      </form>
    </div>
  );
}

function LinkedDealsPanel({ deals }: { deals: LinkedDeal[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Linked RFQs / Tenders</h2>
      <div className="mt-4 space-y-4">
        {deals.length ? (
          deals.map((deal) => (
            <div key={deal.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Link href={`/dashboard/deals/${encodeURIComponent(deal.id)}`} className="font-semibold text-slate-950 hover:text-sky-700">
                    {deal.title || deal.id}
                  </Link>
                  <p className="mt-1 text-sm text-slate-600">
                    {deal.stage} - {deal.tenderLockStatus ?? deal.status ?? "Live"}
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {typeof deal.readinessScore === "number" ? `${deal.readinessScore}% readiness` : "Readiness pending"}
                </span>
              </div>

              {deal.contractorTenderSummary ? (
                <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                  <SummaryItem label="Scope" value={deal.contractorTenderSummary.scopeOfWork} />
                  <SummaryItem label="Closing Date" value={deal.contractorTenderSummary.closingDate} />
                  <SummaryItem label="Briefing" value={`${deal.contractorTenderSummary.briefingSessionRequired} / ${deal.contractorTenderSummary.briefingType}`} />
                  <SummaryItem label="Location / Platform" value={deal.contractorTenderSummary.briefingLocationOrPlatform} />
                  <SummaryList label="Required Documents" values={deal.contractorTenderSummary.requiredDocuments} />
                  <SummaryList label="Action Checklist" values={deal.contractorTenderSummary.contractorActionChecklist} />
                </div>
              ) : deal.tenderAnalysis ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  <p>{deal.tenderAnalysis.scope || "AI summary pending."}</p>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Closing: {deal.tenderAnalysis.deadline || "Unknown"}
                  </p>
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
                  RFQ AI summary has not been generated yet.
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
            No linked RFQs or tenders assigned to this contractor.
          </p>
        )}
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-slate-800">{value || "Unknown"}</p>
    </div>
  );
}

function SummaryList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      {values.length ? (
        <ul className="mt-2 space-y-1 text-slate-800">
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-slate-500">None listed</p>
      )}
    </div>
  );
}
