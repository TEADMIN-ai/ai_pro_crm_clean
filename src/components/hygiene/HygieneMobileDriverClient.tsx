"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type PointerEvent } from "react";
import {
  EnterpriseActionButton as ActionButton,
  EnterpriseStatusBadge as StatusBadge,
} from "@/components/ui/EnterpriseUI";
import { API_ROUTES } from "@/lib/apiRoutes";
import { authFetch } from "@/lib/client/authFetch";
import { useAuth } from "@/context/AuthContext";
import { teosDesignTokens } from "@/lib/design/teosDesignTokens";
import {
  DRIVER_COLLECTION_WORKFLOW_STEPS,
  deriveDriverWorkflowSnapshot,
  getDriverWorkflowStepState,
  getDriverWorkflowStepTimestamp,
  type DriverWorkflowStepDefinition,
  type DriverWorkflowStepState,
} from "@/lib/hygiene/hygieneWorkflow";
import type { HygieneCollection, HygieneDashboardData, HygieneManifest, HygieneSite } from "@/types/hygiene";

type MobileView = "jobs" | "job-detail" | "vehicles" | "signatures" | "disposal";

type QueuedEvent = {
  id: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

type GpsPayload = {
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy: number | null;
};

const QUEUE_KEY = "torque:hygiene:queued-events";
const allowedRoles = new Set(["admin", "manager", "staff", "driver"]);
const tokens = teosDesignTokens;
const driverThemeStyle = {
  "--hygiene-primary": tokens.color.secondary[600],
  "--hygiene-primary-strong": tokens.color.secondary[700],
  "--hygiene-info": tokens.color.info[600],
  "--hygiene-success": tokens.color.success[600],
  "--hygiene-warning": tokens.color.warning[600],
  "--hygiene-danger": tokens.color.danger[600],
  "--hygiene-neutral": tokens.color.neutral[500],
  "--hygiene-bg": tokens.color.neutral[50],
  "--hygiene-text": tokens.color.neutral[950],
  "--hygiene-text-muted": tokens.color.neutral[700],
  "--hygiene-border": tokens.color.neutral[200],
} as CSSProperties;

function getDeviceInfo(): Record<string, string | number | boolean | null> {
  if (typeof navigator === "undefined") return {};
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    online: navigator.onLine,
    viewportWidth: typeof window === "undefined" ? null : window.innerWidth,
    viewportHeight: typeof window === "undefined" ? null : window.innerHeight,
  };
}

function getGpsPayload(): Promise<GpsPayload> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ latitude: null, longitude: null, gpsAccuracy: null });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          gpsAccuracy: position.coords.accuracy,
        }),
      () => resolve({ latitude: null, longitude: null, gpsAccuracy: null }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

function stepStateClass(state: DriverWorkflowStepState): string {
  switch (state) {
    case "completed":
      return "border-[color:var(--hygiene-success)] bg-emerald-50 text-emerald-950";
    case "current":
      return "border-[color:var(--hygiene-info)] bg-sky-50 text-sky-950 shadow-sm";
    case "waiting":
      return "border-[color:var(--hygiene-warning)] bg-amber-50 text-amber-950 shadow-sm";
    case "failed":
      return "border-[color:var(--hygiene-danger)] bg-red-50 text-red-950";
    default:
      return "border-[color:var(--hygiene-neutral)] bg-slate-50 text-slate-800";
  }
}

function stepDotClass(state: DriverWorkflowStepState): string {
  switch (state) {
    case "completed":
      return "border-[color:var(--hygiene-success)] bg-[color:var(--hygiene-success)] text-white";
    case "current":
      return "border-[color:var(--hygiene-info)] bg-[color:var(--hygiene-info)] text-white";
    case "waiting":
      return "border-[color:var(--hygiene-warning)] bg-[color:var(--hygiene-warning)] text-white";
    case "failed":
      return "border-[color:var(--hygiene-danger)] bg-[color:var(--hygiene-danger)] text-white";
    default:
      return "border-[color:var(--hygiene-neutral)] bg-slate-100 text-slate-700";
  }
}

function statusBannerClass(tone: string): string {
  if (tone === "green") return "border-[color:var(--hygiene-success)] bg-[color:var(--hygiene-success)] text-white";
  if (tone === "amber") return "border-[color:var(--hygiene-warning)] bg-amber-50 text-amber-950";
  if (tone === "red") return "border-[color:var(--hygiene-danger)] bg-[color:var(--hygiene-danger)] text-white";
  return "border-[color:var(--hygiene-info)] bg-[color:var(--hygiene-info)] text-white";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Pending confirmation";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(date);
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
    <main className="mobile-safe-shell min-h-screen bg-[color:var(--hygiene-bg)] text-[color:var(--hygiene-text)]" style={driverThemeStyle}>
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-3 pb-8 pt-4">{children}</div>
    </main>
  );
}

function WorkflowProgress({ collection }: { collection: HygieneCollection }) {
  const snapshot = deriveDriverWorkflowSnapshot(collection);

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-black text-slate-950">{snapshot.progressPercentage}%</p>
          <p className="text-sm font-bold text-slate-700">
            {snapshot.completedSteps.length} / {DRIVER_COLLECTION_WORKFLOW_STEPS.length} Steps Complete
          </p>
        </div>
        <StatusBadge value={collection.status} />
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200" aria-label={`${snapshot.progressPercentage}% complete`}>
        <div
          className="h-full rounded-full bg-[color:var(--hygiene-primary)] transition-all duration-500 ease-out"
          style={{ width: `${snapshot.progressPercentage}%` }}
        />
      </div>
    </div>
  );
}

function CurrentStatusCard({ collection }: { collection: HygieneCollection }) {
  const snapshot = deriveDriverWorkflowSnapshot(collection);
  return (
    <section className={`rounded-xl border p-4 shadow-sm ${statusBannerClass(snapshot.statusTone)}`}>
      <p className="text-xs font-black uppercase tracking-[0.18em] opacity-90">Current status</p>
      <h2 className="mt-1 text-2xl font-black">{snapshot.statusLabel}</h2>
      <p className="mt-2 text-sm font-bold opacity-95">
        Active step: {DRIVER_COLLECTION_WORKFLOW_STEPS[snapshot.currentStepIndex]?.title ?? "Job Completed"}
      </p>
    </section>
  );
}

function WorkflowStepItem({
  step,
  state,
  timestamp,
  isLast,
}: {
  step: DriverWorkflowStepDefinition;
  state: DriverWorkflowStepState;
  timestamp: string;
  isLast: boolean;
}) {
  return (
    <div className="relative grid grid-cols-[44px_1fr] gap-3">
      {!isLast ? <div className="absolute left-[21px] top-11 h-full w-0.5 bg-slate-300" aria-hidden="true" /> : null}
      <div className={`z-10 flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-black ${stepDotClass(state)}`}>
        {state === "completed" ? "?" : step.stepId === "job-completed" ? "10" : DRIVER_COLLECTION_WORKFLOW_STEPS.indexOf(step) + 1}
      </div>
      <div className={`rounded-xl border p-3 ${stepStateClass(state)}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-black">{step.title}</p>
            <p className="mt-1 text-xs font-semibold">{timestamp}</p>
          </div>
          <span className="rounded-full border border-current px-2 py-1 text-[11px] font-black uppercase">
            {state === "completed" ? "Done" : state === "current" ? "Current" : state === "waiting" ? "Action" : "Pending"}
          </span>
        </div>
      </div>
    </div>
  );
}

function WorkflowTimeline({ collection }: { collection: HygieneCollection }) {
  const snapshot = deriveDriverWorkflowSnapshot(collection);
  return (
    <section className="grid gap-3 rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">Guided workflow</h2>
      {DRIVER_COLLECTION_WORKFLOW_STEPS.map((step, index) => (
        <WorkflowStepItem
          key={step.stepId}
          step={step}
          state={getDriverWorkflowStepState(step.stepId, snapshot)}
          timestamp={getDriverWorkflowStepTimestamp(snapshot, step.stepId)}
          isLast={index === DRIVER_COLLECTION_WORKFLOW_STEPS.length - 1}
        />
      ))}
    </section>
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
  const [signatureDrawn, setSignatureDrawn] = useState(false);
  const [signatureStrokeCount, setSignatureStrokeCount] = useState(0);
  const [binCount, setBinCount] = useState("0");
  const [adminOverrideReason, setAdminOverrideReason] = useState("");
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const selectedCollection = useMemo(() => {
    if (!data) return null;
    if (collectionId) return data.collections.find((collection) => collection.collectionId === collectionId) ?? null;
    return view === "jobs" ? data.collections[0] ?? null : null;
  }, [collectionId, data, view]);

  const selectedManifest = useMemo(() => getManifest(data?.manifests ?? [], selectedCollection), [data?.manifests, selectedCollection]);
  const selectedSnapshot = selectedCollection ? deriveDriverWorkflowSnapshot(selectedCollection) : null;
  const currentStep = selectedSnapshot ? DRIVER_COLLECTION_WORKFLOW_STEPS[selectedSnapshot.currentStepIndex] : null;
  const activeCollectionQuery = selectedCollection ? "?collectionId=" + encodeURIComponent(selectedCollection.collectionId) : "";
  const signatureHref = "/dashboard/hygiene/signatures" + activeCollectionQuery;
  const disposalHref = "/dashboard/hygiene/disposal" + activeCollectionQuery;

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
    const gps = await getGpsPayload();
    const eventPayload = {
      collectionId: selectedCollection.collectionId,
      ...gps,
      deviceInfo: getDeviceInfo(),
      ...payload,
    };

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

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>, category: string) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedCollection) return;
    if (!navigator.onLine) {
      setError("Photo uploads require a live connection. Text job events will queue while offline.");
      return;
    }

    const manifestId = selectedManifest?.manifestId ?? selectedCollection.manifestId;
    const gps = await getGpsPayload();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("clientId", selectedCollection.clientId);
    formData.append("siteId", selectedCollection.siteId);
    formData.append("collectionId", selectedCollection.collectionId);
    formData.append("manifestId", manifestId);
    formData.append("notes", `Mobile driver ${category.toLowerCase()} upload.`);
    formData.append("latitude", gps.latitude === null ? "" : String(gps.latitude));
    formData.append("longitude", gps.longitude === null ? "" : String(gps.longitude));
    formData.append("gpsAccuracy", gps.gpsAccuracy === null ? "" : String(gps.gpsAccuracy));
    formData.append("deviceInfo", JSON.stringify(getDeviceInfo()));

    setBusy(category);
    setError(null);
    try {
      const response = await authFetch(API_ROUTES.HYGIENE_EVIDENCE, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Photo upload failed.");
      await loadJobs();
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
    context.strokeStyle = teosDesignTokens.color.neutral[950];
    context.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    context.stroke();
    setSignatureDrawn(true);
    setSignatureStrokeCount((count) => count + 1);
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
    setSignatureDrawn(false);
    setSignatureStrokeCount(0);
  }

  async function submitSignature() {
    const canvas = signatureCanvasRef.current;
    if (!selectedCollection) {
      setError("Open a specific assigned job before capturing a customer signature.");
      return;
    }
    if (!canvas || !signatureName.trim() || !signaturePosition.trim() || !signatureDrawn || signatureStrokeCount <= 0) {
      setError("Representative name, position and a drawn signature are required.");
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
        signatureDrawn,
        signatureStrokeCount,
      },
      "Capture signature"
    );
  }

  function completeCurrentStep() {
    if (!currentStep) return;
    void submitEvent({ action: currentStep.driverAction, notes: `${currentStep.title} completed from mobile workflow.` }, currentStep.title);
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
        <div className="rounded-xl border border-slate-300 bg-white p-5 text-sm font-bold text-slate-950 shadow-sm">Loading mobile workflow...</div>
      </MobileShell>
    );
  }

  if (!allowedRoles.has(role)) {
    return (
      <MobileShell>
        <div className="rounded-xl border border-[color:var(--hygiene-danger)] bg-red-50 p-5 text-sm font-bold text-red-950 shadow-sm">Hygiene mobile access is restricted to Torque Empire operations users.</div>
      </MobileShell>
    );
  }

  const jobs = data?.collections ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const todayJobs = jobs.filter((job) => job.scheduledDate === today || job.status === "In Progress" || job.status === "Awaiting Disposal");

  return (
    <MobileShell>
      <header className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--hygiene-primary-strong)]">Torque Empire</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Hygiene Driver</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">Field workflow for assigned hygiene collections.</p>
        <nav className="mt-4 grid grid-cols-2 gap-2" aria-label="Driver navigation">
          {[
            ["Jobs", "/dashboard/hygiene/jobs"],
            ["Vehicle", "/dashboard/hygiene/vehicles"],
            ["Signatures", signatureHref],
            ["Disposal", disposalHref],
          ].map(([label, href]) => {
            const active =
              (view === "jobs" && label === "Jobs") ||
              (view === "vehicles" && label === "Vehicle") ||
              (view === "signatures" && label === "Signatures") ||
              (view === "disposal" && label === "Disposal");
            return (
              <Link
                key={href}
                className={`min-h-12 rounded-xl border px-3 py-3 text-center text-sm font-black focus:outline-none focus:ring-4 focus:ring-blue-300 ${
                  active ? "border-[color:var(--hygiene-primary)] bg-[color:var(--hygiene-primary)] text-white" : "border-slate-500 bg-white text-slate-950"
                }`}
                href={href}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      {!isOnline ? <div className="rounded-xl border border-[color:var(--hygiene-warning)] bg-amber-50 p-3 text-sm font-bold text-amber-950">Offline mode. Text events will queue locally; media uploads require connection.</div> : null}
      {queueCount > 0 ? <div className="rounded-xl border border-[color:var(--hygiene-info)] bg-sky-50 p-3 text-sm font-bold text-sky-950">{queueCount} unsynced event{queueCount === 1 ? "" : "s"} queued.</div> : null}
      {error ? <div className="rounded-xl border border-[color:var(--hygiene-danger)] bg-red-50 p-3 text-sm font-bold text-red-950">{error}</div> : null}

      {view === "jobs" ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-black text-slate-950">Today&apos;s assigned jobs</h2>
          {(todayJobs.length ? todayJobs : jobs).map((job) => {
            const snapshot = deriveDriverWorkflowSnapshot(job);
            const activeStep = DRIVER_COLLECTION_WORKFLOW_STEPS[snapshot.currentStepIndex]?.title ?? "Job Completed";
            return (
              <Link key={job.collectionId} href={`/dashboard/hygiene/jobs/${job.collectionId}`} className="rounded-xl border border-slate-300 bg-white p-5 text-slate-950 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-300">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{job.collectionId}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{getSiteName(data?.sites ?? [], job.siteId)}</p>
                  </div>
                  <StatusBadge value={job.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs font-black uppercase text-slate-600">Progress</p>
                    <p className="text-xl font-black text-[color:var(--hygiene-primary-strong)]">{snapshot.progressPercentage}%</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-600">Completed</p>
                    <p className="text-xl font-black text-slate-950">{snapshot.completedSteps.length} / 10</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs font-black uppercase text-slate-600">Current workflow step</p>
                    <p className="font-black text-slate-950">{activeStep}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs font-black uppercase text-slate-600">Last updated</p>
                    <p className="font-semibold text-slate-700">{formatDate(job.updatedAt ?? job.completedAt ?? job.arrivalTime ?? job.scheduledDate)}</p>
                  </div>
                </div>
              </Link>
            );
          })}
          {!jobs.length ? <div className="rounded-xl border border-dashed border-slate-500 bg-white p-5 font-bold text-slate-800">No assigned hygiene jobs are available.</div> : null}
        </section>
      ) : null}

      {view !== "jobs" && !selectedCollection ? <div className="rounded-xl border border-[color:var(--hygiene-danger)] bg-red-50 p-4 text-sm font-bold text-red-950">Open a specific assigned job before capturing evidence for this workflow.</div> : null}

      {view !== "jobs" && selectedCollection ? (
        <section className="grid gap-4">
          <div className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[color:var(--hygiene-primary-strong)]">Active job</p>
                <h2 className="mt-2 text-xl font-black text-slate-950">{selectedCollection.collectionId}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-700">{getSiteName(data?.sites ?? [], selectedCollection.siteId)}</p>
              </div>
              <StatusBadge value={selectedCollection.status} />
            </div>
          </div>

          <WorkflowProgress collection={selectedCollection} />
          <CurrentStatusCard collection={selectedCollection} />

          {view === "job-detail" ? (
            <>
              <WorkflowTimeline collection={selectedCollection} />
              <div className="grid gap-3 rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
                <p className="text-sm font-black uppercase text-slate-600">Next required action</p>
                <h2 className="text-xl font-black text-slate-950">{currentStep?.title ?? "Job Completed"}</h2>
                {currentStep?.stepId === "evidence-photos-captured" ? (
                  <label className="min-h-12 rounded-xl border border-[color:var(--hygiene-primary)] bg-[color:var(--hygiene-primary)] px-4 py-3 text-sm font-black text-white shadow-sm focus-within:ring-4 focus-within:ring-blue-300">
                    Capture Evidence Photo
                    <input className="hidden" type="file" accept="image/*" capture="environment" onChange={(event) => void uploadPhoto(event, "Completion Photo")} />
                  </label>
                ) : currentStep?.stepId === "customer-signature" ? (
                  <Link className="min-h-12 rounded-xl border border-[color:var(--hygiene-primary)] bg-[color:var(--hygiene-primary)] px-4 py-3 text-center text-sm font-black text-white shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-300" href={signatureHref}>Capture Customer Signature</Link>
                ) : currentStep?.stepId === "bin-serviced" ? (
                  <div className="grid gap-2">
                    <label className="grid gap-1 text-sm font-black text-slate-950">
                      Confirmed bin count
                      <input inputMode="numeric" value={binCount} onChange={(event) => setBinCount(event.target.value)} className="min-h-12 rounded-xl border border-slate-500 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-300" />
                    </label>
                    <ActionButton onClick={() => submitEvent({ action: "bin-serviced", quantity: Number(binCount) || 0, notes: `${Number(binCount) || 0} bins serviced.` }, "Bin serviced")} disabled={busy !== null}>Complete Bin Serviced</ActionButton>
                  </div>
                ) : currentStep?.stepId === "job-completed" ? (
                  <div className="grid gap-2">
                    <label className="grid gap-1 text-sm font-black text-slate-950">
                      Admin override reason
                      <textarea value={adminOverrideReason} onChange={(event) => setAdminOverrideReason(event.target.value)} className="min-h-24 rounded-xl border border-slate-500 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-300" placeholder="Only required when validation must be overridden." />
                    </label>
                    <ActionButton onClick={() => submitEvent({ action: "complete-job", adminOverrideReason, notes: "Driver completed job workflow." }, "Complete job")} disabled={busy !== null}>Complete Job</ActionButton>
                  </div>
                ) : (
                  <ActionButton onClick={completeCurrentStep} disabled={busy !== null || !currentStep}>{currentStep ? `Complete ${currentStep.title}` : "Workflow Complete"}</ActionButton>
                )}
              </div>
            </>
          ) : null}

          {view === "vehicles" ? (
            <div className="grid gap-3">
              <div className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
                <p className="text-sm font-black uppercase text-slate-600">Vehicle</p>
                <p className="mt-1 text-xl font-black text-slate-950">{selectedCollection.vehicleName}</p>
                <p className="font-semibold text-slate-700">{selectedCollection.vehicleRegistration}</p>
              </div>
              <ActionButton onClick={() => submitEvent({ action: "vehicle-inspection", notes: "Vehicle inspection completed from mobile workflow." }, "Vehicle inspection")}>Complete Vehicle Inspection</ActionButton>
            </div>
          ) : null}

          {view === "signatures" ? (
            <div className="grid gap-3 rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
              <label className="grid gap-1 text-sm font-black text-slate-950">
                Representative name
                <input className="min-h-12 rounded-xl border border-slate-500 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-300" placeholder="Representative name" value={signatureName} onChange={(event) => setSignatureName(event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm font-black text-slate-950">
                Position
                <input className="min-h-12 rounded-xl border border-slate-500 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-300" placeholder="Position" value={signaturePosition} onChange={(event) => setSignaturePosition(event.target.value)} />
              </label>
              <canvas
                ref={signatureCanvasRef}
                width={640}
                height={240}
                className="h-40 w-full touch-none rounded-xl border border-slate-500 bg-white"
                onPointerDown={startSignature}
                onPointerMove={drawSignature}
                onPointerUp={() => {
                  drawingRef.current = false;
                }}
                onPointerLeave={() => {
                  drawingRef.current = false;
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <ActionButton variant="secondary" onClick={clearSignature}>Clear</ActionButton>
                <ActionButton onClick={submitSignature}>Save Signature</ActionButton>
              </div>
            </div>
          ) : null}

          {view === "disposal" ? (
            <div className="rounded-xl border border-[color:var(--hygiene-warning)] bg-amber-50 p-5 text-amber-950 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em]">Disposal status</p>
              <h2 className="mt-2 text-xl font-black">Disposal confirmation required</h2>
              <p className="mt-2 text-sm font-semibold">Manifest {selectedManifest?.manifestId ?? selectedCollection.manifestId} remains pending until disposal is confirmed.</p>
              <div className="mt-4">
                <ActionButton variant="warning" onClick={() => submitEvent({ action: "confirm-disposal", notes: "Disposal confirmed from mobile workflow." }, "Disposal confirmation")}>Confirm Disposal</ActionButton>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </MobileShell>
  );
}
