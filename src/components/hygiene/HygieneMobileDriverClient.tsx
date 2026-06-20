"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent } from "react";
import { API_ROUTES } from "@/lib/apiRoutes";
import { authFetch } from "@/lib/client/authFetch";
import { useAuth } from "@/context/AuthContext";
import type { HygieneCollection, HygieneDashboardData, HygieneManifest, HygieneSite } from "@/types/hygiene";

type MobileView = "jobs" | "job-detail" | "vehicles" | "signatures" | "disposal";

type QueuedEvent = {
  id: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

const QUEUE_KEY = "torque:hygiene:queued-events";
const allowedRoles = new Set(["admin", "manager", "staff", "driver"]);

function statusClass(status: string): string {
  if (["Completed", "Active", "Passed"].includes(status)) return "border-emerald-400/30 bg-emerald-500/12 text-emerald-100";
  if (["In Progress", "Scheduled", "Disposal Pending", "Pending"].includes(status)) return "border-amber-400/30 bg-amber-500/12 text-amber-100";
  if (["Overdue", "Failed", "Compliance Expired"].includes(status)) return "border-rose-400/30 bg-rose-500/12 text-rose-100";
  return "border-slate-400/25 bg-slate-500/10 text-slate-100";
}

function StatusBadge({ value }: { value: string }) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(value)}`}>{value}</span>;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Pending confirmation";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium" }).format(date);
}

function readQueue(): QueuedEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedEvent[];
  } catch {
    return [];
  }
}

function writeQueue(events: QueuedEvent[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(events));
}

function getSiteName(sites: HygieneSite[], siteId: string): string {
  return sites.find((site) => site.siteId === siteId)?.siteName ?? siteId;
}

function getManifest(manifests: HygieneManifest[], collection: HygieneCollection | null): HygieneManifest | null {
  if (!collection) return null;
  return manifests.find((manifest) => manifest.collectionId === collection.collectionId) ?? null;
}

function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mobile-safe-shell bg-[#07111f] text-slate-100">
      <div className="mx-auto flex max-w-xl flex-col gap-4">{children}</div>
    </main>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "primary" | "secondary" | "warning";
}) {
  const toneClass =
    tone === "primary"
      ? "border-cyan-300/25 bg-cyan-400/18 text-cyan-50"
      : tone === "warning"
        ? "border-amber-300/25 bg-amber-400/14 text-amber-50"
        : "border-white/10 bg-white/[0.06] text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-12 rounded-2xl border px-4 py-3 text-left text-sm font-bold shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
    >
      {children}
    </button>
  );
}

export default function HygieneMobileDriverClient({
  view,
  collectionId,
}: {
  view: MobileView;
  collectionId?: string;
}) {
  const { role, loading: authLoading } = useAuth();
  const [data, setData] = useState<HygieneDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState("");
  const [signaturePosition, setSignaturePosition] = useState("");
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const selectedCollection = useMemo(() => {
    if (!data) return null;
    return data.collections.find((collection) => collection.collectionId === collectionId) ?? data.collections[0] ?? null;
  }, [collectionId, data]);

  const selectedManifest = useMemo(() => getManifest(data?.manifests ?? [], selectedCollection), [data?.manifests, selectedCollection]);

  async function loadJobs() {
    setError(null);
    try {
      const response = await authFetch(API_ROUTES.HYGIENE_JOBS);
      const payload = (await response.json()) as { data?: HygieneDashboardData; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "Unable to load hygiene jobs.");
      setData(payload.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load hygiene jobs.");
    } finally {
      setLoading(false);
    }
  }

  async function flushQueue() {
    if (!navigator.onLine) return;
    const queue = readQueue();
    if (!queue.length) {
      setQueueCount(0);
      return;
    }

    const remaining: QueuedEvent[] = [];
    for (const queued of queue) {
      try {
        const response = await authFetch(API_ROUTES.HYGIENE_JOBS, {
          method: "POST",
          body: JSON.stringify(queued.payload),
        });
        if (!response.ok) remaining.push(queued);
      } catch {
        remaining.push(queued);
      }
    }

    writeQueue(remaining);
    setQueueCount(remaining.length);
    if (remaining.length !== queue.length) void loadJobs();
  }

  async function submitEvent(payload: Record<string, unknown>, label: string) {
    if (!selectedCollection) return;
    const eventPayload = { collectionId: selectedCollection.collectionId, ...payload };
    if (!navigator.onLine) {
      const nextQueue = [...readQueue(), { id: `${Date.now()}`, payload: eventPayload, createdAt: new Date().toISOString() }];
      writeQueue(nextQueue);
      setQueueCount(nextQueue.length);
      setError(null);
      return;
    }

    setBusy(label);
    setError(null);
    try {
      const response = await authFetch(API_ROUTES.HYGIENE_JOBS, {
        method: "POST",
        body: JSON.stringify(eventPayload),
      });
      const payloadResponse = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payloadResponse.error ?? `${label} failed.`);
      await loadJobs();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : `${label} failed.`);
    } finally {
      setBusy(null);
    }
  }

  async function captureArrival() {
    const submit = (coords?: GeolocationCoordinates) =>
      submitEvent(
        {
          action: "arrival",
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          notes: coords ? "Arrival captured with GPS permission." : "Arrival captured without GPS.",
        },
        "Capture arrival"
      );

    if (!navigator.geolocation) {
      await submit();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => void submit(position.coords),
      () => void submit(),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>, category: string) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedCollection || !selectedManifest) return;
    if (!navigator.onLine) {
      setError("Photo uploads require a live connection. Text job events will queue while offline.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("clientId", selectedCollection.clientId);
    formData.append("siteId", selectedCollection.siteId);
    formData.append("collectionId", selectedCollection.collectionId);
    formData.append("manifestId", selectedManifest.manifestId);
    formData.append("notes", `Mobile driver ${category.toLowerCase()} upload.`);

    setBusy(category);
    setError(null);
    try {
      const response = await authFetch(API_ROUTES.HYGIENE_EVIDENCE, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Photo upload failed.");
      await submitEvent({ action: category.includes("Before") ? "before-photo" : "after-photo", notes: `${category} uploaded.` }, category);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Photo upload failed.");
    } finally {
      setBusy(null);
    }
  }

  function drawSignature(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !drawingRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext("2d");
    if (!context) return;
    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#e5eefb";
    context.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    context.stroke();
  }

  function startSignature(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const rect = canvas.getBoundingClientRect();
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(event.clientX - rect.left, event.clientY - rect.top);
  }

  function clearSignature() {
    const canvas = signatureCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function submitSignature() {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !signatureName.trim() || !signaturePosition.trim()) {
      setError("Representative name, position and signature are required.");
      return;
    }
    if (!navigator.onLine) {
      setError("Signature capture requires a live connection so the signed image can be stored securely.");
      return;
    }

    await submitEvent(
      {
        action: "signature",
        representativeName: signatureName.trim(),
        representativePosition: signaturePosition.trim(),
        signatureDataUrl: canvas.toDataURL("image/png"),
      },
      "Capture signature"
    );
  }

  useEffect(() => {
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    setQueueCount(readQueue().length);
    const online = () => {
      setIsOnline(true);
      void flushQueue();
    };
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  useEffect(() => {
    if (!authLoading) void loadJobs();
  }, [authLoading]);

  if (authLoading || loading) {
    return (
      <MobileShell>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">Loading mobile workflow...</div>
      </MobileShell>
    );
  }

  if (!allowedRoles.has(role)) {
    return (
      <MobileShell>
        <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-5 text-rose-100">Hygiene mobile access is restricted to Torque Empire operations users.</div>
      </MobileShell>
    );
  }

  const jobs = data?.collections ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const todayJobs = jobs.filter((job) => job.scheduledDate === today || job.status === "In Progress");

  return (
    <MobileShell>
      <header className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">Torque Empire</p>
        <h1 className="mt-2 text-2xl font-bold">Hygiene Driver</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">Mobile workflow for assigned hygiene collections.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="rounded-full border border-white/10 px-3 py-2 text-sm font-bold" href="/dashboard/hygiene/jobs">Jobs</Link>
          <Link className="rounded-full border border-white/10 px-3 py-2 text-sm font-bold" href="/dashboard/hygiene/vehicles">Vehicle</Link>
          <Link className="rounded-full border border-white/10 px-3 py-2 text-sm font-bold" href="/dashboard/hygiene/signatures">Signatures</Link>
          <Link className="rounded-full border border-white/10 px-3 py-2 text-sm font-bold" href="/dashboard/hygiene/disposal">Disposal</Link>
        </div>
      </header>

      {!isOnline ? <div className="rounded-2xl border border-amber-300/30 bg-amber-500/12 p-3 text-sm font-semibold text-amber-100">Offline mode. Text events will queue locally; media uploads require connection.</div> : null}
      {queueCount > 0 ? <div className="rounded-2xl border border-cyan-300/25 bg-cyan-400/12 p-3 text-sm text-cyan-100">{queueCount} unsynced event{queueCount === 1 ? "" : "s"} queued.</div> : null}
      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}

      {view === "jobs" ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-bold">Today&apos;s assigned jobs</h2>
          {(todayJobs.length ? todayJobs : jobs).map((job) => (
            <Link key={job.collectionId} href={`/dashboard/hygiene/jobs/${job.collectionId}`} className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-white">{job.collectionId}</p>
                  <p className="mt-1 text-sm text-slate-300">{getSiteName(data?.sites ?? [], job.siteId)}</p>
                </div>
                <StatusBadge value={job.status} />
              </div>
              <p className="mt-4 text-sm text-slate-400">{formatDate(job.scheduledDate)} | {job.scheduledTimeWindow}</p>
            </Link>
          ))}
          {!jobs.length ? <div className="rounded-3xl border border-dashed border-slate-600 p-5 text-slate-300">No assigned hygiene jobs are available.</div> : null}
        </section>
      ) : null}

      {view !== "jobs" && selectedCollection ? (
        <section className="grid gap-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Active job</p>
                <h2 className="mt-2 text-xl font-bold">{selectedCollection.collectionId}</h2>
                <p className="mt-1 text-sm text-slate-300">{getSiteName(data?.sites ?? [], selectedCollection.siteId)}</p>
              </div>
              <StatusBadge value={selectedCollection.status} />
            </div>
          </div>

          {view === "job-detail" ? (
            <>
              <ActionButton onClick={() => submitEvent({ action: "start-job" }, "Start job")} disabled={busy !== null}>1. Start job</ActionButton>
              <ActionButton onClick={captureArrival} disabled={busy !== null}>2. Capture arrival time and GPS</ActionButton>
              <label className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold">
                3. Upload before-service photo
                <input className="hidden" type="file" accept="image/*" capture="environment" onChange={(event) => void uploadPhoto(event, "Bin Before Service")} />
              </label>
              <ActionButton onClick={() => submitEvent({ action: "checklist", checklist: { linerRemoved: true, bagSealed: true, transportContainerLoaded: true } }, "Checklist")} disabled={busy !== null}>4. Complete service checklist</ActionButton>
              <label className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-bold">
                5. Upload completion photo
                <input className="hidden" type="file" accept="image/*" capture="environment" onChange={(event) => void uploadPhoto(event, "Completion Photo")} />
              </label>
              <ActionButton onClick={() => submitEvent({ action: "quantity", quantity: selectedManifest?.quantity ?? 0 }, "Quantity")} disabled={busy !== null}>6. Confirm quantity collected</ActionButton>
              <ActionButton onClick={() => submitEvent({ action: "manifest", manifestId: selectedManifest?.manifestId ?? selectedCollection.manifestId }, "Manifest")} disabled={busy !== null}>7. Generate or attach manifest</ActionButton>
              <Link className="rounded-2xl border border-cyan-300/25 bg-cyan-400/18 px-4 py-3 text-sm font-bold text-cyan-50" href="/dashboard/hygiene/signatures">8. Capture client signature</Link>
              <ActionButton tone="warning" onClick={() => submitEvent({ action: "awaiting-disposal" }, "Awaiting disposal")} disabled={busy !== null}>9. Mark collection as Awaiting Disposal</ActionButton>
            </>
          ) : null}

          {view === "vehicles" ? (
            <div className="grid gap-3">
              <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5">
                <p className="text-sm text-slate-400">Vehicle</p>
                <p className="mt-1 text-xl font-bold">{selectedCollection.vehicleName}</p>
                <p className="text-slate-300">{selectedCollection.vehicleRegistration}</p>
              </div>
              <ActionButton onClick={() => submitEvent({ action: "vehicle-inspection", notes: "Vehicle inspection completed from mobile workflow." }, "Vehicle inspection")}>Complete vehicle inspection</ActionButton>
            </div>
          ) : null}

          {view === "signatures" ? (
            <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.05] p-5">
              <input className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white" placeholder="Representative name" value={signatureName} onChange={(event) => setSignatureName(event.target.value)} />
              <input className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white" placeholder="Position" value={signaturePosition} onChange={(event) => setSignaturePosition(event.target.value)} />
              <canvas
                ref={signatureCanvasRef}
                width={640}
                height={240}
                className="h-40 w-full touch-none rounded-2xl border border-white/10 bg-slate-950"
                onPointerDown={startSignature}
                onPointerMove={drawSignature}
                onPointerUp={() => { drawingRef.current = false; }}
                onPointerLeave={() => { drawingRef.current = false; }}
              />
              <div className="grid grid-cols-2 gap-2">
                <ActionButton tone="secondary" onClick={clearSignature}>Clear</ActionButton>
                <ActionButton onClick={submitSignature}>Save signature</ActionButton>
              </div>
            </div>
          ) : null}

          {view === "disposal" ? (
            <div className="rounded-3xl border border-amber-300/30 bg-amber-500/12 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-100">Disposal status</p>
              <h2 className="mt-2 text-xl font-bold">Awaiting disposal confirmation</h2>
              <p className="mt-2 text-sm text-amber-50/85">Manifest {selectedManifest?.manifestId ?? selectedCollection.manifestId} remains disposal pending until the office captures the disposal facility and certificate.</p>
              <div className="mt-4"><ActionButton tone="warning" onClick={() => submitEvent({ action: "awaiting-disposal" }, "Awaiting disposal")}>Sync awaiting disposal</ActionButton></div>
            </div>
          ) : null}
        </section>
      ) : null}
    </MobileShell>
  );
}
