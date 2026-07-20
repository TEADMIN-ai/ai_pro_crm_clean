"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { API_ROUTES } from "@/lib/apiRoutes";
import { authFetch } from "@/lib/client/authFetch";
import { useAuth } from "@/context/AuthContext";
import {
  SUPPORTED_DOCUMENT_TYPES,
  getDocumentTypeLabel,
  type SupportedDocumentType,
} from "@/lib/compliance/contractorCompliance";
import { matchRequirements } from "@/lib/tender/matchRequirements";
import { getDealContractorDisplayName, isDealContractorResolved } from "@/lib/deals/contractorReferenceDisplay";
import { buildAssignContractorRequest, canManageDealContractorLink, getContractorLinkActionLabel } from "@/lib/deals/dealsHubContractorAssignment";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Deal = {
  id: string;
  title?: string;
  name?: string;
  status?: string;
  readinessScore?: number;
  riskLevel?: string;
  contractorId?: string;
  contractorName?: string;
  storedContractorReference?: string | null;
  contractorReferenceResolution?: {
    status: "none" | "resolved" | "unresolved";
    referenceField?: string;
    referenceType?: string;
    contractorId?: string;
    failureReason?: string;
  } | null;
  missingDocs?: string[];
  suggestions?: string[];
};

type ContractorDocumentEntry = {
  uploaded?: boolean;
  valid?: boolean;
  issues?: string[];
};

type ContractorRecord = {
  id: string;
  complianceApproved?: boolean;
  readinessScore?: number;
  docsMissing?: number;
  tenderLockStatus?: "READY" | "RISK" | "BLOCKED";
  isTenderLocked?: boolean;
  documents?: Partial<Record<"cipc" | "tax" | "bbbee" | "coida", ContractorDocumentEntry>>;
};

type ContractorOption = {
  id: string;
  companyName: string;
};

type UploadKind = "compliance" | "supporting";
type StatusTone = "idle" | "loading" | "success" | "error";

type StatusState = {
  label: string;
  detail: string;
  tone: StatusTone;
};

type GeneratedTenderPack = {
  url: string;
};

const DEFAULT_STATUS: StatusState = {
  label: "Idle",
  detail: "No action started yet.",
  tone: "idle",
};

function getDealTitle(deal: Deal): string {
  return deal.title?.trim() || deal.name?.trim() || `Deal ${deal.id}`;
}


function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Error occurred";
}

function buildTenderPackFilename(dealId: string): string {
  const normalizedDealId = dealId
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalizedDealId) {
    return "TenderPack.pdf";
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `TenderPack_${normalizedDealId}_${timestamp}.pdf`;
}

function getDownloadUrl(value: { downloadURL?: string; downloadUrl?: string }): string {
  return value.downloadURL?.trim() || value.downloadUrl?.trim() || "";
}

function createPdfBlobFromBase64(base64: string): Blob {
  const sanitizedBase64 = base64.trim();

  if (!sanitizedBase64) {
    throw new Error("Tender pack generation did not return a PDF.");
  }

  try {
    const binary = window.atob(sanitizedBase64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new Blob([bytes], { type: "application/pdf" });
  } catch {
    throw new Error("Unable to prepare tender pack PDF for download.");
  }
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = window.URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");

  downloadLink.href = objectUrl;
  downloadLink.download = filename;
  downloadLink.style.display = "none";

  try {
    document.body.appendChild(downloadLink);
    downloadLink.click();
  } finally {
    downloadLink.remove();
    window.setTimeout(() => {
      window.URL.revokeObjectURL(objectUrl);
    }, 1000);
  }
}

function openTenderPackUrl(downloadUrl: string): void {
  window.open(downloadUrl, "_blank", "noopener,noreferrer");
}

function normalizeDeals(payload: unknown): Deal[] {
  if (Array.isArray(payload)) {
    return payload as Deal[];
  }

  if (payload && typeof payload === "object") {
    const record = payload as { data?: unknown; deals?: unknown };

    if (Array.isArray(record.data)) {
      return record.data as Deal[];
    }

    if (Array.isArray(record.deals)) {
      return record.deals as Deal[];
    }
  }

  return [];
}

function normalizeContractorOptions(payload: unknown): ContractorOption[] {
  const source = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { contractors?: unknown[] }).contractors)
      ? (payload as { contractors: unknown[] }).contractors
      : [];

  return source
    .map((item) => {
      const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const id = typeof record.id === "string" ? record.id.trim() : typeof record.contractorId === "string" ? record.contractorId.trim() : "";
      const companyName =
        (typeof record.companyName === "string" && record.companyName.trim()) ||
        (typeof record.businessName === "string" && record.businessName.trim()) ||
        (typeof record.tradingName === "string" && record.tradingName.trim()) ||
        id;
      return { id, companyName };
    })
    .filter((item) => item.id.length > 0);
}

function getStatusClasses(tone: StatusTone): string {
  switch (tone) {
    case "loading":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "error":
      return "border-rose-200 bg-rose-50 text-rose-900";
    case "idle":
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getStatusDotClasses(tone: StatusTone): string {
  switch (tone) {
    case "loading":
      return "bg-amber-500";
    case "success":
      return "bg-emerald-500";
    case "error":
      return "bg-rose-500";
    case "idle":
    default:
      return "bg-slate-400";
  }
}

function getRiskBadgeClasses(riskLevel?: string): string {
  const normalized = riskLevel?.toLowerCase();

  if (normalized === "high") {
    return "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200";
  }

  if (normalized === "medium") {
    return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200";
  }

  return "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200";
}

function getWorkflowStepState(
  step: "upload" | "process" | "generate" | "output",
  complianceStatus: StatusState,
  tenderDocsStatus: StatusState,
  packStatus: StatusState
): "active" | "complete" | "idle" {
  if (step === "upload") {
    if (complianceStatus.tone === "loading" || tenderDocsStatus.tone === "loading") {
      return "active";
    }

    if (complianceStatus.tone === "success" || tenderDocsStatus.tone === "success") {
      return "complete";
    }

    return "idle";
  }

  if (step === "process") {
    if (
      complianceStatus.label === "Processing..." ||
      tenderDocsStatus.label === "Processing..."
    ) {
      return "active";
    }

    if (complianceStatus.tone === "success" || tenderDocsStatus.tone === "success") {
      return "complete";
    }

    return "idle";
  }

  if (step === "generate") {
    if (packStatus.tone === "loading") {
      return "active";
    }

    if (packStatus.tone === "success") {
      return "complete";
    }

    return "idle";
  }

  if (packStatus.tone === "success") {
    return "complete";
  }

  return "idle";
}

function getWorkflowStepClasses(state: "active" | "complete" | "idle"): string {
  if (state === "active") {
    return "border-sky-300 bg-sky-50 text-sky-900 shadow-sm";
  }

  if (state === "complete") {
    return "border-teal-300 bg-teal-50 text-teal-900";
  }

  return "border-slate-200 bg-white text-slate-600";
}

function getWorkflowBulletClasses(state: "active" | "complete" | "idle"): string {
  if (state === "active") {
    return "bg-[#0EA5E9]";
  }

  if (state === "complete") {
    return "bg-[#14B8A6]";
  }

  return "bg-slate-300";
}

export default function DealsPage() {
  const { role } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selectedContractor, setSelectedContractor] = useState<ContractorRecord | null>(null);
  const [contractors, setContractors] = useState<ContractorOption[]>([]);
  const [isLoadingContractors, setIsLoadingContractors] = useState(false);
  const [assignmentContractorId, setAssignmentContractorId] = useState("");
  const [isAssigningContractor, setIsAssigningContractor] = useState(false);
  const [assignmentStatus, setAssignmentStatus] = useState<StatusState | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string>("");
  const [pageLoading, setPageLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploadingCompliance, setIsUploadingCompliance] = useState(false);
  const [isUploadingTender, setIsUploadingTender] = useState(false);
  const [isGeneratingPack, setIsGeneratingPack] = useState(false);
  const [pageStatus, setPageStatus] = useState<StatusState>({
    label: "Loading...",
    detail: "Fetching deals.",
    tone: "loading",
  });
  const [complianceStatus, setComplianceStatus] = useState<StatusState>(DEFAULT_STATUS);
  const [tenderDocsStatus, setTenderDocsStatus] = useState<StatusState>(DEFAULT_STATUS);
  const [packStatus, setPackStatus] = useState<StatusState>(DEFAULT_STATUS);
  const [generatedTenderPack, setGeneratedTenderPack] = useState<GeneratedTenderPack | null>(null);
  const [complianceDocumentType, setComplianceDocumentType] = useState<SupportedDocumentType>("cipc");
  const complianceInputRef = useRef<HTMLInputElement | null>(null);
  const tenderInputRef = useRef<HTMLInputElement | null>(null);

  const selectedDeal = deals.find((deal) => deal.id === selectedDealId) ?? deals[0] ?? null;
  const canManageContractorLink = canManageDealContractorLink(role);
  const readinessMatch = selectedDeal && selectedContractor
    ? matchRequirements(selectedContractor, selectedDeal)
    : null;
  const contractorReady =
    selectedContractor?.complianceApproved === true ||
    (
      typeof selectedContractor?.docsMissing === "number" &&
      selectedContractor.docsMissing === 0 &&
      typeof selectedContractor.readinessScore === "number" &&
      selectedContractor.readinessScore >= 80 &&
      selectedContractor.isTenderLocked !== true
    );
  const canGeneratePack = Boolean(
    isDealContractorResolved(selectedDeal) &&
      contractorReady &&
      (readinessMatch?.ready ?? true)
  );
  const uploadState = getWorkflowStepState("upload", complianceStatus, tenderDocsStatus, packStatus);
  const processState = getWorkflowStepState("process", complianceStatus, tenderDocsStatus, packStatus);
  const generateState = getWorkflowStepState("generate", complianceStatus, tenderDocsStatus, packStatus);
  const outputState = getWorkflowStepState("output", complianceStatus, tenderDocsStatus, packStatus);

  async function loadSelectedContractor(contractorId: string) {
    const response = await authFetch(API_ROUTES.CONTRACTOR_DETAIL(contractorId));
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? `Failed to load contractor ${contractorId}`);
    }

    const payload = (await response.json()) as ContractorRecord & {
      success?: boolean;
      readinessScore?: unknown;
      docsMissing?: unknown;
      tenderLockStatus?: unknown;
      isTenderLocked?: unknown;
    };

    setSelectedContractor({
      id: payload.id,
      complianceApproved: payload.complianceApproved,
      readinessScore: typeof payload.readinessScore === "number" ? payload.readinessScore : undefined,
      docsMissing: typeof payload.docsMissing === "number" ? payload.docsMissing : undefined,
      tenderLockStatus:
        payload.tenderLockStatus === "READY" ||
        payload.tenderLockStatus === "RISK" ||
        payload.tenderLockStatus === "BLOCKED"
          ? payload.tenderLockStatus
          : undefined,
      isTenderLocked: payload.isTenderLocked === true,
      documents: payload.documents,
    });
  }

  async function loadData(showRefreshState = false) {
    if (showRefreshState) {
      setIsRefreshing(true);
    }

    setPageStatus({
      label: "Loading...",
      detail: "Fetching deals.",
      tone: "loading",
    });

    try {
      const dealsResponse = await authFetch(API_ROUTES.DEALS);
      const dealsPayload = await dealsResponse.json();
      const nextDeals = normalizeDeals(dealsPayload);

      setDeals(nextDeals);
      setSelectedDealId((currentSelectedDealId) => {
        if (currentSelectedDealId && nextDeals.some((deal) => deal.id === currentSelectedDealId)) {
          return currentSelectedDealId;
        }

        return nextDeals[0]?.id ?? "";
      });
      setPageStatus({
        label: "Loaded",
        detail: "Deals workflow is ready.",
        tone: "success",
      });
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Failed to load deals workflow:", error);
      setPageStatus({
        label: "Error occurred",
        detail: message,
        tone: "error",
      });
      alert(message);
    } finally {
      setPageLoading(false);
      setIsRefreshing(false);
    }
  }

  async function loadContractors() {
    if (!canManageContractorLink) {
      setContractors([]);
      return;
    }

    setIsLoadingContractors(true);

    try {
      const response = await authFetch(API_ROUTES.CONTRACTORS);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error ?? "Failed to load contractors.");
      }

      setContractors(normalizeContractorOptions(payload));
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Failed to load contractor assignment options:", error);
      setAssignmentStatus({
        label: "Error occurred",
        detail: message,
        tone: "error",
      });
    } finally {
      setIsLoadingContractors(false);
    }
  }

  async function assignSelectedContractor() {
    if (!selectedDeal) {
      return;
    }

    const nextContractorId = assignmentContractorId.trim();
    if (!nextContractorId) {
      setAssignmentStatus({
        label: "Error occurred",
        detail: "Select a contractor before linking this deal.",
        tone: "error",
      });
      return;
    }

    const currentContractorId = selectedDeal.contractorId?.trim() ?? "";
    if (currentContractorId === nextContractorId) {
      setAssignmentStatus({
        label: "Linked",
        detail: "This contractor is already linked to the selected deal.",
        tone: "success",
      });
      return;
    }

    if (currentContractorId && !window.confirm("Change the linked contractor for this deal?")) {
      return;
    }

    setIsAssigningContractor(true);
    setAssignmentStatus({
      label: "Linking...",
      detail: "Updating the opportunity execution workspace.",
      tone: "loading",
    });

    try {
      const response = await authFetch(
        `${API_ROUTES.OPPORTUNITY_REGISTER}/${encodeURIComponent(selectedDeal.id)}/execution`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildAssignContractorRequest(nextContractorId)),
        },
      );
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to link contractor.");
      }

      await loadData(true);
      await loadSelectedContractor(nextContractorId);
      setAssignmentStatus({
        label: "Linked",
        detail: "Contractor, compliance coverage, readiness, and workflow state refreshed.",
        tone: "success",
      });
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Contractor assignment failed:", error);
      setAssignmentStatus({
        label: "Error occurred",
        detail: message,
        tone: "error",
      });
    } finally {
      setIsAssigningContractor(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    void loadContractors();
  }, [canManageContractorLink]);

  useEffect(() => {
    setAssignmentContractorId(selectedDeal?.contractorId?.trim() ?? "");
    setAssignmentStatus(null);
  }, [selectedDeal?.id, selectedDeal?.contractorId]);

  useEffect(() => {
    async function hydrateSelectedContractor() {
      if (!selectedDeal?.contractorId?.trim()) {
        setSelectedContractor(null);
        return;
      }

      try {
        await loadSelectedContractor((selectedDeal.contractorId as string));
      } catch (error) {
        console.error("Failed to load contractor readiness data:", error);
        setSelectedContractor(null);
      }
    }

    void hydrateSelectedContractor();
  }, [selectedDeal?.contractorId]);

  function openFilePicker(kind: UploadKind) {
    if (kind === "compliance") {
      complianceInputRef.current?.click();
      return;
    }

    tenderInputRef.current?.click();
  }

  async function uploadDocument(kind: UploadKind, file: File) {
    if (!selectedDeal) {
      const message = "Select a deal before uploading documents.";
      const nextStatus = {
        label: "Error occurred",
        detail: message,
        tone: "error" as const,
      };

      if (kind === "compliance") {
        setComplianceStatus(nextStatus);
      } else {
        setTenderDocsStatus(nextStatus);
      }

      alert(message);
      return;
    }

    const setBusy = kind === "compliance" ? setIsUploadingCompliance : setIsUploadingTender;
    const setStatus = kind === "compliance" ? setComplianceStatus : setTenderDocsStatus;
    const label = kind === "compliance" ? "Compliance" : "Tender";

    setBusy(true);
    setStatus({
      label: "Uploading...",
      detail: `${label} document upload started for ${getDealTitle(selectedDeal)}.`,
      tone: "loading",
    });

    try {
      const formData = new FormData();
      formData.append("file", file);
      let endpoint: string = API_ROUTES.DOCUMENT_UPLOAD_ANALYZE;

      if (kind === "compliance") {
        if (!(selectedDeal.contractorId as string)?.trim()) {
          throw new Error("A valid contractor must be linked before uploading compliance documents.");
        }

        formData.append("contractorId", (selectedDeal.contractorId as string));
        formData.append("documentType", complianceDocumentType);
        endpoint = API_ROUTES.DOCUMENT_UPLOAD;
      } else {
        formData.append("dealId", selectedDeal.id);

        if ((selectedDeal.contractorId as string)?.trim()) {
          formData.append("contractorId", (selectedDeal.contractorId as string));
        }
      }

      const response = await authFetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `${label} upload failed`);
      }

      setStatus({
        label: "Processing...",
        detail: `${label} document uploaded. Backend analysis is running.`,
        tone: "loading",
      });

      await response.json();
      await loadData(true);
      if ((selectedDeal.contractorId as string)) {
        await loadSelectedContractor((selectedDeal.contractorId as string));
      }

      setStatus({
        label: "Processed",
        detail: `${label} document uploaded and processed successfully.`,
        tone: "success",
      });
      alert(`${label} document uploaded successfully`);
    } catch (error) {
      const message = getErrorMessage(error);
      console.error(`${label} upload failed:`, error);
      setStatus({
        label: "Error occurred",
        detail: message,
        tone: "error",
      });
      alert(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleFileSelection(kind: UploadKind, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    await uploadDocument(kind, file);
  }

  async function generatePack() {
    if (!selectedDeal) {
      const message = "Select a deal before generating a tender pack.";
      setPackStatus({
        label: "Error occurred",
        detail: message,
        tone: "error",
      });
      alert(message);
      return;
    }

    if (!(selectedDeal.contractorId as string)) {
      const message = "Generate Pack is disabled until a contractor is linked to the selected deal.";
      setPackStatus({
        label: "Error occurred",
        detail: message,
        tone: "error",
      });
      alert(message);
      return;
    }

    setIsGeneratingPack(true);
    setGeneratedTenderPack(null);
    setPackStatus({
      label: "Processing...",
      detail: `Generating tender pack for ${getDealTitle(selectedDeal)}.`,
      tone: "loading",
    });

    try {
      const response = await authFetch(API_ROUTES.TENDER_GENERATE, {
        method: "POST",
        body: JSON.stringify({
          dealId: selectedDeal.id,
          contractorId: (selectedDeal.contractorId as string),
        }),
      });

      const data = (await response.json()) as {
        base64?: string;
        downloadURL?: string;
        downloadUrl?: string;
        fileName?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Tender pack generation failed.");
      }

      const downloadUrl = getDownloadUrl(data);
      const fileName = data.fileName?.trim() || buildTenderPackFilename(selectedDeal.id);

      if (downloadUrl) {
        setGeneratedTenderPack({
          url: downloadUrl,
        });
        openTenderPackUrl(downloadUrl);
      } else if (data.base64) {
        const pdfBlob = createPdfBlobFromBase64(data.base64);
        triggerBlobDownload(pdfBlob, fileName);
      } else {
        throw new Error(data.error || "Tender pack generation did not return a downloadable PDF.");
      }

      setPackStatus({
        label: "Pack Generated",
        detail: downloadUrl
          ? "Tender pack generated successfully and the artifact download is ready."
          : "Tender pack generated successfully and the PDF download has started.",
        tone: "success",
      });
      alert("Tender pack generated successfully");
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Tender pack generation failed:", error);
      setPackStatus({
        label: "Error occurred",
        detail: message,
        tone: "error",
      });
      alert(message);
    } finally {
      setIsGeneratingPack(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center bg-[#F5F7FA] px-6 text-slate-700">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-6 text-sm shadow-sm">
          Loading workflow...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F5F7FA] text-slate-900">
      <input
        ref={complianceInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          void handleFileSelection("compliance", event);
        }}
      />

      <input
        ref={tenderInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          void handleFileSelection("supporting", event);
        }}
      />

      <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-[#F8FBFD] lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col p-6">
            <div className="rounded-3xl bg-gradient-to-br from-sky-500 to-teal-500 p-[1px]">
              <div className="rounded-[calc(1.5rem-1px)] bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600">
                  CRM
                </p>
                <h1 className="mt-3 text-2xl font-semibold text-slate-900">Deals Hub</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Light workflow dashboard for tender operations and output tracking.
                </p>
              </div>
            </div>

            <nav className="mt-8 space-y-2">
              {["Overview", "Workflow Engine", "Results", "Deals Table"].map((item, index) => (
                <div
                  key={item}
                  className={`rounded-2xl px-4 py-3 text-sm font-medium ${
                    index === 1
                      ? "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200"
                      : "text-slate-600"
                  }`}
                >
                  {item}
                </div>
              ))}
            </nav>

            <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Active Deal
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-900">
                {selectedDeal ? getDealTitle(selectedDeal) : "No deal selected"}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {getDealContractorDisplayName(selectedDeal)}
              </p>
            </div>

            <Link
              href="/dashboard/governance"
              className="mt-8 block rounded-3xl border border-sky-100 bg-sky-50 p-5 shadow-sm transition hover:border-sky-200 hover:bg-sky-100"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600">
                Governance
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-900">
                Open Governance Console
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Review passive alerts, route pressure, and executive governance visibility for current operations.
              </p>
            </Link>

            <div className="mt-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Workflow Path
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${getWorkflowBulletClasses(uploadState)}`} />
                  <span>Upload</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${getWorkflowBulletClasses(processState)}`} />
                  <span>Process</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${getWorkflowBulletClasses(generateState)}`} />
                  <span>Generate</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${getWorkflowBulletClasses(outputState)}`} />
                  <span>Output</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="border-b border-slate-200 bg-white">
            <div className="flex flex-col gap-4 px-5 py-5 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Tender Workflow
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  Professional Deals Dashboard
                </h2>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-[260px]">
                  <label htmlFor="deal-select" className="mb-2 block text-sm font-medium text-slate-600">
                    Active deal
                  </label>
                  <select
                    id="deal-select"
                    value={selectedDeal?.id ?? ""}
                    onChange={(event) => setSelectedDealId(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  >
                    {deals.length === 0 && <option value="">No deals available</option>}
                    {deals.map((deal) => (
                      <option key={deal.id} value={deal.id}>
                        {getDealTitle(deal)}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void loadData(true);
                  }}
                  disabled={isRefreshing}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
          </header>
          <main className="p-5 sm:p-6">
            <div className="space-y-6">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Total Deals</p>
                  <p className="mt-4 text-3xl font-semibold text-slate-900">{deals.length}</p>
                  <p className="mt-2 text-sm text-slate-500">Tracked in the current workflow view.</p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Selected Deal</p>
                  <p className="mt-4 text-lg font-semibold text-slate-900">
                    {selectedDeal ? getDealTitle(selectedDeal) : "No deal selected"}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Status: {selectedDeal?.status || "Unknown"}
                  </p>
                </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Readiness</p>
                    <p className="mt-4 text-3xl font-semibold text-slate-900">
                    {readinessMatch?.score ?? selectedDeal?.readinessScore ?? 0}%
                    </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {selectedContractor?.complianceApproved
                      ? "Current tender readiness score."
                      : "Awaiting contractor readiness and approval."}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Risk Level</p>
                  <div className="mt-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${getRiskBadgeClasses(selectedDeal?.riskLevel)}`}>
                      {selectedDeal?.riskLevel || "Unknown"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">Operational signal from the selected deal.</p>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-6">
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                          Workflow Engine
                        </p>
                        <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                          Upload Process Generate Output
                        </h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                          Run document intake, backend processing, tender pack generation, and output review from one center workspace.
                        </p>
                      </div>

                      <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-800 ring-1 ring-inset ring-sky-200">
                        <p className="font-semibold">Contractor Link: {getDealContractorDisplayName(selectedDeal)}</p>
                        {canManageContractorLink && selectedDeal ? (
                          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                            <select
                              value={assignmentContractorId}
                              onChange={(event) => setAssignmentContractorId(event.target.value)}
                              disabled={isLoadingContractors || isAssigningContractor}
                              className="min-h-11 rounded-2xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                              aria-label="Select contractor to link"
                            >
                              <option value="">{isLoadingContractors ? "Loading contractors..." : "Select contractor"}</option>
                              {contractors.map((contractor) => (
                                <option key={contractor.id} value={contractor.id}>
                                  {contractor.companyName}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                void assignSelectedContractor();
                              }}
                              disabled={isLoadingContractors || isAssigningContractor || !assignmentContractorId.trim()}
                              className="min-h-11 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              {isAssigningContractor ? "Linking..." : getContractorLinkActionLabel(selectedDeal.contractorId)}
                            </button>
                          </div>
                        ) : null}
                        {assignmentStatus ? (
                          <p className={`mt-2 text-xs ${assignmentStatus.tone === "error" ? "text-rose-700" : assignmentStatus.tone === "success" ? "text-emerald-700" : "text-slate-600"}`}>
                            {assignmentStatus.detail}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
                      {[
                        {
                          title: "Upload",
                          subtitle: "Compliance and tender documents",
                          state: uploadState,
                        },
                        {
                          title: "Process",
                          subtitle: "Analysis and validation",
                          state: processState,
                        },
                        {
                          title: "Generate",
                          subtitle: "Build tender pack",
                          state: generateState,
                        },
                        {
                          title: "Output",
                          subtitle: "Download generated PDF",
                          state: outputState,
                        },
                      ].map((step, index) => (
                        <div key={step.title} className="relative">
                          <div className={`rounded-3xl border p-5 ${getWorkflowStepClasses(step.state)}`}>
                            <div className="flex items-center gap-3">
                              <span className={`h-3 w-3 rounded-full ${getWorkflowBulletClasses(step.state)}`} />
                              <p className="text-sm font-semibold">
                                {String(index + 1).padStart(2, "0")} {step.title}
                              </p>
                            </div>
                            <p className="mt-3 text-sm leading-6 opacity-80">{step.subtitle}</p>
                          </div>
                          {index < 3 && (
                            <div className="absolute -right-2 top-1/2 hidden h-0.5 w-4 -translate-y-1/2 bg-slate-200 lg:block" />
                          )}
                        </div>
                      ))}
                    </div>

                    {selectedDeal ? (
                      <div className="mt-6 grid gap-4 md:grid-cols-3">
                        <div className="grid gap-3">
                          <select
                            value={complianceDocumentType}
                            onChange={(event) => setComplianceDocumentType(event.target.value as SupportedDocumentType)}
                            disabled={isUploadingCompliance}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"
                          >
                            {SUPPORTED_DOCUMENT_TYPES.map((documentType) => (
                              <option key={documentType} value={documentType}>
                                {getDocumentTypeLabel(documentType)}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => openFilePicker("compliance")}
                            disabled={isUploadingCompliance}
                            className="rounded-3xl bg-[#0EA5E9] px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            {isUploadingCompliance ? "Uploading..." : "Upload Compliance Docs"}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => openFilePicker("supporting")}
                          disabled={isUploadingTender}
                          className="rounded-3xl bg-[#14B8A6] px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {isUploadingTender ? "Uploading..." : "Upload Tender Docs"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            void generatePack();
                          }}
                          disabled={!canGeneratePack || isGeneratingPack}
                          title={
                            canGeneratePack
                              ? "Generate Tender Pack"
                              : "Link a contractor to this deal before generating the pack."
                          }
                          className="rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {isGeneratingPack ? "Processing..." : "Generate Tender Pack"}
                        </button>
                      </div>
                    ) : null}

                    {!selectedDeal ? (
                      <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                        No deals found. Add or load a deal to start the workflow.
                      </div>
                    ) : null}

                    {!canGeneratePack && selectedDeal ? (
                      <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                        {selectedDeal.contractorReferenceResolution?.status === "unresolved"
                          ? "Linked contractor record could not be resolved."
                          : isDealContractorResolved(selectedDeal)
                            ? selectedContractor?.complianceApproved
                              ? "Generate Pack is disabled until contractor requirements are valid for this tender."
                              : "Generate Pack is disabled until contractor compliance is approved."
                            : "Generate Pack is disabled because this deal has no linked contractor."}
                      </div>
                    ) : null}

                    {selectedDeal && selectedDeal.contractorReferenceResolution?.status === "unresolved" ? (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                        <p className="font-semibold">Linked contractor record could not be resolved.</p>
                        <p className="mt-1">Administrator repair is required before contractor actions can continue.</p>
                      </div>
                    ) : !isDealContractorResolved(selectedDeal) && selectedDeal ? (
                      <div className="mt-4 text-sm text-red-600">
                        This deal is not linked to a contractor. Actions are restricted.
                      </div>
                    ) : null}

                    {selectedDeal && Array.isArray(selectedDeal.missingDocs) && selectedDeal.missingDocs.length > 0 ? (
                      <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
                        <p className="text-sm font-semibold text-amber-900">Missing Docs</p>
                        <p className="mt-2 text-sm leading-6 text-amber-800">
                          {selectedDeal.missingDocs.join(", ")}
                        </p>
                      </div>
                    ) : null}

                    {readinessMatch ? (
                      <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
                        <p className="text-sm font-semibold text-slate-900">Tender Requirement Match</p>
                        <p className="mt-2 text-sm text-slate-700">Readiness: {readinessMatch.score}%</p>
                        <p className="mt-2 text-sm text-slate-700">
                          Risk Level:{" "}
                          <span
                            className={
                              readinessMatch.riskLevel === "LOW"
                                ? "text-green-600"
                                : readinessMatch.riskLevel === "MEDIUM"
                                ? "text-yellow-600"
                                : "text-red-600"
                            }
                          >
                            {readinessMatch.riskLevel}
                          </span>
                        </p>
                        <p className="mt-2 text-sm text-gray-600">
                          {readinessMatch.recommendation}
                        </p>
                        {readinessMatch.fixSuggestions?.length > 0 && (
                          <div className="mt-3">
                            <p className="font-semibold text-sm">Fix Suggestions:</p>
                            <ul className="text-sm text-gray-600">
                              {readinessMatch.fixSuggestions.map((s: string, i: number) => (
                                <li key={i}>- {s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {readinessMatch.missing.length > 0 ? (
                          <p className="mt-2 text-sm text-red-500">
                            Missing: {readinessMatch.missing.join(", ")}
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-emerald-600">All core compliance requirements are valid.</p>
                        )}
                      </div>
                    ) : null}

                    {selectedDeal && Array.isArray(selectedDeal.suggestions) && selectedDeal.suggestions.length > 0 ? (
                      <div className="mt-4 rounded-3xl border border-sky-200 bg-sky-50 p-5">
                        <p className="text-sm font-semibold text-sky-900">System Suggestions</p>
                        <p className="mt-2 text-sm leading-6 text-sky-800">
                          {selectedDeal.suggestions.join(" | ")}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                          Deals Table
                        </p>
                        <h3 className="mt-2 text-xl font-semibold text-slate-900">All Deals</h3>
                      </div>
                      <div className="text-sm text-slate-500">{deals.length} records</div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            <th className="px-6 py-4">Deal</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Readiness</th>
                            <th className="px-6 py-4">Risk</th>
                            <th className="px-6 py-4">Contractor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {deals.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-8 text-sm text-slate-500">
                                No deals available.
                              </td>
                            </tr>
                          ) : (
                            deals.map((deal) => {
                              const isSelected = selectedDeal?.id === deal.id;

                              return (
                                <tr
                                  key={deal.id}
                                  className={`cursor-pointer transition hover:bg-sky-50 ${
                                    isSelected ? "bg-sky-50/80" : ""
                                  }`}
                                  onClick={() => setSelectedDealId(deal.id)}
                                >
                                  <td className="px-6 py-4">
                                    <div>
                                      <p className="font-medium text-slate-900">{getDealTitle(deal)}</p>
                                      <p className="mt-1 text-xs text-slate-500">ID: {deal.id}</p>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-slate-600">{deal.status || "Unknown"}</td>
                                  <td className="px-6 py-4 text-sm text-slate-600">
                                    {deal.readinessScore ?? 0}%
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getRiskBadgeClasses(deal.riskLevel)}`}>
                                      {deal.riskLevel || "Unknown"}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-slate-600">
                                    <div className="space-y-1">
                                      {deal.contractorReferenceResolution?.status === "unresolved" ? (
                                        <>
                                          <p className="text-sm font-medium text-rose-700">Linked contractor record could not be resolved.</p>
                                          <p className="text-xs text-slate-500">Administrator repair required</p>
                                        </>
                                      ) : deal.contractorId?.trim() ? (
                                        <Link
                                          href={`/dashboard/contractors/${encodeURIComponent(deal.contractorId.trim())}`}
                                          className="text-sm font-medium text-sky-700 hover:text-sky-900"
                                          onClick={(event) => event.stopPropagation()}
                                        >
                                          {getDealContractorDisplayName(deal)}
                                        </Link>
                                      ) : (
                                        <p className="text-sm font-medium text-slate-900">Not linked</p>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <aside className="space-y-4">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Results Panel
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">Live Status</h3>
                  </div>

                  <div className={`rounded-3xl border p-5 shadow-sm ${getStatusClasses(pageStatus.tone)}`}>
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${getStatusDotClasses(pageStatus.tone)}`} />
                      <p className="text-sm font-semibold">Workflow Status</p>
                    </div>
                    <p className="mt-4 text-base font-semibold">{pageStatus.label}</p>
                    <p className="mt-2 text-sm leading-6 opacity-90">{pageStatus.detail}</p>
                  </div>

                  <div className={`rounded-3xl border p-5 shadow-sm ${getStatusClasses(complianceStatus.tone)}`}>
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${getStatusDotClasses(complianceStatus.tone)}`} />
                      <p className="text-sm font-semibold">Compliance Docs</p>
                    </div>
                    <p className="mt-4 text-base font-semibold">{complianceStatus.label}</p>
                    <p className="mt-2 text-sm leading-6 opacity-90">{complianceStatus.detail}</p>
                  </div>

                  <div className={`rounded-3xl border p-5 shadow-sm ${getStatusClasses(tenderDocsStatus.tone)}`}>
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${getStatusDotClasses(tenderDocsStatus.tone)}`} />
                      <p className="text-sm font-semibold">Tender Docs</p>
                    </div>
                    <p className="mt-4 text-base font-semibold">{tenderDocsStatus.label}</p>
                    <p className="mt-2 text-sm leading-6 opacity-90">{tenderDocsStatus.detail}</p>
                  </div>

                  <div className={`rounded-3xl border p-5 shadow-sm ${getStatusClasses(packStatus.tone)}`}>
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${getStatusDotClasses(packStatus.tone)}`} />
                      <p className="text-sm font-semibold">Pack Status</p>
                    </div>
                    <p className="mt-4 text-base font-semibold">{packStatus.label}</p>
                    <p className="mt-2 text-sm leading-6 opacity-90">{packStatus.detail}</p>
                    {generatedTenderPack ? (
                      <a
                        href={generatedTenderPack.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-4 inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50"
                      >
                        View Tender Pack
                      </a>
                    ) : null}
                  </div>
                </aside>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
