"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { API_ROUTES } from "@/lib/apiRoutes";
import { authFetch } from "@/lib/client/authFetch";
import { useAuth } from "@/context/AuthContext";
import {
  HYGIENE_PHOTO_CATEGORIES,
  type HygieneCollection,
  type HygieneDashboardData,
  type HygienePhotoCategory,
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
  | "reports";

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
];

function currency(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not captured";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(date);
}

function statusTone(value: string): string {
  if (["Active", "Completed", "Passed", "Paid", "Compliance Green", "Certificate Received"].includes(value)) {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
  }

  if (["Pending", "Scheduled", "Disposal Pending", "Compliance Warning", "In Progress"].includes(value)) {
    return "border-amber-400/25 bg-amber-500/10 text-amber-100";
  }

  if (["Overdue", "Compliance Expired", "Failed"].includes(value)) {
    return "border-rose-400/25 bg-rose-500/10 text-rose-100";
  }

  return "border-slate-400/25 bg-slate-500/10 text-slate-100";
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(value)}`}>
      {value}
    </span>
  );
}

function Panel({
  title,
  eyebrow,
  action,
  children,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-sm">
      <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">{eyebrow}</p> : null}
          <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-950/40 p-6">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
    </div>
  );
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
      <table className="min-w-full divide-y divide-white/10 text-sm">
        <thead className="bg-slate-950/50 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-5 py-3 font-semibold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-5 py-4 text-slate-300">{cell}</td>
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
    <div>
      <p className="font-medium text-white">{title}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

function KpiCard({ label, value, helper }: { label: string; value: ReactNode; helper: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
      <p className="mt-2 text-sm text-slate-400">{helper}</p>
    </div>
  );
}

function WorkflowCard({ collection }: { collection: HygieneCollection }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <PrimaryCell title={collection.collectionId} subtitle={`${formatDate(collection.scheduledDate)} | ${collection.scheduledTimeWindow}`} />
        <StatusBadge value={collection.status} />
      </div>
      <div className="mt-4 grid gap-2">
        {collection.workflowSteps.map((step) => (
          <div key={step.stepId} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
            <span className="text-sm text-slate-300">{step.label}</span>
            <StatusBadge value={step.status} />
          </div>
        ))}
      </div>
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSeed = role === "admin" || role === "manager";
  const canUploadEvidence = role === "admin" || role === "manager" || role === "staff";

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
      const response = await authFetch(API_ROUTES.HYGIENE);
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

  function handleEvidenceSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadEvidence(file, "Site Arrival");
  }

  useEffect(() => {
    if (!authLoading) {
      void loadData();
    }
  }, [authLoading]);

  return (
    <div className="space-y-6 text-slate-100">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleEvidenceSelection} />

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Hygiene Division</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">CBAVO Services Operations Dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Internal Torque Empire workspace for hygiene scheduling, driver workflow, digital manifests, evidence, compliance, and monthly reporting.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadData(true)} disabled={refreshing} className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08] disabled:opacity-60">
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            {canSeed ? (
              <button type="button" onClick={() => void seedDataset()} disabled={refreshing} className="rounded-full border border-cyan-300/20 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-60">
                Seed CBAVO
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`whitespace-nowrap rounded-full border px-3 py-2 text-sm font-medium ${item.view === view ? "border-cyan-300/30 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"}`}>
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      {loading || authLoading ? <LoadingState /> : null}

      {!loading && error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</div>
      ) : null}

      {!loading && !error && !data ? (
        <EmptyState title="No hygiene data" detail="Seed the CBAVO dataset to create the first hygiene operating records." />
      ) : null}

      {!loading && data && view === "home" ? (
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
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
          <Panel title="Client Register" eyebrow="Accounts">
            <DataTable headers={["Client", "Contact", "Contract", "Service", "Payment", "Status"]} emptyLabel="clients" rows={data.clients.map((client) => [
              <PrimaryCell key="client" title={client.clientName} subtitle={`${client.clientType} | ${client.companyRegistration}`} />,
              <PrimaryCell key="contact" title={client.primaryContactName} subtitle={`${client.primaryContactPhone} | ${client.primaryContactEmail}`} />,
              `${formatDate(client.contractStartDate)} to ${formatDate(client.contractEndDate)}`,
              `${client.serviceFrequency}, ${client.collectionDay} ${client.collectionWindow}`,
              <StatusBadge key="payment" value={client.paymentStatus} />,
              <StatusBadge key="status" value={client.status} />,
            ])} />
          </Panel>
          {data.clients.map((client) => (
            <Panel key={client.clientId} title={`${client.clientName} Detail`} eyebrow="Client profile">
              <div className="grid gap-4 md:grid-cols-3">
                <KpiCard label="Sites" value={data.sites.filter((site) => site.clientId === client.clientId).length} helper="Linked service points" />
                <KpiCard label="Bin Assets" value={data.assets.filter((asset) => asset.clientId === client.clientId).length} helper="Tracked bins" />
                <KpiCard label="Revenue" value={currency(client.monthlyRevenue)} helper="Monthly contract value" />
              </div>
            </Panel>
          ))}
        </div>
      ) : null}

      {!loading && data && view === "sites" ? (
        <Panel title="Site Register" eyebrow="Service locations">
          <DataTable headers={["Site", "Address", "Contact", "Bins", "Service", "Status"]} emptyLabel="sites" rows={data.sites.map((site) => [
            <PrimaryCell key="site" title={site.siteName} subtitle={`${site.siteId} | ${clientById.get(site.clientId) ?? site.clientId}`} />,
            <PrimaryCell key="address" title={site.address} subtitle={`${site.suburb}, ${site.city}`} />,
            <PrimaryCell key="contact" title={site.contactPerson} subtitle={site.contactPhone} />,
            `${site.binCount} x ${site.binSize}`,
            <PrimaryCell key="service" title={site.serviceFrequency} subtitle={`Next ${formatDate(site.nextServiceDate)}`} />,
            <StatusBadge key="status" value={site.status} />,
          ])} />
        </Panel>
      ) : null}

      {!loading && data && view === "assets" ? (
        <Panel title="Bin Asset Register" eyebrow="Tracked assets">
          <DataTable headers={["Asset", "Site", "Type", "Service Dates", "Condition", "Status"]} emptyLabel="bin assets" rows={data.assets.map((asset) => [
            <PrimaryCell key="asset" title={asset.assetId} subtitle={asset.locationDescription} />,
            siteById.get(asset.siteId) ?? asset.siteId,
            `${asset.binSize} ${asset.binType}`,
            <PrimaryCell key="dates" title={`Last ${formatDate(asset.lastServiceDate)}`} subtitle={`Next ${formatDate(asset.nextServiceDate)}`} />,
            <PrimaryCell key="condition" title={asset.condition} subtitle={asset.notes} />,
            <StatusBadge key="status" value={asset.status} />,
          ])} />
        </Panel>
      ) : null}

      {!loading && data && view === "collections" ? (
        <div className="space-y-6">
          <Panel title="Collection Scheduler" eyebrow="Dispatch and route control">
            <DataTable headers={["Collection", "Client / Site", "Schedule", "Driver / Vehicle", "Signature", "Status"]} emptyLabel="collections" rows={data.collections.map((collection) => [
              <PrimaryCell key="collection" title={collection.collectionId} subtitle={`Manifest ${collection.manifestId}`} />,
              <PrimaryCell key="client" title={clientById.get(collection.clientId) ?? collection.clientId} subtitle={siteById.get(collection.siteId) ?? collection.siteId} />,
              <PrimaryCell key="schedule" title={formatDate(collection.scheduledDate)} subtitle={collection.scheduledTimeWindow} />,
              <PrimaryCell key="driver" title={collection.assignedDriver} subtitle={`${collection.vehicleName} | ${collection.vehicleRegistration}`} />,
              collection.clientSignatureStatus,
              <StatusBadge key="status" value={collection.status} />,
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
        <Panel title="Waste Manifest Register" eyebrow="Chain of custody">
          <DataTable headers={["Manifest", "Site", "Waste", "Quantity", "Transport", "Disposal", "Status"]} emptyLabel="manifests" rows={data.manifests.map((manifest) => [
            <PrimaryCell key="manifest" title={manifest.manifestId} subtitle={`Collection ${manifest.collectionId}`} />,
            siteById.get(manifest.siteId) ?? manifest.siteId,
            <PrimaryCell key="waste" title={manifest.wasteType} subtitle={manifest.wasteClassification} />,
            `${manifest.quantity} ${manifest.unit}`,
            <PrimaryCell key="transport" title={manifest.collectedBy} subtitle={manifest.vehicleRegistration} />,
            <PrimaryCell key="disposal" title={manifest.disposalFacility} subtitle={`Certificate ${manifest.disposalCertificateNo}`} />,
            <StatusBadge key="status" value={manifest.status} />,
          ])} />
        </Panel>
      ) : null}

      {!loading && data && view === "evidence" ? (
        <div className="space-y-6">
          <Panel title="Evidence Gallery" eyebrow="Proof of service" action={canUploadEvidence ? <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-full border border-cyan-300/20 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/20">Upload Evidence</button> : null}>
            <div className="mb-4 rounded-xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-300">
              <span className="font-semibold text-white">Accepted categories:</span> {HYGIENE_PHOTO_CATEGORIES.join(", ")}
              {uploadStatus ? <p className="mt-2 text-cyan-100">{uploadStatus}</p> : null}
            </div>
            {data.evidencePhotos.length === 0 ? (
              <EmptyState title="No evidence photos" detail="Upload service evidence from the staff workflow once photos are available." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.evidencePhotos.map((photo) => (
                  <a key={photo.photoId} href={photo.fileUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 transition hover:bg-white/[0.06]">
                    <div className="flex items-start justify-between gap-3">
                      <PrimaryCell title={photo.category} subtitle={photo.photoId} />
                      <StatusBadge value="Completed" />
                    </div>
                    <p className="mt-4 text-sm text-slate-400">{siteById.get(photo.siteId) ?? photo.siteId} | {photo.collectionId}</p>
                    <p className="mt-2 text-sm text-slate-500">{photo.notes}</p>
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
            <DataTable headers={["Document", "Registration", "Owner", "Expiry", "File", "Status"]} emptyLabel="compliance documents" rows={data.complianceDocuments.map((document) => [
              <PrimaryCell key="doc" title={document.title} subtitle={document.documentType} />,
              document.registrationNumber,
              document.owner,
              formatDate(document.expiryDate),
              document.fileUrl ? <a key="file" className="text-cyan-200 hover:text-cyan-100" href={document.fileUrl}>Open file</a> : "Not uploaded",
              <StatusBadge key="status" value={document.status} />,
            ])} />
          </Panel>
          <section className="grid gap-4 xl:grid-cols-2">
            <Panel title="Vehicle Inspection" eyebrow="Fleet control">
              <DataTable headers={["Inspection", "Vehicle", "Driver", "Fuel", "Controls", "Status"]} emptyLabel="vehicle inspections" rows={data.vehicleInspections.map((inspection) => [
                <PrimaryCell key="inspection" title={inspection.inspectionId} subtitle={formatDate(inspection.date)} />,
                <PrimaryCell key="vehicle" title={inspection.vehicleName} subtitle={inspection.vehicleRegistration} />,
                inspection.driver,
                inspection.fuelStatus,
                `PPE ${inspection.ppeAvailable ? "Yes" : "No"} | Spill kit ${inspection.spillKitAvailable ? "Yes" : "No"} | Secured ${inspection.wasteContainerSecured ? "Yes" : "No"}`,
                <StatusBadge key="status" value={inspection.status} />,
              ])} />
            </Panel>
            <Panel title="Driver Accountability" eyebrow="Driver logs">
              <DataTable headers={["Log", "Driver", "Vehicle", "Fuel", "Collections", "Signature"]} emptyLabel="driver logs" rows={data.driverLogs.map((log) => [
                <PrimaryCell key="log" title={log.driverLogId} subtitle={formatDate(log.date)} />,
                log.driverName,
                log.vehicleRegistration,
                log.fuel,
                log.linkedCollectionIds.join(", "),
                log.signatureStatus,
              ])} />
            </Panel>
          </section>
        </div>
      ) : null}

      {!loading && data && view === "reports" ? (
        <Panel title="Monthly Hygiene Reports" eyebrow="Operational reporting">
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
