"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ContractorBusinessIdCard from "@/components/contractors/ContractorBusinessIdCard";
import UploadDocumentModal from "@/components/modals/UploadDocumentModal";
import { useAuth } from "@/context/AuthContext";
import { API_ROUTES } from "@/lib/apiRoutes";
import { authFetch } from "@/lib/client/authFetch";
import type { ContractorTenderSummary } from "@/types/deal";
import type { ContractorDocument } from "@/types/document";
import type { ContractorTimelineItem } from "@/types/intelligenceCenter";

type ContractorRecord = {
  id?: string;
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

type OnboardingPayload = {
  contractor: ContractorRecord;
  documents: ContractorDocument[];
  notes: ContractorNote[];
  commandNotes: ContractorCommandNote[];
  timeline: ContractorTimelineItem[];
  lastAction: ContractorLastAction | null;
  linkedDeals: LinkedDeal[];
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
  { key: "csd", title: "CSD Documents", matches: ["csd", "csdmnumber"], uploadType: "coida", uploadLabel: "CSD" },
  { key: "bbbee", title: "B-BBEE", matches: ["bbbee", "bbee"], uploadType: "bbbee", uploadLabel: "BBBEE" },
  { key: "coida", title: "COIDA", matches: ["coida"], uploadType: "coida", uploadLabel: "COIDA" },
  { key: "bank", title: "Bank Confirmation", matches: ["bank", "bankconfirmation", "bankletter"], uploadType: "bankConfirmation", uploadLabel: "Bank Confirmation" },
  { key: "cidb", title: "CIDB", matches: ["cidb"] },
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
  if (document.validationStatus === "REVIEW" || document.manualDecisionAvailable) return "Pending Review";
  return clean(document.status) || (document.fileUrl ? "Uploaded" : "Missing");
}

function documentStatusClasses(document: ContractorDocument): string {
  if (document.verificationStatus === "VERIFIED_MANUAL") return "border-sky-200 bg-sky-50 text-sky-700";
  if (document.verificationStatus === "REJECTED_MANUAL" || document.validationStatus === "FAIL") return "border-rose-200 bg-rose-50 text-rose-700";
  if (document.verified || document.validationStatus === "PASS") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
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
    return status === "missing" || Boolean(document.reviewReason || document.validationError);
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

    setLoading(true);
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

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-6">
        {error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {error}
          </div>
        ) : null}

        <ContractorBusinessIdCard
          contractorId={contractorId}
          companyName={companyName}
          taxNumber={payload.contractor.taxPin ?? payload.contractor.taxNumber ?? payload.contractor.taxReferenceNumber}
          csdNumber={payload.contractor.csdNumber ?? payload.contractor.csdMNumber ?? payload.contractor.mNumber}
          onboardedAt={payload.contractor.createdAt}
          status={payload.contractor.status}
          lastDocumentUpdateAt={lastDocumentUpdateAt}
          logoUrl={payload.contractor.logoUrl ?? payload.contractor.businessLogoUrl}
          href={`/dashboard/contractors/${encodeURIComponent(contractorId)}`}
        />

        {payload.lastAction ? <LastActionBanner action={payload.lastAction} /> : null}

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

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {groupedDocuments.grouped.map((group) => {
                  const firstDocument = group.documents[0];
                  const uploadTarget = resolveUploadTarget(group, firstDocument);
                  return (
                    <div key={group.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-semibold text-slate-900">{group.title}</h2>
                          <p className="mt-1 text-sm text-slate-600">
                            {group.documents.length ? `${group.documents.length} record(s)` : "No file on record"}
                          </p>
                        </div>
                        {canUpload && uploadTarget ? (
                          <button
                            type="button"
                            onClick={() => openUpload(uploadTarget.documentType, uploadTarget.displayLabel)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Upload
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-4 space-y-3">
                        {group.documents.length ? (
                          group.documents.map((document) => (
                            <DocumentRow key={document.id} contractorId={contractorId} document={document} onUpdated={loadOnboarding} canReview={payload.viewer.isPrivileged} />
                          ))
                        ) : (
                          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500">
                            Awaiting {group.title.toLowerCase()}.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {groupedDocuments.uncategorized.length ? (
                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                  <h2 className="font-semibold text-slate-900">Other Contractor-Uploaded Documents</h2>
                  <div className="mt-3 divide-y divide-slate-100">
                    {groupedDocuments.uncategorized.map((document) => (
                      <DocumentRow key={document.id} contractorId={contractorId} document={document} onUpdated={loadOnboarding} canReview={payload.viewer.isPrivileged} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <LinkedDealsPanel deals={payload.linkedDeals} />
            <ContractorTimelinePanel timeline={payload.timeline} />
          </div>

          <aside className="space-y-6">
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

type ContractorDocumentViewUrlResponse = {
  success?: boolean;
  url?: string;
  error?: string;
};

function buildDocumentViewRequestUrl(fileUrl: string): string {
  const separator = fileUrl.includes("?") ? "&" : "?";
  return `${fileUrl}${separator}format=json`;
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
}: {
  contractorId: string;
  document: ContractorDocument;
  onUpdated: () => Promise<void>;
  canReview: boolean;
}) {
  const [isOpening, setIsOpening] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [reprocessStatus, setReprocessStatus] = useState<string | null>(null);

  async function openDocument() {
    if (!document.fileUrl || isOpening) {
      return;
    }

    const popup = window.open("about:blank", "_blank");
    if (popup) {
      popup.opener = null;
    }
    setIsOpening(true);
    setOpenError(null);

    try {
      const response = await authFetch(buildDocumentViewRequestUrl(document.fileUrl), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as ContractorDocumentViewUrlResponse | null;

      if (!response.ok || payload?.success !== true || !payload.url) {
        throw new Error(payload?.error ?? `Unable to open document (${response.status})`);
      }

      if (popup) {
        popup.location.href = payload.url;
      } else {
        window.open(payload.url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      if (popup) {
        popup.close();
      }
      setOpenError(error instanceof Error ? error.message : "Unable to open document.");
    } finally {
      setIsOpening(false);
    }
  }

  async function reprocessDocument() {
    const documentType = clean(document.documentType) || clean(document.docType) || clean(document.id);
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

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">{documentLabel(document)}</p>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${documentStatusClasses(document)}`}>
            {documentStatus(document)}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {document.updatedAt ? `Updated ${formatDate(document.updatedAt)}` : "No update timestamp"}
        </p>
        {document.fileUrl ? (
          <div className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
            <span>Extraction Source: {document.extractionSource ?? "Not recorded"}</span>
            <span>Text Length: {document.extractedTextLength ?? 0} chars</span>
            <span>OCR Length: {document.ocrTextLength ?? 0} chars</span>
            <span>Last Analysis Time: {formatDate(document.analysisTimestamp)}</span>
          </div>
        ) : null}
        {openError ? <p className="mt-1 text-xs font-medium text-rose-600">{openError}</p> : null}
        {reprocessStatus ? <p className="mt-1 text-xs font-medium text-slate-600">{reprocessStatus}</p> : null}
      </div>
      {document.fileUrl ? (
        <div className="flex shrink-0 flex-wrap gap-2">
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
          {canReview ? (
            <>
              <button
                type="button"
                onClick={() => applyManualDecision("approve")}
                disabled={isReviewing}
                className="inline-flex justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-60"
              >
                {isReviewing ? "Saving..." : "Approve"}
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
      ) : null}
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
