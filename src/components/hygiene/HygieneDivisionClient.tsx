"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  EnterpriseActionButton as SmallAction,
  EnterpriseEmptyState as EmptyState,
  EnterpriseKpiCard as KpiCard,
  EnterprisePanel as Panel,
  EnterpriseStatusBadge as StatusBadge,
  enterpriseActionLinkClass,
} from "@/components/ui/EnterpriseUI";
import { API_ROUTES } from "@/lib/apiRoutes";
import { authFetch } from "@/lib/client/authFetch";
import { useAuth } from "@/context/AuthContext";
import { teosDesignTokens } from "@/lib/design/teosDesignTokens";
import {
  HYGIENE_PHOTO_CATEGORIES,
  type HygieneCollection,
  type HygieneDashboardData,
  type HygieneManifest,
  type HygienePhotoCategory,
  type HygieneRecordClassification,
} from "@/types/hygiene";

type HygieneView =
  | "home"
  | "clients"
  | "sites"
  | "collections"
  | "manifests"
  | "assets"
  | "evidence"
  | "compliance"
  | "reports"
  | "jobs";

const navItems: Array<{ view: HygieneView; href: string; label: string }> = [
  { view: "home", href: "/dashboard/hygiene", label: "Overview" },
  { view: "clients", href: "/dashboard/hygiene/clients", label: "Clients" },
  { view: "sites", href: "/dashboard/hygiene/sites", label: "Sites" },
  { view: "collections", href: "/dashboard/hygiene/collections", label: "Collections" },
  { view: "manifests", href: "/dashboard/hygiene/manifests", label: "Manifests" },
  { view: "assets", href: "/dashboard/hygiene/assets", label: "Assets" },
  { view: "evidence", href: "/dashboard/hygiene/evidence", label: "Evidence" },
  { view: "compliance", href: "/dashboard/hygiene/compliance", label: "Compliance" },
  { view: "reports", href: "/dashboard/hygiene/reports", label: "Reports" },
  { view: "jobs", href: "/dashboard/hygiene/jobs", label: "Driver App" },
];

type ModalKind =
  | "client"
  | "site"
  | "collection"
  | "backup"
  | "asset"
  | "manifest"
  | "compliance"
  | "report"
  | "evidence";

type ActionModalState = {
  kind: ModalKind;
  title: string;
  defaults?: Record<string, unknown>;
} | null;

const COMPLIANCE_DOC_TYPES = [
  "COIDA",
  "Waste Transport Registration GPT-15-858",
  "Driver Licence",
  "Vehicle Licence",
  "Public Liability Insurance",
  "Service Agreement",
  "Signed Quotation",
  "SLA",
  "Disposal Certificates",
];

const BACKUP_NOTE =
  "Backup transport used for this CBAVO collection due to primary vehicle unavailability. Collection authorised by Torque Empire management.";
const tokens = teosDesignTokens;
const hygieneThemeStyle = {
  "--hygiene-primary": tokens.color.secondary[600],
  "--hygiene-primary-strong": tokens.color.secondary[700],
  "--hygiene-info": tokens.color.info[600],
  "--hygiene-success": tokens.color.success[600],
  "--hygiene-warning": tokens.color.warning[600],
  "--hygiene-danger": tokens.color.danger[600],
  "--hygiene-neutral": tokens.color.neutral[500],
  "--hygiene-surface": "rgba(2, 6, 23, 0.64)",
  "--hygiene-surface-muted": "rgba(15, 23, 42, 0.72)",
  "--hygiene-border": "rgba(226, 232, 240, 0.22)",
  "--hygiene-text-muted": tokens.color.neutral[200],
  "--hygiene-text-subtle": tokens.color.neutral[100],
} as CSSProperties;

const primaryButtonClass = "tex-action-button";
const secondaryButtonClass = "tex-action-button tex-action-button--secondary";
const smallLinkClass = enterpriseActionLinkClass;

function currency(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Pending confirmation";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(date);
}

function LoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
      ))}
    </div>
  );
}

function DataTable({
  headers,
  rows,
  emptyLabel,
}: {
  headers: string[];
  rows: ReactNode[][];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={`No ${emptyLabel}`} detail="No records are available for this hygiene register yet." />;
  }

  return (
    <div className="-m-5 overflow-x-auto">
      <table className="min-w-full divide-y divide-white/15 text-[13px]">
        <thead className="bg-slate-950/80 text-left text-[11px] uppercase tracking-[0.08em] text-slate-200">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-bold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/15">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="align-top transition hover:bg-white/[0.04]">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3.5 leading-5 text-slate-100">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrimaryCell({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-white">{title}</p>
      {subtitle ? <p className="mt-1 truncate text-[11px] leading-4 text-slate-300">{subtitle}</p> : null}
    </div>
  );
}

function MiniBarChart({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number; tone?: "success" | "warning" | "danger" | "info" | "neutral" }>;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <Panel title={title} eyebrow="Executive dashboard">
      <div className="grid gap-3">
        {items.map((item) => (
          <div key={item.label} className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-slate-200">{item.label}</span>
              <StatusBadge value={item.value} tone={item.tone ?? "neutral"} />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-950/55">
              <div className="h-full rounded-full bg-[color:var(--hygiene-primary)]" style={{ width: `${Math.max(8, Math.round((item.value / max) * 100))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function BoardCard({
  title,
  subtitle,
  status,
  meta,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  status?: ReactNode;
  meta?: Array<{ label: string; value: ReactNode }>;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="rounded-xl border border-[color:var(--hygiene-border)] bg-slate-950/35 p-4 shadow-sm transition hover:bg-slate-950/45">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-white">{title}</h3>
          {subtitle ? <div className="mt-1 text-xs leading-5 text-slate-300">{subtitle}</div> : null}
        </div>
        {status ? <div className="shrink-0">{status}</div> : null}
      </div>
      {meta?.length ? (
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          {meta.map((item) => (
            <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
              <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{item.label}</dt>
              <dd className="mt-1 min-w-0 text-sm font-semibold text-slate-100">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </article>
  );
}

function ProgressBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-950/60" aria-label={`${width}% complete`}>
      <div className="h-full rounded-full bg-[color:var(--hygiene-primary)]" style={{ width: `${width}%` }} />
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  children,
}: {
  name: string;
  label: string;
  defaultValue?: unknown;
  type?: string;
  children?: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm text-slate-300">
      <span className="font-semibold text-slate-200">{label}</span>
      {children ?? (
        <input
          name={name}
          type={type}
          defaultValue={typeof defaultValue === "number" ? defaultValue : typeof defaultValue === "string" ? defaultValue : ""}
          className="rounded-xl border border-white/20 bg-slate-950/80 px-3 py-2 text-white outline-none focus:border-teal-200/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-200"
        />
      )}
    </label>
  );
}

function SelectField({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue?: unknown;
  options: string[];
}) {
  return (
    <Field name={name} label={label}>
      <select name={name} defaultValue={typeof defaultValue === "string" ? defaultValue : options[0] ?? ""} className="rounded-xl border border-white/20 bg-slate-950/80 px-3 py-2 text-white outline-none focus:border-teal-200/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-200">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </Field>
  );
}

function WorkflowCard({ collection }: { collection: HygieneCollection }) {
  const completedSteps = collection.workflowSteps.filter((step) => step.status === "Completed").length;
  const progress = Math.round((completedSteps / Math.max(1, collection.workflowSteps.length)) * 100);

  return (
    <BoardCard
      title={collection.collectionId}
      subtitle={`${formatDate(collection.scheduledDate)} | ${collection.scheduledTimeWindow}`}
      status={<StatusBadge value={collection.status} />}
      meta={[
        { label: "Driver", value: collection.assignedDriver },
        { label: "Vehicle", value: collection.vehicleRegistration },
        { label: "Progress", value: `${completedSteps}/${collection.workflowSteps.length} steps` },
        { label: "Signature", value: collection.clientSignatureStatus },
      ]}
    >
      <ProgressBar value={progress} />
      <ol className="mt-4 grid gap-2">
        {collection.workflowSteps.map((step, index) => (
          <li key={step.stepId} className="grid grid-cols-[24px_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-bold text-slate-200">{index + 1}</span>
            <span className="min-w-0 truncate text-xs font-semibold text-slate-200">{step.label}</span>
            <StatusBadge value={step.status} />
          </li>
        ))}
      </ol>
    </BoardCard>
  );
}

function DisposalWarningCell({ manifest }: { manifest: HygieneManifest }) {
  const hasPendingCertificate = manifest.status === "Disposal Pending" || /pending/i.test(manifest.disposalCertificateNo);
  const hasMissingFacility = /not yet captured|pending/i.test(manifest.disposalFacility);

  return (
    <div className="space-y-2">
      <PrimaryCell title={manifest.disposalFacility} subtitle={`Certificate ${manifest.disposalCertificateNo}`} />
      {hasMissingFacility ? <StatusBadge value="Compliance Warning" /> : null}
      {hasPendingCertificate ? <StatusBadge value="Disposal Pending" /> : null}
    </div>
  );
}

export default function HygieneDivisionClient({ view }: { view: HygieneView }) {
  const { role, loading: authLoading } = useAuth();
  const [data, setData] = useState<HygieneDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [mutationStatus, setMutationStatus] = useState<string>("");
  const [modal, setModal] = useState<ActionModalState>(null)
  const [showTestData, setShowTestData] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSeed = role === "admin" || role === "manager";
  const canUploadEvidence = role === "admin" || role === "manager" || role === "staff";
  const canManage = role === "admin" || role === "manager";
  const canOperate = canManage || role === "staff";

  const siteById = useMemo(() => {
    const index = new Map<string, string>();
    data?.sites.forEach((site) => index.set(site.siteId, site.siteName));
    return index;
  }, [data?.sites]);

  const clientById = useMemo(() => {
    const index = new Map<string, string>();
    data?.clients.forEach((client) => index.set(client.clientId, client.clientName));
    return index;
  }, [data?.clients]);

  const firstCompletedCollection = data?.collections.find((collection) => collection.status === "Completed");
  const linkedManifest = firstCompletedCollection
    ? data?.manifests.find((manifest) => manifest.collectionId === firstCompletedCollection.collectionId)
    : null;

  async function loadData(showRefreshing = false) {
    if (showRefreshing) setRefreshing(true);
    setError(null);

    try {
      const hygieneUrl = role === "admin" ? (showTestData ? API_ROUTES.HYGIENE + "?showTestData=1" : API_ROUTES.HYGIENE) : API_ROUTES.HYGIENE
      const response = await authFetch(hygieneUrl);
      const payload = (await response.json()) as { data?: HygieneDashboardData; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Unable to load hygiene dashboard data.");
      }

      setData(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load hygiene dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function seedDataset() {
    setRefreshing(true);
    setError(null);

    try {
      const response = await authFetch(API_ROUTES.HYGIENE, {
        method: "POST",
        body: JSON.stringify({ action: "seed-cbavo" }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "CBAVO seed action failed.");
      }

      await loadData(true);
    } catch (seedError) {
      setError(seedError instanceof Error ? seedError.message : "CBAVO seed action failed.");
    } finally {
      setRefreshing(false);
    }
  }

  async function postJson(url: string, body: Record<string, unknown>, successMessage: string) {
    setMutationStatus("Saving...");
    setError(null);
    try {
      const response = await authFetch(url, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? successMessage);
      setMutationStatus(successMessage);
      setModal(null);
      await loadData(true);
    } catch (actionError) {
      setMutationStatus(actionError instanceof Error ? actionError.message : "Action failed.");
    }
  }

  async function postJobAction(collectionId: string, action: string, successMessage: string, extra: Record<string, unknown> = {}) {
    await postJson(API_ROUTES.HYGIENE_JOBS, { collectionId, action, ...extra }, successMessage);
  }

  function openModal(kind: ModalKind, title: string, defaults?: unknown) {
    setMutationStatus("");
    setModal({ kind, title, defaults: (defaults ?? {}) as Record<string, unknown> });
  }

  function valueFromForm(formData: FormData, key: string): string {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  }

  function numberFromForm(formData: FormData, key: string): number {
    const value = Number(valueFromForm(formData, key));
    return Number.isFinite(value) ? value : 0;
  }

  async function submitModal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;

    const formData = new FormData(event.currentTarget);
    const defaults = modal.defaults ?? {};

    if (modal.kind === "client") {
      await postJson(API_ROUTES.HYGIENE, {
        action: "upsert-client",
        clientId: defaults.clientId,
        clientName: valueFromForm(formData, "clientName"),
        primaryContactName: valueFromForm(formData, "primaryContactName"),
        primaryContactPhone: valueFromForm(formData, "primaryContactPhone"),
        primaryContactEmail: valueFromForm(formData, "primaryContactEmail") || "operations@cbavo.local",
        paymentStatus: valueFromForm(formData, "paymentStatus"),
        monthlyRevenue: numberFromForm(formData, "monthlyRevenue"),
        status: valueFromForm(formData, "status"),
        recordClassification: valueFromForm(formData, "recordClassification") as HygieneRecordClassification,
      }, "Client saved.");
      return;
    }

    if (modal.kind === "site") {
      await postJson(API_ROUTES.HYGIENE, {
        action: "upsert-site",
        siteId: defaults.siteId,
        clientId: valueFromForm(formData, "clientId") || defaults.clientId || "TE-CLI-0001",
        siteName: valueFromForm(formData, "siteName"),
        address: valueFromForm(formData, "address"),
        suburb: valueFromForm(formData, "suburb"),
        city: valueFromForm(formData, "city"),
        contactPerson: valueFromForm(formData, "contactPerson"),
        contactPhone: valueFromForm(formData, "contactPhone"),
        binCount: numberFromForm(formData, "binCount"),
        binSize: valueFromForm(formData, "binSize"),
        serviceFrequency: valueFromForm(formData, "serviceFrequency"),
        accessNotes: valueFromForm(formData, "accessNotes"),
        nextServiceDate: valueFromForm(formData, "nextServiceDate") || null,
        status: valueFromForm(formData, "status"),
      }, "Site saved.");
      return;
    }

    if (modal.kind === "collection") {
      await postJson(API_ROUTES.HYGIENE, {
        action: "upsert-collection",
        collectionId: defaults.collectionId,
        clientId: valueFromForm(formData, "clientId") || defaults.clientId || "TE-CLI-0001",
        siteId: valueFromForm(formData, "siteId") || defaults.siteId || "TE-SIT-0001",
        scheduledDate: valueFromForm(formData, "scheduledDate"),
        scheduledTimeWindow: valueFromForm(formData, "scheduledTimeWindow"),
        assignedDriver: valueFromForm(formData, "assignedDriver"),
        vehicleRegistration: valueFromForm(formData, "vehicleRegistration"),
        vehicleName: valueFromForm(formData, "vehicleName"),
        status: valueFromForm(formData, "status"),
        manifestId: defaults.manifestId || "Pending",
      }, "Collection saved.");
      return;
    }

    if (modal.kind === "backup") {
      await postJson(API_ROUTES.HYGIENE, {
        action: "assign-backup-transport",
        collectionId: defaults.collectionId,
        backupVehicleUsed: formData.get("backupVehicleUsed") === "on",
        backupDriverUsed: formData.get("backupDriverUsed") === "on",
        vehicleRegistration: valueFromForm(formData, "vehicleRegistration"),
        driverName: valueFromForm(formData, "driverName"),
        reason: valueFromForm(formData, "reason") || BACKUP_NOTE,
        approvedBy: valueFromForm(formData, "approvedBy"),
      }, "Backup transport assigned.");
      return;
    }

    if (modal.kind === "asset") {
      await postJson(API_ROUTES.HYGIENE_ASSETS, {
        assetId: defaults.assetId,
        clientId: valueFromForm(formData, "clientId") || defaults.clientId || "TE-CLI-0001",
        siteId: valueFromForm(formData, "siteId") || defaults.siteId || "TE-SIT-0001",
        binSize: valueFromForm(formData, "binSize"),
        binType: valueFromForm(formData, "binType"),
        locationDescription: valueFromForm(formData, "locationDescription"),
        status: valueFromForm(formData, "status"),
        condition: valueFromForm(formData, "condition"),
        notes: valueFromForm(formData, "notes"),
      }, "Asset saved.");
      return;
    }

    if (modal.kind === "manifest") {
      await postJson(API_ROUTES.HYGIENE_MANIFESTS, {
        manifestId: defaults.manifestId,
        collectionId: valueFromForm(formData, "collectionId") || defaults.collectionId,
        disposalFacility: valueFromForm(formData, "disposalFacility"),
        disposalCertificateNo: valueFromForm(formData, "disposalCertificateNo"),
        disposalDate: valueFromForm(formData, "disposalDate") || null,
        status: valueFromForm(formData, "status"),
      }, "Manifest saved.");
      return;
    }

    if (modal.kind === "compliance") {
      const file = formData.get("file");
      const upload = new FormData();
      ["documentId", "documentType", "title", "registrationNumber", "issueDate", "expiryDate", "status", "owner"].forEach((key) => {
        upload.append(key, valueFromForm(formData, key) || String(defaults[key] ?? ""));
      });
      if (file instanceof File && file.size > 0) upload.append("file", file);
      setMutationStatus("Uploading compliance document...");
      const response = await authFetch(API_ROUTES.HYGIENE_COMPLIANCE, { method: "POST", body: upload });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setMutationStatus(payload.error ?? "Compliance upload failed.");
        return;
      }
      setMutationStatus("Compliance document saved.");
      setModal(null);
      await loadData(true);
      return;
    }

    if (modal.kind === "report") {
      await postJson(API_ROUTES.HYGIENE_REPORTS, { period: valueFromForm(formData, "period") }, "Monthly report generated.");
      return;
    }

    if (modal.kind === "evidence") {
      await submitEvidence(event);
    }
  }

  async function uploadEvidence(file: File, category: HygienePhotoCategory) {
    if (!firstCompletedCollection || !linkedManifest) {
      setUploadStatus("A completed collection and manifest are required before uploading evidence.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("clientId", firstCompletedCollection.clientId);
    formData.append("siteId", firstCompletedCollection.siteId);
    formData.append("collectionId", firstCompletedCollection.collectionId);
    formData.append("manifestId", linkedManifest.manifestId);
    formData.append("notes", "Uploaded from the hygiene evidence gallery.");

    setUploadStatus("Uploading evidence photo...");
    try {
      const response = await authFetch(API_ROUTES.HYGIENE_EVIDENCE, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Evidence upload failed.");
      }

      setUploadStatus("Evidence photo uploaded and linked to the collection.");
      await loadData(true);
    } catch (uploadError) {
      setUploadStatus(uploadError instanceof Error ? uploadError.message : "Evidence upload failed.");
    }
  }

  async function submitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const collectionId = valueFromForm(formData, "collectionId");
    const collection = data?.collections.find((item) => item.collectionId === collectionId);
    if (!collection) {
      setUploadStatus("Select a valid collection before uploading evidence.");
      return;
    }
    const manifest = data?.manifests.find((item) => item.collectionId === collection.collectionId);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setUploadStatus("Select a photo or certificate file.");
      return;
    }

    formData.set("clientId", collection.clientId);
    formData.set("siteId", valueFromForm(formData, "siteId") || collection.siteId);
    formData.set("manifestId", valueFromForm(formData, "manifestId") || manifest?.manifestId || collection.manifestId || "Pending");
    setUploadStatus("Uploading evidence...");
    try {
      const response = await authFetch(API_ROUTES.HYGIENE_EVIDENCE, { method: "POST", body: formData });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Evidence upload failed.");
      setUploadStatus("Evidence uploaded and linked.");
      await loadData(true);
    } catch (uploadError) {
      setUploadStatus(uploadError instanceof Error ? uploadError.message : "Evidence upload failed.");
    }
  }

  function handleEvidenceSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadEvidence(file, "Site Arrival");
  }

  useEffect(() => {
    if (!authLoading) {
      void loadData();
    }
  }, [authLoading, showTestData]);

  return (
    <div data-module="hygiene" className="tex-shell space-y-6 text-white" style={hygieneThemeStyle}>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleEvidenceSelection} />

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-100">Hygiene Division</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">CBAVO Services Operations Dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Internal Torque Empire workspace for hygiene scheduling, driver workflow, digital manifests, evidence, compliance, and monthly reporting.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadData(true)} disabled={refreshing} className={secondaryButtonClass}>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            {role === "admin" ? (
              <label className="flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-bold text-slate-100">
                <input type="checkbox" checked={showTestData} onChange={(event) => setShowTestData(event.target.checked)} />
                Show Test Data
              </label>
            ) : null}
            {canSeed ? (
              <button type="button" onClick={() => void seedDataset()} disabled={refreshing} className={primaryButtonClass}>
                Seed CBAVO
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-semibold transition ${item.view === view ? "border-[color:var(--hygiene-primary)] bg-[color:var(--hygiene-primary)] text-white shadow-sm" : "border-[color:var(--hygiene-border)] bg-white/[0.04] text-[color:var(--hygiene-text-muted)] hover:bg-white/[0.10]"}`}>
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      {mutationStatus ? (
        <div className="rounded-xl border border-[color:var(--hygiene-success)] bg-emerald-50 p-4 text-sm font-bold text-emerald-950">{mutationStatus}</div>
      ) : null}

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <form onSubmit={submitModal} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[color:var(--hygiene-border)] bg-[color:var(--hygiene-surface)] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-100">Hygiene Action</p>
                <h2 className="mt-1 text-xl font-semibold text-white">{modal.title}</h2>
              </div>
              <button type="button" onClick={() => setModal(null)} className={secondaryButtonClass}>Close</button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {modal.kind === "client" ? (
                <>
                  <Field name="clientName" label="Client name" defaultValue={modal.defaults?.clientName ?? "CBAVO Services"} />
                  <Field name="primaryContactName" label="Primary contact" defaultValue={modal.defaults?.primaryContactName ?? "CBAVO Services"} />
                  <Field name="primaryContactPhone" label="Phone" defaultValue={modal.defaults?.primaryContactPhone ?? "CBAVO Services"} />
                  <Field name="primaryContactEmail" label="Email" defaultValue={modal.defaults?.primaryContactEmail ?? "operations@cbavo.local"} />
                  <SelectField name="paymentStatus" label="Payment status" defaultValue={String(modal.defaults?.paymentStatus ?? "Paid")} options={["Paid", "Pending", "Overdue"]} />
                  <SelectField name="recordClassification" label="Record classification" defaultValue={String(modal.defaults?.recordClassification ?? "PRODUCTION")} options={["PRODUCTION", "TEST", "DEMO", "ARCHIVED"]} />
                  <Field name="monthlyRevenue" label="Monthly contract revenue" type="number" defaultValue={modal.defaults?.monthlyRevenue ?? 2100} />
                  <SelectField name="status" label="Status" defaultValue={String(modal.defaults?.status ?? "Active")} options={["Active", "Pending", "Inactive", "Suspended"]} />
                </>
              ) : null}

              {modal.kind === "site" ? (
                <>
                  <SelectField name="clientId" label="Client" defaultValue={String(modal.defaults?.clientId ?? "TE-CLI-0001")} options={(data?.clients ?? []).map((client) => client.clientId)} />
                  <Field name="siteName" label="Site name" defaultValue={modal.defaults?.siteName ?? "Florida Campus"} />
                  <Field name="address" label="Address" defaultValue={modal.defaults?.address ?? ""} />
                  <Field name="suburb" label="Suburb" defaultValue={modal.defaults?.suburb ?? "Roodepoort"} />
                  <Field name="city" label="City" defaultValue={modal.defaults?.city ?? "Roodepoort"} />
                  <Field name="contactPerson" label="Site contact" defaultValue={modal.defaults?.contactPerson ?? "CBAVO Services"} />
                  <Field name="contactPhone" label="Contact phone" defaultValue={modal.defaults?.contactPhone ?? ""} />
                  <Field name="binCount" label="Bin count" type="number" defaultValue={modal.defaults?.binCount ?? 1} />
                  <Field name="binSize" label="Bin size" defaultValue={modal.defaults?.binSize ?? "12L"} />
                  <Field name="serviceFrequency" label="Collection schedule" defaultValue={modal.defaults?.serviceFrequency ?? "Weekly"} />
                  <Field name="nextServiceDate" label="Next service date" type="date" defaultValue={modal.defaults?.nextServiceDate ?? ""} />
                  <Field name="accessNotes" label="Access notes" defaultValue={modal.defaults?.accessNotes ?? "Friday after 13:00."} />
                  <SelectField name="status" label="Status" defaultValue={String(modal.defaults?.status ?? "Active")} options={["Active", "Inactive", "Pending", "Suspended"]} />
                </>
              ) : null}

              {modal.kind === "collection" ? (
                <>
                  <SelectField name="clientId" label="Client" defaultValue={String(modal.defaults?.clientId ?? "TE-CLI-0001")} options={(data?.clients ?? []).map((client) => client.clientId)} />
                  <SelectField name="siteId" label="Site" defaultValue={String(modal.defaults?.siteId ?? "TE-SIT-0001")} options={(data?.sites ?? []).map((site) => site.siteId)} />
                  <Field name="scheduledDate" label="Scheduled date" type="date" defaultValue={modal.defaults?.scheduledDate ?? new Date().toISOString().slice(0, 10)} />
                  <Field name="scheduledTimeWindow" label="Time window" defaultValue={modal.defaults?.scheduledTimeWindow ?? "After 13:00"} />
                  <Field name="assignedDriver" label="Driver" defaultValue={modal.defaults?.assignedDriver ?? "C. Karanie"} />
                  <Field name="vehicleName" label="Vehicle name" defaultValue={modal.defaults?.vehicleName ?? "Nissan NP200"} />
                  <Field name="vehicleRegistration" label="Vehicle registration" defaultValue={modal.defaults?.vehicleRegistration ?? "JG 71 RS GP"} />
                  <SelectField name="status" label="Status" defaultValue={String(modal.defaults?.status ?? "Scheduled")} options={["Scheduled", "In Progress", "Awaiting Disposal", "Completed", "Cancelled", "Rescheduled"]} />
                </>
              ) : null}

              {modal.kind === "backup" ? (
                <>
                  <label className="flex items-center gap-3 text-sm text-slate-200"><input name="backupVehicleUsed" type="checkbox" defaultChecked /> Backup vehicle</label>
                  <label className="flex items-center gap-3 text-sm text-slate-200"><input name="backupDriverUsed" type="checkbox" defaultChecked /> Backup driver</label>
                  <Field name="vehicleRegistration" label="Vehicle registration" defaultValue={modal.defaults?.vehicleRegistration ?? ""} />
                  <Field name="driverName" label="Driver name" defaultValue={modal.defaults?.assignedDriver ?? ""} />
                  <Field name="approvedBy" label="Approved by" defaultValue="Torque Empire management" />
                  <Field name="reason" label="Reason" defaultValue={BACKUP_NOTE} />
                </>
              ) : null}

              {modal.kind === "asset" ? (
                <>
                  <SelectField name="clientId" label="Client" defaultValue={String(modal.defaults?.clientId ?? "TE-CLI-0001")} options={(data?.clients ?? []).map((client) => client.clientId)} />
                  <SelectField name="siteId" label="Site" defaultValue={String(modal.defaults?.siteId ?? "TE-SIT-0001")} options={(data?.sites ?? []).map((site) => site.siteId)} />
                  <Field name="binSize" label="Bin size" defaultValue={modal.defaults?.binSize ?? "12L"} />
                  <Field name="binType" label="Bin type" defaultValue={modal.defaults?.binType ?? "Sanitary hygiene bin"} />
                  <Field name="locationDescription" label="Location" defaultValue={modal.defaults?.locationDescription ?? "Service point"} />
                  <Field name="condition" label="Condition" defaultValue={modal.defaults?.condition ?? "Serviceable"} />
                  <Field name="notes" label="Notes" defaultValue={modal.defaults?.notes ?? "Operational asset update."} />
                  <SelectField name="status" label="Status" defaultValue={String(modal.defaults?.status ?? "Active")} options={["Active", "Pending", "In Maintenance", "Retired"]} />
                </>
              ) : null}

              {modal.kind === "manifest" ? (
                <>
                  <SelectField name="collectionId" label="Collection" defaultValue={String(modal.defaults?.collectionId ?? data?.collections[0]?.collectionId ?? "")} options={(data?.collections ?? []).map((collection) => collection.collectionId)} />
                  <Field name="disposalFacility" label="Disposal facility" defaultValue={modal.defaults?.disposalFacility ?? "Disposal facility not yet captured"} />
                  <Field name="disposalCertificateNo" label="Disposal certificate no." defaultValue={modal.defaults?.disposalCertificateNo ?? "Disposal certificate pending"} />
                  <Field name="disposalDate" label="Disposal date" type="date" defaultValue={modal.defaults?.disposalDate ?? ""} />
                  <SelectField name="status" label="Status" defaultValue={String(modal.defaults?.status ?? "Generated")} options={["Draft", "Generated", "In Transit", "Awaiting Disposal", "Disposed", "Certified"]} />
                </>
              ) : null}

              {modal.kind === "compliance" ? (
                <>
                  <SelectField name="documentType" label="Document type" defaultValue={String(modal.defaults?.documentType ?? COMPLIANCE_DOC_TYPES[0])} options={COMPLIANCE_DOC_TYPES} />
                  <Field name="title" label="Title" defaultValue={modal.defaults?.title ?? modal.defaults?.documentType ?? COMPLIANCE_DOC_TYPES[0]} />
                  <Field name="registrationNumber" label="Registration/reference" defaultValue={modal.defaults?.registrationNumber ?? "Pending"} />
                  <Field name="owner" label="Owner" defaultValue={modal.defaults?.owner ?? "Torque Empire"} />
                  <Field name="issueDate" label="Issue date" type="date" defaultValue={modal.defaults?.issueDate ?? ""} />
                  <Field name="expiryDate" label="Expiry date" type="date" defaultValue={modal.defaults?.expiryDate ?? ""} />
                  <SelectField name="status" label="Status" defaultValue={String(modal.defaults?.status ?? "Pending")} options={["Active", "Pending", "Compliance Green", "Compliance Warning", "Compliance Expired"]} />
                  <Field name="file" label="File"><input name="file" type="file" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white" /></Field>
                </>
              ) : null}

              {modal.kind === "report" ? (
                <Field name="period" label="Report month" type="month" defaultValue={modal.defaults?.period ?? new Date().toISOString().slice(0, 7)} />
              ) : null}

              {modal.kind === "evidence" ? (
                <>
                  <SelectField name="collectionId" label="Collection" defaultValue={String(modal.defaults?.collectionId ?? data?.collections[0]?.collectionId ?? "")} options={(data?.collections ?? []).map((collection) => collection.collectionId)} />
                  <SelectField name="siteId" label="Site" defaultValue={String(modal.defaults?.siteId ?? data?.sites[0]?.siteId ?? "")} options={(data?.sites ?? []).map((site) => site.siteId)} />
                  <SelectField name="category" label="Category" defaultValue={String(modal.defaults?.category ?? "Site Arrival")} options={HYGIENE_PHOTO_CATEGORIES} />
                  <Field name="notes" label="Notes" defaultValue={modal.defaults?.notes ?? "Uploaded from office dashboard."} />
                  <Field name="file" label="Photo or certificate"><input name="file" type="file" accept="image/*,.pdf" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white" /></Field>
                </>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className={secondaryButtonClass}>Cancel</button>
              <button type="submit" className={primaryButtonClass}>Save action</button>
            </div>
          </form>
        </div>
      ) : null}

      {loading || authLoading ? <LoadingState /> : null}

      {!loading && error ? (
        <div className="rounded-xl border border-[color:var(--hygiene-danger)] bg-red-50 p-4 text-sm font-semibold text-red-950">{error}</div>
      ) : null}

      {!loading && !error && !data ? (
        <EmptyState title="No hygiene data" detail="Seed the CBAVO dataset to create the first hygiene operating records." />
      ) : null}

      {!loading && data && view === "home" ? (
        <div className="space-y-6">
          <Panel title="Operational Actions" eyebrow="Office workflow">
            <div className="flex flex-wrap gap-2">
              {canManage ? <SmallAction variant="primary" onClick={() => openModal("collection", "Create Collection")}>Create Collection</SmallAction> : null}
              {canManage ? <SmallAction variant="warning" onClick={() => openModal("collection", "Assign Driver", data.collections.find((item) => item.collectionId === "TE-COL-2026-0002") ?? data.collections[0])}>Assign Driver</SmallAction> : null}
              {canManage ? <SmallAction variant="warning" onClick={() => openModal("backup", "Assign Vehicle / Backup Transport", data.collections.find((item) => item.collectionId === "TE-COL-2026-0002") ?? data.collections[0])}>Assign Vehicle</SmallAction> : null}
              {canOperate ? <SmallAction variant="warning" onClick={() => void postJson(API_ROUTES.HYGIENE_MANIFESTS, { action: "generate", collectionId: data.collections.find((item) => item.collectionId === "TE-COL-2026-0002")?.collectionId ?? data.collections[0]?.collectionId }, "Manifest generated.")}>Generate Manifest</SmallAction> : null}
              {canUploadEvidence ? <SmallAction variant="primary" onClick={() => openModal("evidence", "Upload Evidence")}>Upload Evidence</SmallAction> : null}
              {canManage ? <SmallAction variant="primary" onClick={() => openModal("compliance", "Upload Disposal Certificate", { documentType: "Disposal Certificates", title: "Disposal Certificate", status: "Pending" })}>Upload Disposal Certificate</SmallAction> : null}
              <SmallAction onClick={() => void loadData(true)}>Refresh</SmallAction>
            </div>
          </Panel>

          <section className="grid gap-4 xl:grid-cols-2">
            <MiniBarChart
              title="Collections by Status"
              items={[
                { label: "Scheduled", value: data.collections.filter((collection) => collection.status === "Scheduled").length, tone: "warning" },
                { label: "In Progress", value: data.collections.filter((collection) => collection.status === "In Progress").length, tone: "info" },
                { label: "Completed", value: data.collections.filter((collection) => collection.status === "Completed").length, tone: "success" },
                { label: "Awaiting Disposal", value: data.collections.filter((collection) => collection.status === "Awaiting Disposal").length, tone: "warning" },
              ]}
            />
            <MiniBarChart
              title="Evidence and Compliance"
              items={[
                { label: "Evidence Files", value: data.evidencePhotos.length, tone: "info" },
                { label: "Compliance Green", value: data.complianceDocuments.filter((document) => document.status === "Compliance Green").length, tone: "success" },
                { label: "Open Compliance Items", value: data.complianceDocuments.filter((document) => document.status !== "Compliance Green").length, tone: "warning" },
                { label: "Pending Certificates", value: data.kpis.disposalCertificatesPending, tone: data.kpis.disposalCertificatesPending > 0 ? "warning" : "success" },
              ]}
            />
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            <KpiCard label="Active Hygiene Clients" value={data.kpis.activeHygieneClients} helper="Live hygiene accounts" />
            <KpiCard label="Active Sites" value={data.kpis.activeSites} helper="Serviceable client locations" />
            <KpiCard label="Active Bin Assets" value={data.kpis.activeBinAssets} helper="Tracked hygiene bins" />
            <KpiCard label="Collections Due This Week" value={data.kpis.collectionsDueThisWeek} helper="Scheduled jobs" />
            <KpiCard label="Collections Completed This Month" value={data.kpis.collectionsCompletedThisMonth} helper="Closed jobs" />
            <KpiCard label="Waste Services Completed" value={data.kpis.wasteServicesCompleted} helper="Bins serviced from manifests" />
            <KpiCard label="Disposal Certificates Pending" value={data.kpis.disposalCertificatesPending} helper="Awaiting final certificates" />
            <KpiCard label="Compliance Status" value={<StatusBadge value={data.kpis.complianceStatus} />} helper="Overall document posture" />
            <KpiCard label="Monthly Contract Revenue" value={currency(data.kpis.monthlyContractRevenue)} helper="Captured contract value" />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <Panel title="Today's Collections" eyebrow="Dispatch">
              <DataTable
                headers={["Collection", "Site", "Driver", "Status"]}
                emptyLabel="collections for today"
                rows={data.collections.filter((collection) => collection.scheduledDate === "2026-06-20").map((collection) => [
                  <PrimaryCell key="collection" title={collection.collectionId} subtitle={collection.scheduledTimeWindow} />,
                  siteById.get(collection.siteId) ?? collection.siteId,
                  `${collection.assignedDriver} | ${collection.vehicleRegistration}`,
                  <StatusBadge key="status" value={collection.status} />,
                ])}
              />
            </Panel>
            <Panel title="Upcoming Collections" eyebrow="Scheduler">
              <DataTable
                headers={["Collection", "Date", "Site", "Status"]}
                emptyLabel="upcoming collections"
                rows={data.collections.filter((collection) => collection.status === "Scheduled").map((collection) => [
                  <PrimaryCell key="collection" title={collection.collectionId} subtitle={collection.scheduledTimeWindow} />,
                  formatDate(collection.scheduledDate),
                  siteById.get(collection.siteId) ?? collection.siteId,
                  <StatusBadge key="status" value={collection.status} />,
                ])}
              />
            </Panel>
            <Panel title="Compliance Alerts" eyebrow="Audit">
              <DataTable
                headers={["Document", "Reference", "Expiry", "Status"]}
                emptyLabel="compliance alerts"
                rows={data.complianceDocuments.filter((document) => document.status !== "Compliance Green").map((document) => [
                  <PrimaryCell key="doc" title={document.title} subtitle={document.owner} />,
                  document.registrationNumber,
                  formatDate(document.expiryDate),
                  <StatusBadge key="status" value={document.status} />,
                ])}
              />
            </Panel>
            <Panel title="Recent Evidence Uploads" eyebrow="Proof of service">
              <DataTable
                headers={["Category", "Collection", "Site", "Uploaded"]}
                emptyLabel="evidence uploads"
                rows={data.evidencePhotos.slice(0, 5).map((photo) => [
                  <PrimaryCell key="photo" title={photo.category} subtitle={photo.notes} />,
                  photo.collectionId,
                  siteById.get(photo.siteId) ?? photo.siteId,
                  formatDate(photo.uploadedAt),
                ])}
              />
            </Panel>
          </section>

          <Panel title="Client Portfolio Summary" eyebrow="Client operations">
            <DataTable
              headers={["Client", "Sites", "Bins", "Payment", "Status"]}
              emptyLabel="clients"
              rows={data.clients.map((client) => [
                <PrimaryCell key="client" title={client.clientName} subtitle={`${client.clientType} | ${client.clientId}`} />,
                data.sites.filter((site) => site.clientId === client.clientId).length,
                data.assets.filter((asset) => asset.clientId === client.clientId).length,
                <StatusBadge key="payment" value={client.paymentStatus} />,
                <StatusBadge key="status" value={client.status} />,
              ])}
            />
          </Panel>
        </div>
      ) : null}

      {!loading && data && view === "clients" ? (
        <div className="space-y-6">
          <Panel title="Client Register" eyebrow="Accounts" action={canManage ? <SmallAction variant="primary" onClick={() => openModal("client", "Add Client")}>Add Client</SmallAction> : null}>
            <DataTable headers={["Client", "Contact", "Contract", "Service", "Payment", "Class", "Status", "Actions"]} emptyLabel="clients" rows={data.clients.map((client) => [
              <PrimaryCell key="client" title={client.clientName} subtitle={`${client.clientType} | ${client.companyRegistration}`} />,
              <PrimaryCell key="contact" title={client.primaryContactName} subtitle={`${client.primaryContactPhone} | ${client.primaryContactEmail}`} />,
              `${formatDate(client.contractStartDate)} to ${formatDate(client.contractEndDate)}`,
              `${client.serviceFrequency}, ${client.collectionDay} ${client.collectionWindow}`,
              <StatusBadge key="payment" value={client.paymentStatus} />,
              <StatusBadge key="class" value={client.recordClassification} tone={client.recordClassification === "PRODUCTION" ? "success" : "warning"} />,
              <StatusBadge key="status" value={client.status} />,
              <div key="actions" className="flex flex-wrap gap-2">
                <SmallAction onClick={() => openModal("client", "View Client", client)}>View Client</SmallAction>
                {canManage ? <SmallAction onClick={() => openModal("client", "Edit Client", client)}>Edit Client</SmallAction> : null}
                {canManage ? <SmallAction onClick={() => openModal("compliance", "Upload Service Agreement", { documentType: "Service Agreement", title: "Service Agreement", owner: client.clientName })}>Upload Service Agreement</SmallAction> : null}
                {canManage ? <SmallAction onClick={() => openModal("compliance", "Upload Signed Quote", { documentType: "Signed Quotation", title: "Signed Quotation", owner: client.clientName })}>Upload Signed Quote</SmallAction> : null}
                {canManage ? <SmallAction onClick={() => openModal("client", "Update Payment / Revenue", client)}>Update Payment</SmallAction> : null}
              </div>,
            ])} />
          </Panel>
          <section className="grid gap-4 xl:grid-cols-2">
            {data.clients.map((client) => (
              <BoardCard
                key={client.clientId}
                title={client.clientName}
                subtitle={`${client.clientType} | ${client.companyRegistration}`}
                status={<StatusBadge value={client.status} />}
                meta={[
                  { label: "Contact", value: client.primaryContactName },
                  { label: "Payment", value: <StatusBadge value={client.paymentStatus} /> },
                  { label: "Sites", value: data.sites.filter((site) => site.clientId === client.clientId).length },
                  { label: "Bins", value: data.assets.filter((asset) => asset.clientId === client.clientId).length },
                  { label: "Revenue", value: currency(client.monthlyRevenue) },
                  { label: "Class", value: <StatusBadge value={client.recordClassification} tone={client.recordClassification === "PRODUCTION" ? "success" : "warning"} /> },
                  { label: "Service", value: `${client.serviceFrequency} | ${client.collectionDay}` },
                ]}
              />
            ))}
          </section>
        </div>
      ) : null}

      {!loading && data && view === "sites" ? (
        <Panel title="Site Register" eyebrow="Service locations" action={canManage ? <SmallAction variant="primary" onClick={() => openModal("site", "Add Site")}>Add Site</SmallAction> : null}>
          <DataTable headers={["Site", "Address", "Contact", "Bins", "Service", "Status", "Actions"]} emptyLabel="sites" rows={data.sites.map((site) => [
            <PrimaryCell key="site" title={site.siteName} subtitle={`${site.siteId} | ${clientById.get(site.clientId) ?? site.clientId}`} />,
            <PrimaryCell key="address" title={site.address} subtitle={`${site.suburb}, ${site.city}`} />,
            <PrimaryCell key="contact" title={site.contactPerson} subtitle={site.contactPhone} />,
            `${site.binCount} x ${site.binSize}`,
            <PrimaryCell key="service" title={site.serviceFrequency} subtitle={`Next ${formatDate(site.nextServiceDate)}`} />,
            <StatusBadge key="status" value={site.status} />,
            <div key="actions" className="flex flex-wrap gap-2">
              {canManage ? <SmallAction onClick={() => openModal("site", "Edit Site", site)}>Edit Site</SmallAction> : null}
              {canManage ? <SmallAction onClick={() => openModal("asset", "Add Bin to Site", { clientId: site.clientId, siteId: site.siteId })}>Add Bin</SmallAction> : null}
              {canManage ? <SmallAction onClick={() => openModal("site", "Update Site Contact", site)}>Update Contact</SmallAction> : null}
              {canManage ? <SmallAction onClick={() => openModal("site", "Update Collection Schedule", site)}>Update Schedule</SmallAction> : null}
              {canManage ? <SmallAction onClick={() => void postJson(API_ROUTES.HYGIENE, { action: "upsert-site", ...site, status: site.status === "Active" ? "Inactive" : "Active" }, "Site status updated.")}>{site.status === "Active" ? "Mark Inactive" : "Mark Active"}</SmallAction> : null}
            </div>,
          ])} />
        </Panel>
      ) : null}

      {!loading && data && view === "assets" ? (
        <Panel title="Bin Asset Register" eyebrow="Vehicle and bin cards" action={canManage ? <SmallAction variant="primary" onClick={() => openModal("asset", "Add Bin Asset")}>Add Bin Asset</SmallAction> : null}>
          <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {data.assets.map((asset) => (
              <BoardCard
                key={asset.assetId}
                title={asset.assetId}
                subtitle={asset.locationDescription}
                status={<StatusBadge value={asset.status} />}
                meta={[
                  { label: "Site", value: siteById.get(asset.siteId) ?? asset.siteId },
                  { label: "Type", value: `${asset.binSize} ${asset.binType}` },
                  { label: "Last Service", value: formatDate(asset.lastServiceDate) },
                  { label: "Next Service", value: formatDate(asset.nextServiceDate) },
                  { label: "Condition", value: asset.condition },
                  { label: "Notes", value: asset.notes },
                ]}
                actions={(
                  <>
                    {canManage ? <SmallAction onClick={() => openModal("asset", "Edit Bin Asset", asset)}>Edit</SmallAction> : null}
                    {canManage ? <SmallAction onClick={() => openModal("asset", "Assign Bin to Site", asset)}>Assign Site</SmallAction> : null}
                    {canManage ? <SmallAction variant="success" onClick={() => void postJson(API_ROUTES.HYGIENE_ASSETS, { ...asset, condition: "Serviced", lastServiceDate: new Date().toISOString().slice(0, 10), status: "Active" }, "Asset marked serviced.")}>Mark Serviced</SmallAction> : null}
                    {canManage ? <SmallAction variant="danger" onClick={() => void postJson(API_ROUTES.HYGIENE_ASSETS, { ...asset, condition: "Damaged", status: "In Maintenance" }, "Asset marked damaged.")}>Mark Damaged</SmallAction> : null}
                    {canManage ? <SmallAction onClick={() => void postJson(API_ROUTES.HYGIENE_ASSETS, { ...asset, condition: "Replaced", status: "Active" }, "Asset marked replaced.")}>Mark Replaced</SmallAction> : null}
                    {canManage ? <SmallAction variant="danger" onClick={() => void postJson(API_ROUTES.HYGIENE_ASSETS, { ...asset, status: "Retired" }, "Asset retired.")}>Retire</SmallAction> : null}
                  </>
                )}
              />
            ))}
          </div>
        </Panel>
      ) : null}

      {!loading && data && view === "collections" ? (
        <div className="space-y-6">
          <Panel title="Collection Scheduler" eyebrow="Dispatch and route control" action={canManage ? <SmallAction variant="primary" onClick={() => openModal("collection", "Create Collection")}>Create Collection</SmallAction> : null}>
            <div className="mb-5 grid gap-4 xl:grid-cols-2">
              {data.collections.map((collection) => (
                <BoardCard
                  key={collection.collectionId}
                  title={collection.collectionId}
                  subtitle={`${clientById.get(collection.clientId) ?? collection.clientId} | ${siteById.get(collection.siteId) ?? collection.siteId}`}
                  status={<StatusBadge value={collection.status} />}
                  meta={[
                    { label: "Schedule", value: `${formatDate(collection.scheduledDate)} | ${collection.scheduledTimeWindow}` },
                    { label: "Driver", value: collection.assignedDriver },
                    { label: "Vehicle", value: `${collection.vehicleName} | ${collection.vehicleRegistration}` },
                    { label: "Signature", value: collection.clientSignatureStatus },
                  ]}
                  actions={(
                    <>
                      <Link className={smallLinkClass} href={`/dashboard/hygiene/jobs/${collection.collectionId}`}>Open Job</Link>
                      {canManage ? <SmallAction variant="warning" onClick={() => openModal("collection", "Assign Driver", collection)}>Assign Driver</SmallAction> : null}
                      {canManage ? <SmallAction variant="warning" onClick={() => openModal("backup", "Assign Vehicle / Backup Transport", collection)}>Assign Vehicle</SmallAction> : null}
                      {canUploadEvidence ? <SmallAction onClick={() => openModal("evidence", "Upload Evidence", collection)}>Upload Evidence</SmallAction> : null}
                    </>
                  )}
                />
              ))}
            </div>
            <DataTable headers={["Collection", "Client / Site", "Schedule", "Driver / Vehicle", "Signature", "Status", "Actions"]} emptyLabel="collections" rows={data.collections.map((collection) => [
              <PrimaryCell key="collection" title={collection.collectionId} subtitle={`Manifest ${collection.manifestId}`} />,
              <PrimaryCell key="client" title={clientById.get(collection.clientId) ?? collection.clientId} subtitle={siteById.get(collection.siteId) ?? collection.siteId} />,
              <PrimaryCell key="schedule" title={formatDate(collection.scheduledDate)} subtitle={collection.scheduledTimeWindow} />,
              <PrimaryCell key="driver" title={collection.assignedDriver} subtitle={`${collection.vehicleName} | ${collection.vehicleRegistration}`} />,
              collection.clientSignatureStatus,
              <StatusBadge key="status" value={collection.status} />,
              <div key="actions" className="flex max-w-md flex-wrap gap-2">
                <Link className={smallLinkClass} href={`/dashboard/hygiene/jobs/${collection.collectionId}`}>Open Job</Link>
                {canManage ? <SmallAction variant="warning" onClick={() => openModal("collection", "Assign Driver", collection)}>Assign Driver</SmallAction> : null}
                {canManage ? <SmallAction variant="warning" onClick={() => openModal("backup", "Assign Vehicle / Backup Transport", collection)}>Assign Vehicle</SmallAction> : null}
                {canOperate ? <SmallAction onClick={() => void postJobAction(collection.collectionId, "start-collection", "Collection started.")}>Start Collection</SmallAction> : null}
                {canOperate ? <SmallAction onClick={() => void postJobAction(collection.collectionId, "confirm-arrival", "Arrival confirmed.")}>Confirm Arrival</SmallAction> : null}
                {canUploadEvidence ? <SmallAction onClick={() => openModal("evidence", "Upload Evidence", collection)}>Upload Evidence</SmallAction> : null}
                <Link className={smallLinkClass} href="/dashboard/hygiene/signatures">Capture Signature</Link>
                {canOperate ? <SmallAction variant="warning" onClick={() => void postJson(API_ROUTES.HYGIENE_MANIFESTS, { action: "generate", collectionId: collection.collectionId }, "Manifest generated.")}>Generate Manifest</SmallAction> : null}
                {canOperate ? <SmallAction variant="warning" onClick={() => void postJobAction(collection.collectionId, "awaiting-disposal", "Collection moved to awaiting disposal.")}>Mark Awaiting Disposal</SmallAction> : null}
                {canManage ? <SmallAction variant="danger" onClick={() => openModal("collection", "Cancel / Reschedule", collection)}>Cancel/Reschedule</SmallAction> : null}
                {canOperate ? <SmallAction variant="success" onClick={() => void postJobAction(collection.collectionId, "complete-job", "Collection completed.", { adminOverrideReason: "Office override from dashboard action when required." })}>Complete Collection</SmallAction> : null}
              </div>,
            ])} />
          </Panel>
          <Panel title="Driver Mobile Workflow" eyebrow="Staff completion flow">
            <div className="grid gap-4 xl:grid-cols-2">
              {data.collections.map((collection) => <WorkflowCard key={collection.collectionId} collection={collection} />)}
            </div>
          </Panel>
        </div>
      ) : null}

      {!loading && data && view === "manifests" ? (
        <Panel title="Waste Manifest Register" eyebrow="Chain of custody" action={canOperate ? <SmallAction variant="warning" onClick={() => void postJson(API_ROUTES.HYGIENE_MANIFESTS, { action: "generate", collectionId: data.collections[0]?.collectionId }, "Manifest generated.")}>Generate Manifest</SmallAction> : null}>
          <div className="mb-5 grid gap-4 xl:grid-cols-2">
            {data.manifests.map((manifest) => (
              <BoardCard
                key={manifest.manifestId}
                title={manifest.manifestId}
                subtitle={`Collection ${manifest.collectionId}`}
                status={<StatusBadge value={manifest.status} />}
                meta={[
                  { label: "Site", value: siteById.get(manifest.siteId) ?? manifest.siteId },
                  { label: "Waste", value: `${manifest.wasteType} | ${manifest.wasteClassification}` },
                  { label: "Quantity", value: `${manifest.quantity} ${manifest.unit}` },
                  { label: "Transport", value: `${manifest.collectedBy} | ${manifest.vehicleRegistration}` },
                ]}
                actions={(
                  <>
                    {canOperate ? <SmallAction onClick={() => openModal("manifest", "Edit Manifest", manifest)}>Edit Manifest</SmallAction> : null}
                    {canOperate ? <SmallAction onClick={() => openModal("manifest", "Add Disposal Facility", manifest)}>Disposal Facility</SmallAction> : null}
                    {canManage ? <SmallAction variant="primary" onClick={() => openModal("compliance", "Upload Disposal Certificate", { documentType: "Disposal Certificates", title: `Disposal Certificate ${manifest.manifestId}`, registrationNumber: manifest.disposalCertificateNo, owner: clientById.get(manifest.clientId) ?? manifest.clientId })}>Upload Certificate</SmallAction> : null}
                  </>
                )}
              >
                <DisposalWarningCell manifest={manifest} />
              </BoardCard>
            ))}
          </div>
          <DataTable headers={["Manifest", "Site", "Waste", "Quantity", "Transport", "Disposal", "Status", "Actions"]} emptyLabel="manifests" rows={data.manifests.map((manifest) => [
            <PrimaryCell key="manifest" title={manifest.manifestId} subtitle={`Collection ${manifest.collectionId}`} />,
            siteById.get(manifest.siteId) ?? manifest.siteId,
            <PrimaryCell key="waste" title={manifest.wasteType} subtitle={manifest.wasteClassification} />,
            `${manifest.quantity} ${manifest.unit}`,
            <PrimaryCell key="transport" title={manifest.collectedBy} subtitle={manifest.vehicleRegistration} />,
            <DisposalWarningCell key="disposal" manifest={manifest} />,
            <StatusBadge key="status" value={manifest.status} />,
            <div key="actions" className="flex max-w-sm flex-wrap gap-2">
              {canOperate ? <SmallAction onClick={() => openModal("manifest", "Edit Manifest", manifest)}>Edit Manifest</SmallAction> : null}
              {canOperate ? <SmallAction onClick={() => openModal("manifest", "Link Manifest to Collection", manifest)}>Link Collection</SmallAction> : null}
              {canOperate ? <SmallAction onClick={() => openModal("manifest", "Add Transport Details", manifest)}>Transport Details</SmallAction> : null}
              {canOperate ? <SmallAction onClick={() => openModal("manifest", "Add Disposal Facility", manifest)}>Disposal Facility</SmallAction> : null}
              {canManage ? <SmallAction variant="primary" onClick={() => openModal("compliance", "Upload Disposal Certificate", { documentType: "Disposal Certificates", title: `Disposal Certificate ${manifest.manifestId}`, registrationNumber: manifest.disposalCertificateNo, owner: clientById.get(manifest.clientId) ?? manifest.clientId })}>Upload Certificate</SmallAction> : null}
              {canOperate ? <SmallAction onClick={() => void postJson(API_ROUTES.HYGIENE_MANIFESTS, { ...manifest, status: "Disposed" }, "Manifest marked disposed.")}>Mark Disposed</SmallAction> : null}
              {canManage ? <SmallAction onClick={() => void postJson(API_ROUTES.HYGIENE_MANIFESTS, { ...manifest, status: "Certified", disposalCertificateNo: manifest.disposalCertificateNo === "Disposal certificate pending" ? "Certificate uploaded" : manifest.disposalCertificateNo }, "Manifest certified.")}>Mark Certified</SmallAction> : null}
            </div>,
          ])} />
        </Panel>
      ) : null}

      {!loading && data && view === "evidence" ? (
        <div className="space-y-6">
          <Panel title="Upload Evidence" eyebrow="Proof of service">
            <form onSubmit={submitEvidence} className="grid gap-4 md:grid-cols-2">
              <SelectField name="collectionId" label="Collection" defaultValue={data.collections[0]?.collectionId} options={data.collections.map((collection) => collection.collectionId)} />
              <SelectField name="siteId" label="Site" defaultValue={data.sites[0]?.siteId} options={data.sites.map((site) => site.siteId)} />
              <SelectField name="category" label="Category" defaultValue="Site Arrival" options={HYGIENE_PHOTO_CATEGORIES} />
              <Field name="notes" label="Notes" defaultValue="Uploaded from hygiene evidence workflow." />
              <Field name="file" label="Photo / certificate"><input name="file" type="file" accept="image/*,.pdf" className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white" /></Field>
              <div className="flex items-end">
                <button type="submit" disabled={!canUploadEvidence} className={primaryButtonClass}>Upload Evidence</button>
              </div>
            </form>
            {uploadStatus ? <p className="mt-4 rounded-xl border border-[color:var(--hygiene-success)] bg-emerald-50 p-3 text-sm font-semibold text-emerald-950">{uploadStatus}</p> : null}
          </Panel>
          <Panel title="Evidence Gallery" eyebrow="Linked media">
            <div className="mb-4 rounded-xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-300">
              <span className="font-semibold text-white">Accepted categories:</span> {HYGIENE_PHOTO_CATEGORIES.join(", ")}
            </div>
            {data.evidencePhotos.length === 0 ? (
              <EmptyState title="No evidence photos" detail="Upload service evidence from the staff workflow once photos are available." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.evidencePhotos.map((photo) => (
                  <a key={photo.photoId} href={photo.fileUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-[color:var(--hygiene-border)] bg-slate-950/35 p-4 shadow-sm transition hover:bg-slate-950/45">
                    {/\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(photo.fileUrl) || photo.category !== "Disposal Certificate" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo.fileUrl} alt={`${photo.category} evidence`} className="mb-4 h-36 w-full rounded-lg object-cover" />
                    ) : null}
                    <div className="flex items-start justify-between gap-3">
                      <PrimaryCell title={photo.category} subtitle={photo.photoId} />
                      <StatusBadge value="Completed" />
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                        <dt className="font-bold uppercase tracking-[0.08em] text-slate-400">Site</dt>
                        <dd className="mt-1 font-semibold text-slate-100">{siteById.get(photo.siteId) ?? photo.siteId}</dd>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                        <dt className="font-bold uppercase tracking-[0.08em] text-slate-400">Collection</dt>
                        <dd className="mt-1 font-semibold text-slate-100">{photo.collectionId}</dd>
                      </div>
                    </dl>
                    <p className="mt-3 line-clamp-2 text-xs font-medium leading-5 text-slate-300">{photo.notes}</p>
                  </a>
                ))}
              </div>
            )}
          </Panel>
        </div>
      ) : null}

      {!loading && data && view === "compliance" ? (
        <div className="space-y-6">
          <Panel title="Compliance Centre" eyebrow="Document control">
            <div className="mb-4 flex flex-wrap gap-2">
              {canManage ? <SmallAction variant="primary" onClick={() => openModal("compliance", "Upload Compliance Document")}>Upload Compliance Document</SmallAction> : null}
              {COMPLIANCE_DOC_TYPES.map((docType) => (
                <SmallAction key={docType} onClick={() => openModal("compliance", `Upload ${docType}`, { documentType: docType, title: docType })}>{docType}</SmallAction>
              ))}
            </div>
            <DataTable headers={["Document", "Registration", "Owner", "Expiry", "File", "Status", "Actions"]} emptyLabel="compliance documents" rows={data.complianceDocuments.map((document) => [
              <PrimaryCell key="doc" title={document.title} subtitle={document.documentType} />,
              document.registrationNumber,
              document.owner,
              formatDate(document.expiryDate),
              document.fileUrl ? <a key="file" className="text-teal-100 hover:text-white" href={document.fileUrl}>Open file</a> : "Not uploaded",
              <StatusBadge key="status" value={document.status} />,
              <div key="actions" className="flex flex-wrap gap-2">
                {canManage ? <SmallAction onClick={() => openModal("compliance", "Edit Document", document)}>Edit</SmallAction> : null}
                {canManage ? <SmallAction onClick={() => openModal("compliance", "Update Expiry / Registration", document)}>Expiry / Reg</SmallAction> : null}
                {canManage ? <SmallAction variant="success" onClick={() => void postJson(API_ROUTES.HYGIENE_COMPLIANCE, { ...document, status: "Compliance Green" }, "Document verified.")}>Mark Verified</SmallAction> : null}
                {canManage ? <SmallAction variant="warning" onClick={() => void postJson(API_ROUTES.HYGIENE_COMPLIANCE, { ...document, status: "Pending" }, "Document marked pending.")}>Mark Pending</SmallAction> : null}
                {canManage ? <SmallAction variant="danger" onClick={() => void postJson(API_ROUTES.HYGIENE_COMPLIANCE, { ...document, status: "Compliance Expired" }, "Document marked expired.")}>Mark Expired</SmallAction> : null}
                {document.fileUrl ? <a className={smallLinkClass} href={document.fileUrl}>Download File</a> : null}
              </div>,
            ])} />
          </Panel>
          <section className="grid gap-4 xl:grid-cols-2">
            <Panel title="Vehicle Inspection" eyebrow="Fleet control">
              <div className="grid gap-3">
                {data.vehicleInspections.map((inspection) => (
                  <BoardCard
                    key={inspection.inspectionId}
                    title={inspection.vehicleName}
                    subtitle={`${inspection.inspectionId} | ${formatDate(inspection.date)}`}
                    status={<StatusBadge value={inspection.status} />}
                    meta={[
                      { label: "Registration", value: inspection.vehicleRegistration },
                      { label: "Driver", value: inspection.driver },
                      { label: "Fuel", value: inspection.fuelStatus },
                      { label: "Controls", value: `PPE ${inspection.ppeAvailable ? "Yes" : "No"} | Spill kit ${inspection.spillKitAvailable ? "Yes" : "No"} | Secured ${inspection.wasteContainerSecured ? "Yes" : "No"}` },
                    ]}
                  />
                ))}
              </div>
            </Panel>
            <Panel title="Driver Accountability" eyebrow="Driver logs">
              <div className="grid gap-3">
                {data.driverLogs.map((log) => (
                  <BoardCard
                    key={log.driverLogId}
                    title={log.driverName}
                    subtitle={`${log.driverLogId} | ${formatDate(log.date)}`}
                    status={<StatusBadge value={log.signatureStatus || "Pending"} />}
                    meta={[
                      { label: "Vehicle", value: log.vehicleRegistration },
                      { label: "Fuel", value: log.fuel },
                      { label: "Collections", value: log.linkedCollectionIds.join(", ") },
                      { label: "Signature", value: log.signatureStatus },
                    ]}
                  />
                ))}
              </div>
            </Panel>
          </section>
        </div>
      ) : null}

      {!loading && data && view === "reports" ? (
        <Panel title="Monthly Hygiene Reports" eyebrow="Operational reporting" action={canManage ? <SmallAction onClick={() => openModal("report", "Generate Monthly Report")}>Generate Monthly Report</SmallAction> : null}>
          <div className="mb-4 flex flex-wrap gap-2">
            {canManage ? <SmallAction onClick={() => openModal("report", "Generate Client Service Report", { period: new Date().toISOString().slice(0, 7) })}>Generate Client Service Report</SmallAction> : null}
            {data.reports[0] ? <SmallAction onClick={() => window.print()}>Download PDF Report</SmallAction> : null}
          </div>
          <DataTable headers={["Period", "Collections", "Sites", "Bins", "Manifests", "Certificates", "Incidents", "Evidence", "Revenue"]} emptyLabel="monthly reports" rows={data.reports.map((report) => [
            <PrimaryCell key="period" title={report.period} subtitle={report.reportId} />,
            report.collectionsCompleted,
            report.sitesServiced,
            report.totalBinsServiced,
            report.manifestsCreated,
            report.disposalCertificatesPending,
            report.incidents,
            `${report.evidenceCompletionPercentage}%`,
            currency(report.revenueSummary),
          ])} />
        </Panel>
      ) : null}
    </div>
  );
}
