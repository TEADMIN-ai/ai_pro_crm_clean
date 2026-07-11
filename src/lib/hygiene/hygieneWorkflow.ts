import type { HygieneCollection } from "@/types/hygiene";

export type DriverWorkflowStepId =
  | "job-accepted"
  | "travelling-to-site"
  | "arrived-on-site"
  | "waste-collection"
  | "bin-serviced"
  | "evidence-photos-captured"
  | "customer-signature"
  | "waste-loaded"
  | "disposal-facility-confirmation"
  | "job-completed";

export type DriverWorkflowStepState = "not-started" | "current" | "completed" | "waiting" | "failed";

export interface DriverWorkflowStepDefinition {
  stepId: DriverWorkflowStepId;
  title: string;
  icon: DriverWorkflowIcon;
  driverAction: string;
  waiting?: boolean;
}

export type DriverWorkflowIcon =
  | "search"
  | "conversation"
  | "document"
  | "shield-check"
  | "check-circle"
  | "vehicle";

export interface DriverWorkflowSnapshot {
  collectionId: string;
  completedSteps: DriverWorkflowStepId[];
  currentStep: DriverWorkflowStepId;
  currentStepIndex: number;
  progressPercentage: number;
  remainingSteps: number;
  stepTimestamps: Partial<Record<DriverWorkflowStepId, string>>;
  statusLabel: string;
  statusTone: "blue" | "green" | "amber" | "red" | "slate";
}

export const DRIVER_COLLECTION_WORKFLOW_STEPS: DriverWorkflowStepDefinition[] = [
  { stepId: "job-accepted", title: "Job Accepted", icon: "conversation", driverAction: "accept-job" },
  { stepId: "travelling-to-site", title: "Travelling to Site", icon: "vehicle", driverAction: "start-travel" },
  { stepId: "arrived-on-site", title: "Arrived On Site", icon: "conversation", driverAction: "confirm-arrival" },
  { stepId: "waste-collection", title: "Waste Collection", icon: "document", driverAction: "waste-collection" },
  { stepId: "bin-serviced", title: "Bin Serviced", icon: "shield-check", driverAction: "bin-serviced" },
  { stepId: "evidence-photos-captured", title: "Evidence Photos Captured", icon: "search", driverAction: "capture-evidence" },
  { stepId: "customer-signature", title: "Customer Signature", icon: "document", driverAction: "capture-signature", waiting: true },
  { stepId: "waste-loaded", title: "Waste Loaded", icon: "vehicle", driverAction: "load-waste" },
  { stepId: "disposal-facility-confirmation", title: "Disposal Confirmation", icon: "shield-check", driverAction: "confirm-disposal", waiting: true },
  { stepId: "job-completed", title: "Job Completed", icon: "check-circle", driverAction: "complete-job" },
];

const stepIndex = new Map(DRIVER_COLLECTION_WORKFLOW_STEPS.map((step, index) => [step.stepId, index]));

export function getDriverWorkflowStepIndex(stepId: DriverWorkflowStepId): number {
  return stepIndex.get(stepId) ?? 0;
}

export function getDriverWorkflowStepByAction(action: string): DriverWorkflowStepDefinition | null {
  const normalized = action.trim().toLowerCase();
  return DRIVER_COLLECTION_WORKFLOW_STEPS.find((step) => step.driverAction === normalized || step.stepId === normalized) ?? null;
}

function inferCompletedSteps(collection: Partial<HygieneCollection>): DriverWorkflowStepId[] {
  const currentStep = typeof collection.currentStep === "string" ? collection.currentStep : "";
  const completedSteps = Array.isArray(collection.completedSteps)
    ? collection.completedSteps.filter((step): step is DriverWorkflowStepId => DRIVER_COLLECTION_WORKFLOW_STEPS.some((definition) => definition.stepId === step))
    : [];

  if (completedSteps.length > 0) {
    return completedSteps;
  }

  if (collection.status === "Completed") {
    return DRIVER_COLLECTION_WORKFLOW_STEPS.map((step) => step.stepId);
  }

  if (currentStep && DRIVER_COLLECTION_WORKFLOW_STEPS.some((definition) => definition.stepId === currentStep)) {
    const index = getDriverWorkflowStepIndex(currentStep as DriverWorkflowStepId);
    return DRIVER_COLLECTION_WORKFLOW_STEPS.slice(0, index).map((step) => step.stepId);
  }

  if (collection.status === "Awaiting Disposal") {
    return DRIVER_COLLECTION_WORKFLOW_STEPS.slice(0, 8).map((step) => step.stepId);
  }

  if (collection.status === "In Progress" || collection.arrivalTime) {
    return DRIVER_COLLECTION_WORKFLOW_STEPS.slice(0, 3).map((step) => step.stepId);
  }

  return [];
}

export function deriveDriverWorkflowSnapshot(collection: Partial<HygieneCollection>): DriverWorkflowSnapshot {
  const completedSteps = inferCompletedSteps(collection);
  const completedSet = new Set(completedSteps);
  const currentStep = ((): DriverWorkflowStepId => {
    const explicitCurrent = typeof collection.currentStep === "string" ? collection.currentStep : "";
    if (explicitCurrent && DRIVER_COLLECTION_WORKFLOW_STEPS.some((definition) => definition.stepId === explicitCurrent)) {
      return explicitCurrent as DriverWorkflowStepId;
    }

    const firstIncomplete = DRIVER_COLLECTION_WORKFLOW_STEPS.find((step) => !completedSet.has(step.stepId));
    return firstIncomplete?.stepId ?? "job-completed";
  })();

  const currentStepIndex = getDriverWorkflowStepIndex(currentStep);
  const progressPercentage = typeof collection.progressPercentage === "number"
    ? collection.progressPercentage
    : Math.min(100, Math.round((completedSteps.length / DRIVER_COLLECTION_WORKFLOW_STEPS.length) * 100));

  const stepTimestamps = (collection.stepTimestamps ?? {}) as Partial<Record<DriverWorkflowStepId, string>>;

  const statusLabel = ((): string => {
    if (collection.status === "Completed" || completedSteps.length >= DRIVER_COLLECTION_WORKFLOW_STEPS.length) return "Collection Complete";
    if (currentStep === "job-completed") return "Collection Ready for Completion";
    if (currentStep === "customer-signature" && !stepTimestamps["customer-signature"]) return "Awaiting Customer Signature";
    if (currentStep === "disposal-facility-confirmation" && !stepTimestamps["disposal-facility-confirmation"]) return "Disposal Confirmation Required";
    if (currentStep === "travelling-to-site") return "Travelling to Site";
    if (currentStep === "arrived-on-site") return "Arrived On Site";
    if (currentStep === "waste-collection" || currentStep === "bin-serviced" || currentStep === "evidence-photos-captured" || currentStep === "waste-loaded") {
      return "Collecting Waste";
    }
    if (currentStep === "job-accepted") return "Job Accepted";
    return "Collection In Progress";
  })();

  const statusTone: DriverWorkflowSnapshot["statusTone"] = collection.status === "Completed"
    ? "green"
    : currentStep === "job-completed"
      ? "amber"
    : currentStep === "customer-signature" || currentStep === "disposal-facility-confirmation"
      ? "amber"
      : "blue";

  return {
    collectionId: collection.collectionId ?? "",
    completedSteps,
    currentStep,
    currentStepIndex,
    progressPercentage,
    remainingSteps: Math.max(0, DRIVER_COLLECTION_WORKFLOW_STEPS.length - completedSteps.length),
    stepTimestamps,
    statusLabel,
    statusTone,
  };
}

export function getDriverWorkflowStepState(
  stepId: DriverWorkflowStepId,
  snapshot: DriverWorkflowSnapshot
): DriverWorkflowStepState {
  const stepIndexValue = getDriverWorkflowStepIndex(stepId);
  const completedIndex = snapshot.completedSteps.indexOf(stepId);

  if (completedIndex >= 0) return "completed";
  if (stepId === snapshot.currentStep) {
    const step = DRIVER_COLLECTION_WORKFLOW_STEPS[stepIndexValue];
    return step.waiting ? "waiting" : "current";
  }
  if (stepIndexValue > snapshot.currentStepIndex) return "not-started";
  return "not-started";
}

export function getDriverWorkflowStatusToneClass(tone: DriverWorkflowSnapshot["statusTone"]): string {
  switch (tone) {
    case "green":
      return "border-emerald-400/30 bg-emerald-500/12 text-emerald-100";
    case "amber":
      return "border-amber-400/30 bg-amber-500/12 text-amber-100";
    case "red":
      return "border-rose-400/30 bg-rose-500/12 text-rose-100";
    case "blue":
      return "border-cyan-300/30 bg-cyan-400/15 text-cyan-50";
    default:
      return "border-slate-400/25 bg-slate-500/10 text-slate-100";
  }
}

export function getDriverWorkflowStepToneClass(state: DriverWorkflowStepState): string {
  switch (state) {
    case "completed":
      return "border-emerald-400/30 bg-emerald-500/14 text-emerald-50";
    case "current":
      return "border-cyan-300/35 bg-cyan-400/16 text-cyan-50";
    case "waiting":
      return "border-amber-400/35 bg-amber-500/14 text-amber-50";
    case "failed":
      return "border-rose-400/35 bg-rose-500/14 text-rose-50";
    default:
      return "border-slate-500/25 bg-slate-500/8 text-slate-300";
  }
}

export function getDriverWorkflowStepTimestamp(
  snapshot: DriverWorkflowSnapshot,
  stepId: DriverWorkflowStepId
): string {
  const timestamp = snapshot.stepTimestamps[stepId];
  if (!timestamp) return "Not completed";
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? timestamp
    : new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
