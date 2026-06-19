"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { API_ROUTES } from "@/lib/apiRoutes";
import { authFetch } from "@/lib/client/authFetch";
import { useAuth } from "@/context/AuthContext";
import {
  HYGIENE_PHOTO_CATEGORIES,
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
  | "compliance";

const viewLabels: Record<HygieneView, string> = {
  home: "Dashboard",
  clients: "Clients",
  sites: "Sites",
  collections: "Collections",
  manifests: "Manifests",
  assets: "Bin Assets",
  evidence: "Evidence",
  compliance: "Compliance",
};

const navItems: Array<{ view: HygieneView; href: string }> = [
  { view: "home", href: "/dashboard/hygiene" },
  { view: "clients", href: "/dashboard/hygiene/clients" },
  { view: "sites", href: "/dashboard/hygiene/sites" },
  { view: "collections", href: "/dashboard/hygiene/collections" },
  { view: "manifests", href: "/dashboard/hygiene/manifests" },
  { view: "assets", href: "/dashboard/hygiene/assets" },
  { view: "evidence", href: "/dashboard/hygiene/evidence" },
  { view: "compliance", href: "/dashboard/hygiene/compliance" },
];

function currency(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-900/60 p-6 text-sm text-slate-300">
      No {label} records found. Use the CBAVO seed action to create the first hygiene dataset.
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone = normalized.includes("complete") || normalized.includes("active") || normalized.includes("valid") || normalized.includes("passed")
    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
    : normalized.includes("pending") || normalized.includes("scheduled") || normalized.includes("soon")
      ? "border-amber-400/25 bg-amber-500/10 text-amber-100"
      : "border-slate-400/25 bg-slate-500/10 text-slate-100";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{value}</span>;
}

function TableShell({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200/80">Hygiene Register</p>
          <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-sm text-slate-200">{count} records</span>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

export default function HygieneDivisionClient({ view }: { view: HygieneView }) {
  const { role } = useAuth();
  const [data, setData] = useState<HygieneDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSeed = role === "admin" || role === "manager";
  const canUploadEvidence = role === "admin" || role === "manager" || role === "staff";
  const firstCompletedCollection = data?.collections.find((collection) => collection.status === "Completed");
  const linkedManifest = firstCompletedCollection
    ? data?.manifests.find((manifest) => manifest.manifestId === firstCompletedCollection.manifestId)
    : null;

  const siteById = useMemo(() => {
    const index = new Map<string, string>();
    data?.sites.forEach((site) => index.set(site.siteId, site.siteName));
    return index;
  }, [data?.sites]);

  async function loadData(showRefreshing = false) {
    if (showRefreshing) {
      setRefreshing(true);
    }

    setError(null);
    try {
      const response = await authFetch(API_ROUTES.HYGIENE);
      const payload = (await response.json()) as { data?: HygieneDashboardData; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Unable to load hygiene dashboard data.");
      }

      setData(payload.data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load hygiene dashboard data.";
      setError(message);
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
      const message = seedError instanceof Error ? seedError.message : "CBAVO seed action failed.";
      setError(message);
    } finally {
      setRefreshing(false);
    }
  }

  async function uploadEvidence(file: File, category: HygienePhotoCategory) {
    if (!firstCompletedCollection || !linkedManifest) {
      setUploadStatus("Seed a completed collection and manifest before uploading evidence.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("clientId", firstCompletedCollection.clientId);
    formData.append("siteId", firstCompletedCollection.siteId);
    formData.append("collectionId", firstCompletedCollection.collectionId);
    formData.append("manifestId", linkedManifest.manifestId);

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

      setUploadStatus("Evidence photo uploaded and linked.");
      await loadData(true);
    } catch (uploadError) {
      setUploadStatus(uploadError instanceof Error ? uploadError.message : "Evidence upload failed.");
    }
  }

  function handleEvidenceSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    void uploadEvidence(file, "Site Arrival");
  }

  useEffect(() => {
    void loadData();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-slate-200">
        Loading hygiene dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-100">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleEvidenceSelection}
      />

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Hygiene Division</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">CBAVO Services Onboarding</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Live hygiene operations workspace for clients, sites, bins, collections, manifests, evidence, and compliance.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={refreshing}
              className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08] disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            {canSeed ? (
              <button
                type="button"
                onClick={() => void seedDataset()}
                disabled={refreshing}
                className="rounded-full border border-cyan-300/20 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-60"
              >
                Seed CBAVO Dataset
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-full border px-3 py-2 text-sm font-medium ${
                item.view === view
                  ? "border-cyan-300/30 bg-cyan-400/15 text-cyan-100"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
              }`}
            >
              {viewLabels[item.view]}
            </Link>
          ))}
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {!data ? <EmptyState label="hygiene" /> : null}

      {data && view === "home" ? (
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Active Clients", data.kpis.activeClients],
              ["Active Contracts", data.kpis.activeContracts],
              ["Active Sites", data.kpis.activeSites],
              ["Active Bin Assets", data.kpis.activeBinAssets],
              ["Collections Due", data.kpis.collectionsDue],
              ["Collections Completed", data.kpis.collectionsCompleted],
              ["Compliance Status", data.kpis.complianceStatus],
              ["Monthly Revenue", currency(data.kpis.monthlyRevenue)],
              ["Waste Volume / Bin Services", data.kpis.wasteVolumeBinServices],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
                <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-sm font-semibold text-white">Compliance References</p>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p>Hazardous Waste Generator: GPG-15-793</p>
                <p>Waste Transport Registration: GPT-15-858</p>
                <p>Waste Classifications: HW19 Healthcare Risk Waste, GW General Waste</p>
                <p>Company Registration: 2024/105084/07</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 lg:col-span-2">
              <p className="text-sm font-semibold text-white">Operational Snapshot</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.collections.slice(0, 4).map((collection) => (
                  <div key={collection.collectionId} className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white">{siteById.get(collection.siteId) ?? collection.siteId}</p>
                      <StatusPill value={collection.status} />
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{collection.scheduledDate} | {collection.scheduledTimeWindow}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {data && view === "clients" ? (
        data.clients.length ? (
          <TableShell title="Clients" count={data.clients.length}>
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-slate-950/40 text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                <tr><th className="px-5 py-3">Client</th><th className="px-5 py-3">Contract</th><th className="px-5 py-3">Service</th><th className="px-5 py-3">Payment</th><th className="px-5 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.clients.map((client) => (
                  <tr key={client.clientId}><td className="px-5 py-4"><p className="font-medium text-white">{client.clientName}</p><p className="text-slate-400">{client.clientId} | {client.companyRegistration}</p></td><td className="px-5 py-4 text-slate-300">{client.contractStartDate} to {client.contractEndDate}</td><td className="px-5 py-4 text-slate-300">{client.serviceFrequency}, {client.collectionDay} {client.collectionWindow}</td><td className="px-5 py-4"><StatusPill value={client.paymentStatus} /></td><td className="px-5 py-4"><StatusPill value={client.status} /></td></tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        ) : <EmptyState label="client" />
      ) : null}

      {data && view === "sites" ? (
        data.sites.length ? (
          <TableShell title="Sites" count={data.sites.length}>
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-slate-950/40 text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                <tr><th className="px-5 py-3">Site</th><th className="px-5 py-3">Address</th><th className="px-5 py-3">Bins</th><th className="px-5 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">{data.sites.map((site) => <tr key={site.siteId}><td className="px-5 py-4"><p className="font-medium text-white">{site.siteName}</p><p className="text-slate-400">{site.siteId}</p></td><td className="px-5 py-4 text-slate-300">{site.address}</td><td className="px-5 py-4 text-slate-300">{site.binCount} x {site.binSize}</td><td className="px-5 py-4"><StatusPill value={site.status} /></td></tr>)}</tbody>
            </table>
          </TableShell>
        ) : <EmptyState label="site" />
      ) : null}

      {data && view === "assets" ? (
        data.assets.length ? (
          <TableShell title="Bin Assets" count={data.assets.length}>
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-slate-950/40 text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                <tr><th className="px-5 py-3">Asset</th><th className="px-5 py-3">Site</th><th className="px-5 py-3">Dates</th><th className="px-5 py-3">Condition</th><th className="px-5 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">{data.assets.map((asset) => <tr key={asset.assetId}><td className="px-5 py-4"><p className="font-medium text-white">{asset.assetId}</p><p className="text-slate-400">{asset.binSize}</p></td><td className="px-5 py-4 text-slate-300">{siteById.get(asset.siteId) ?? asset.siteId}</td><td className="px-5 py-4 text-slate-300">Install {asset.installDate}<br />Next {asset.nextServiceDate}</td><td className="px-5 py-4 text-slate-300">{asset.condition}</td><td className="px-5 py-4"><StatusPill value={asset.status} /></td></tr>)}</tbody>
            </table>
          </TableShell>
        ) : <EmptyState label="asset" />
      ) : null}

      {data && view === "collections" ? (
        data.collections.length ? (
          <TableShell title="Collection Scheduler" count={data.collections.length}>
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-slate-950/40 text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                <tr><th className="px-5 py-3">Collection</th><th className="px-5 py-3">Site</th><th className="px-5 py-3">Schedule</th><th className="px-5 py-3">Driver</th><th className="px-5 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">{data.collections.map((collection) => <tr key={collection.collectionId}><td className="px-5 py-4"><p className="font-medium text-white">{collection.collectionId}</p><p className="text-slate-400">Manifest {collection.manifestId || "pending"}</p></td><td className="px-5 py-4 text-slate-300">{siteById.get(collection.siteId) ?? collection.siteId}</td><td className="px-5 py-4 text-slate-300">{collection.scheduledDate}<br />{collection.scheduledTimeWindow}</td><td className="px-5 py-4 text-slate-300">{collection.assignedDriver}<br />{collection.vehicleRegistration}</td><td className="px-5 py-4"><StatusPill value={collection.status} /></td></tr>)}</tbody>
            </table>
          </TableShell>
        ) : <EmptyState label="collection" />
      ) : null}

      {data && view === "manifests" ? (
        data.manifests.length ? (
          <TableShell title="Waste Manifest Register" count={data.manifests.length}>
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-slate-950/40 text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                <tr><th className="px-5 py-3">Manifest</th><th className="px-5 py-3">Site</th><th className="px-5 py-3">Waste</th><th className="px-5 py-3">Quantity</th><th className="px-5 py-3">Compliance</th><th className="px-5 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">{data.manifests.map((manifest) => <tr key={manifest.manifestId}><td className="px-5 py-4"><p className="font-medium text-white">{manifest.manifestId}</p><p className="text-slate-400">{manifest.collectionDate}</p></td><td className="px-5 py-4 text-slate-300">{siteById.get(manifest.siteId) ?? manifest.siteId}</td><td className="px-5 py-4 text-slate-300">{manifest.wasteType}<br />{manifest.wasteClassification}</td><td className="px-5 py-4 text-slate-300">{manifest.quantity} {manifest.unit}</td><td className="px-5 py-4 text-slate-300">{manifest.generatorRegistration}<br />{manifest.transportRegistration}</td><td className="px-5 py-4"><StatusPill value={manifest.status} /></td></tr>)}</tbody>
            </table>
          </TableShell>
        ) : <EmptyState label="manifest" />
      ) : null}

      {data && view === "evidence" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Evidence Photos</h2>
                <p className="mt-2 text-sm text-slate-300">Categories: {HYGIENE_PHOTO_CATEGORIES.join(", ")}</p>
              </div>
              {canUploadEvidence ? (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-full border border-cyan-300/20 bg-cyan-400/15 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/20">
                  Upload Site Arrival Photo
                </button>
              ) : null}
            </div>
            {uploadStatus ? <p className="mt-4 text-sm text-slate-300">{uploadStatus}</p> : null}
          </div>
          {data.evidencePhotos.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.evidencePhotos.map((photo) => (
                <a key={photo.photoId} href={photo.downloadUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 hover:bg-white/[0.06]">
                  <p className="font-medium text-white">{photo.category}</p>
                  <p className="mt-2 text-sm text-slate-400">{photo.fileName}</p>
                  <p className="mt-1 text-xs text-slate-500">{photo.collectionId}</p>
                </a>
              ))}
            </div>
          ) : <EmptyState label="evidence photo" />}
        </div>
      ) : null}

      {data && view === "compliance" ? (
        <div className="space-y-4">
          <TableShell title="Compliance Centre" count={data.complianceDocuments.length}>
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-slate-950/40 text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                <tr><th className="px-5 py-3">Document</th><th className="px-5 py-3">Reference</th><th className="px-5 py-3">Expiry</th><th className="px-5 py-3">Alert</th><th className="px-5 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">{data.complianceDocuments.map((document) => <tr key={document.documentId}><td className="px-5 py-4 font-medium text-white">{document.title}</td><td className="px-5 py-4 text-slate-300">{document.referenceNo}</td><td className="px-5 py-4 text-slate-300">{document.expiryDate ?? "No expiry captured"}</td><td className="px-5 py-4 text-slate-300">{document.alert ?? "Clear"}</td><td className="px-5 py-4"><StatusPill value={document.status} /></td></tr>)}</tbody>
            </table>
          </TableShell>

          <section className="grid gap-4 md:grid-cols-2">
            {data.vehicleInspections.map((inspection) => (
              <div key={inspection.inspectionId} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-white">Vehicle Inspection</h3><StatusPill value={inspection.status} /></div>
                <p className="mt-3 text-sm text-slate-300">{inspection.date} | {inspection.vehicle} | {inspection.vehicleRegistration}</p>
                <p className="mt-2 text-sm text-slate-400">Driver: {inspection.driver}. PPE: {inspection.ppeAvailable ? "Available" : "Missing"}. Spill kit: {inspection.spillKitAvailable ? "Available" : "Missing"}.</p>
              </div>
            ))}
            {data.driverLogs.map((log) => (
              <div key={log.driverLogId} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <h3 className="font-semibold text-white">Driver Accountability</h3>
                <p className="mt-3 text-sm text-slate-300">{log.date} | {log.driverName} | {log.vehicleRegistration}</p>
                <p className="mt-2 text-sm text-slate-400">Fuel: {log.fuel}. Signature: {log.signatureStatus}.</p>
              </div>
            ))}
          </section>
        </div>
      ) : null}
    </div>
  );
}
