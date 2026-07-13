import { getFirebaseAdmin } from "@/lib/firebase/admin";

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_MS = 30 * DAY_MS;

type RawRecord = Record<string, unknown>;
type SourceTypeKey = "rfq" | "tender" | "rfp" | "rfi" | "quotation" | "unknown";

export interface EnterpriseRecentItem {
  id: string;
  title: string;
  municipality: string;
  status: string;
  text: string;
  updatedAt: string | null;
}

export interface EnterpriseKpiSnapshot {
  schemaVersion: "2026-07";
  generatedAt: string;
  dashboardSummary: {
    totalOpportunities: number;
    readyForSubmission: number;
    submitted: number;
    blocked: number;
    risk: number;
    avgReadiness: number;
    pipelineValue: number;
    recent: EnterpriseRecentItem[];
  };
  opportunities: {
    total: number;
    rfq: number;
    tender: number;
    rfp: number;
    rfi: number;
    quotation: number;
    unknown: number;
    municipalities: number;
    closingSoon: number;
    overdue: number;
    compulsoryBriefings: number;
    boqRequired: number;
    assigned: number;
    unassigned: number;
  };
  contractors: {
    total: number;
    ready: number;
    compliant: number;
    assigned: number;
    unassigned: number;
    avgReadiness: number;
  };
  clients: {
    total: number;
    active: number;
    inactive: number;
    monthlyRevenue: number;
  };
  drivers: {
    total: number;
    activeAssignments: number;
    collectionsToday: number;
    collectionsThisWeek: number;
  };
  collections: {
    total: number;
    scheduled: number;
    inProgress: number;
    completed: number;
    overdue: number;
    dueThisWeek: number;
  };
  compliance: {
    total: number;
    valid: number;
    expiringSoon: number;
    expired: number;
  };
  submissions: {
    total: number;
    readyToSubmit: number;
    submitted: number;
    blocked: number;
    avgReadiness: number;
    conversionRate: number;
  };
  revenue: {
    totalValue: number;
    awardedValue: number;
    submittedValue: number;
    pipelineValue: number;
    averageValue: number;
  };
  documents: {
    total: number;
    topLevel: number;
    opportunityDocuments: number;
    contractorDocuments: number;
    uploadedToday: number;
  };
  readiness: {
    averageScore: number;
    ready: number;
    atRisk: number;
    notReady: number;
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): RawRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RawRecord) : {};
}

function toMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    const millis = (value as { toMillis: () => number }).toMillis();
    return typeof millis === "number" && Number.isFinite(millis) ? millis : null;
  }
  return null;
}

function toIso(value: unknown, fallback = Date.now()): string {
  return new Date(toMillis(value) ?? fallback).toISOString();
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isWithinDays(value: unknown, days: number, now = Date.now()): boolean {
  const millis = toMillis(value);
  return millis !== null && millis >= now && millis <= now + days * DAY_MS;
}

function isToday(value: unknown, now = Date.now()): boolean {
  const millis = toMillis(value);
  if (millis === null) return false;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return millis >= start.getTime() && millis < start.getTime() + DAY_MS;
}

function normalizeSourceType(value: unknown): SourceTypeKey {
  switch (asString(value)?.toUpperCase()) {
    case "RFQ":
      return "rfq";
    case "TENDER":
      return "tender";
    case "RFP":
      return "rfp";
    case "RFI":
      return "rfi";
    case "QUOTATION":
      return "quotation";
    default:
      return "unknown";
  }
}

function getOpportunityValue(record: RawRecord): number {
  const metadata = asRecord(record.metadata);
  const value = asRecord(metadata.value ?? record.value);
  const estimated = asRecord(metadata.estimatedValue ?? record.estimatedValue);
  return asNumber(value.amount) ?? asNumber(estimated.amount) ?? asNumber(record.amount) ?? asNumber(record.value) ?? asNumber(record.estimatedValue) ?? 0;
}

function getOpportunityStatus(record: RawRecord): string {
  return asString(record.status) ?? asString(record.lifecycleStatus) ?? "draft";
}

function getOpportunityReadiness(record: RawRecord): { status: "NOT_READY" | "AT_RISK" | "READY"; score: number } {
  const readiness = asRecord(record.submissionReadiness ?? record.readiness);
  const score = clampPercent(asNumber(readiness.score ?? readiness.readinessScore ?? record.readinessScore) ?? 0);
  const status =
    readiness.status === "READY" || readiness.status === "AT_RISK" || readiness.status === "NOT_READY"
      ? readiness.status
      : score >= 80
        ? "READY"
        : score >= 60
          ? "AT_RISK"
          : "NOT_READY";
  return { status, score };
}

function getOpportunityCompliance(record: RawRecord): "UNKNOWN" | "PASS" | "WARNING" | "FAIL" {
  const compliance = asRecord(record.compliance);
  return compliance.status === "PASS" || compliance.status === "WARNING" || compliance.status === "FAIL" ? compliance.status : "UNKNOWN";
}

function getAssignedContractorIds(record: RawRecord): string[] {
  const assignments = Array.isArray(record.contractorAssignments) ? record.contractorAssignments : [];
  return assignments
    .map((assignment) => asString(asRecord(assignment).contractorId))
    .filter((value): value is string => Boolean(value));
}

function buildRecentText(status: string, readiness: { status: "NOT_READY" | "AT_RISK" | "READY" }, compliance: "UNKNOWN" | "PASS" | "WARNING" | "FAIL", closingDate: string | null): string {
  if (status === "submitted") return "Opportunity submitted for review";
  if (status === "ready_for_submission" || readiness.status === "READY") return "Opportunity is ready for assignment";
  if (compliance === "FAIL") return "Opportunity is blocked by compliance";
  if (readiness.status === "AT_RISK" || compliance === "WARNING") return "Opportunity needs readiness review";
  if (closingDate) return "Opportunity closing date is being monitored";
  return "Opportunity activity recorded";
}

function recentOpportunityItem(id: string, record: RawRecord): EnterpriseRecentItem {
  const metadata = asRecord(record.metadata);
  const municipality = asRecord(record.municipality);
  const readiness = getOpportunityReadiness(record);
  const compliance = getOpportunityCompliance(record);
  const status = getOpportunityStatus(record);
  const closingDate = asString(record.closingDate);

  return {
    id,
    title: asString(metadata.title ?? record.title) ?? "Untitled opportunity",
    municipality: asString(municipality.name ?? record.municipalityName ?? record.issuingAuthority) ?? "Unknown municipality",
    status,
    text: buildRecentText(status, readiness, compliance, closingDate),
    updatedAt: asString(metadata.updatedAt ?? record.updatedAt) ?? toIso(metadata.updatedAt ?? record.updatedAt),
  };
}

async function fetchDocs(collectionName: string) {
  const snapshot = await getFirebaseAdmin().collection(collectionName).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: (doc.data() ?? {}) as RawRecord, path: doc.ref.path }));
}

function summarizeOpportunities(opportunities: Array<{ id: string; data: RawRecord }>, now = Date.now()) {
  const counts = {
    total: opportunities.length,
    rfq: 0,
    tender: 0,
    rfp: 0,
    rfi: 0,
    quotation: 0,
    unknown: 0,
    municipalities: 0,
    closingSoon: 0,
    overdue: 0,
    compulsoryBriefings: 0,
    boqRequired: 0,
    assigned: 0,
    unassigned: 0,
  };

  const municipalities = new Set<string>();
  const assignedContractorIds = new Set<string>();
  let readyForSubmission = 0;
  let submitted = 0;
  let blocked = 0;
  let risk = 0;
  let readinessTotal = 0;
  let pipelineValue = 0;
  let awardedValue = 0;
  let submittedValue = 0;
  let readyCount = 0;
  let atRiskCount = 0;
  let notReadyCount = 0;

  const recent = opportunities
    .map(({ id, data }) => {
      const metadata = asRecord(data.metadata);
      const municipality = asRecord(data.municipality);
      const readiness = getOpportunityReadiness(data);
      const compliance = getOpportunityCompliance(data);
      const status = getOpportunityStatus(data);
      const sourceType = normalizeSourceType(metadata.sourceType ?? data.sourceType ?? data.type);
      const closingDate = asString(data.closingDate);
      const value = getOpportunityValue(data);
      const briefing = asRecord(data.compulsoryBriefing ?? data.briefing);
      const boq = asRecord(data.boqRequired ?? data.boq);
      const contractorIds = getAssignedContractorIds(data);

      municipalities.add(asString(municipality.name ?? data.municipalityName ?? data.issuingAuthority) ?? "Unknown municipality");
      counts[sourceType] += 1;
      if (isWithinDays(closingDate, 7, now)) counts.closingSoon += 1;
      else if (toMillis(closingDate) !== null && toMillis(closingDate)! < now && !["submitted", "awarded", "closed", "cancelled", "lost"].includes(status)) counts.overdue += 1;
      if (briefing.compulsory === true || briefing.requiredStatus === "yes") counts.compulsoryBriefings += 1;
      if (boq.required === true) counts.boqRequired += 1;
      if (contractorIds.length > 0) {
        counts.assigned += 1;
        contractorIds.forEach((contractorId) => assignedContractorIds.add(contractorId));
      } else {
        counts.unassigned += 1;
      }
      if (status === "ready_for_submission" || readiness.status === "READY") {
        readyForSubmission += 1;
        readyCount += 1;
      }
      if (status === "submitted") {
        submitted += 1;
        submittedValue += value;
      }
      if (compliance === "FAIL" || readiness.status === "NOT_READY") blocked += 1;
      if (compliance === "WARNING" || readiness.status === "AT_RISK") risk += 1;
      if (status === "awarded" || status === "closed") awardedValue += value;
      readinessTotal += readiness.score;
      pipelineValue += value;
      if (readiness.status === "AT_RISK") atRiskCount += 1;
      else if (readiness.status === "NOT_READY") notReadyCount += 1;

      return { ...recentOpportunityItem(id, data), value, readinessScore: readiness.score };
    })
    .sort((left, right) => (toMillis(right.updatedAt) ?? 0) - (toMillis(left.updatedAt) ?? 0))
    .slice(0, 5)
    .map(({ value: _value, readinessScore: _readinessScore, ...item }) => item);

  const averageReadiness = opportunities.length > 0 ? clampPercent(readinessTotal / opportunities.length) : 0;

  return {
    summary: {
      totalOpportunities: opportunities.length,
      readyForSubmission,
      submitted,
      blocked,
      risk,
      avgReadiness: averageReadiness,
      pipelineValue,
      recent,
    },
    opportunityCounts: {
      ...counts,
      municipalities: municipalities.size,
      assigned: assignedContractorIds.size,
      unassigned: Math.max(0, opportunities.length - assignedContractorIds.size),
    },
    submissionCounts: {
      total: opportunities.length,
      readyToSubmit: readyForSubmission,
      submitted,
      blocked,
      avgReadiness: averageReadiness,
      conversionRate: opportunities.length > 0 ? clampPercent((submitted / opportunities.length) * 100) : 0,
    },
    revenueCounts: {
      totalValue: pipelineValue,
      awardedValue,
      submittedValue,
      pipelineValue,
      averageValue: opportunities.length > 0 ? Math.round(pipelineValue / opportunities.length) : 0,
    },
    readinessCounts: {
      averageScore: averageReadiness,
      ready: readyCount,
      atRisk: atRiskCount,
      notReady: notReadyCount,
    },
  };
}

export async function getEnterpriseKpiSnapshot(): Promise<EnterpriseKpiSnapshot> {
  const now = Date.now();
  const [
    opportunitiesSnapshot,
    contractorsSnapshot,
    clientsSnapshot,
    driversSnapshot,
    collectionsSnapshot,
    complianceDocumentsSnapshot,
    topLevelDocumentsSnapshot,
    documentGroupsSnapshot,
  ] = await Promise.all([
    fetchDocs("opportunities"),
    fetchDocs("contractors"),
    fetchDocs("hygieneClients"),
    getFirebaseAdmin().collection("users").where("role", "==", "driver").get(),
    fetchDocs("hygieneCollections"),
    fetchDocs("hygieneComplianceDocuments"),
    fetchDocs("documents"),
    getFirebaseAdmin().collectionGroup("documents").get(),
  ]);

  const opportunitySummary = summarizeOpportunities(opportunitiesSnapshot, now);
  const contractorAssignments = new Set<string>();
  opportunitiesSnapshot.forEach(({ data }) => getAssignedContractorIds(data).forEach((contractorId) => contractorAssignments.add(contractorId)));

  const contractors = contractorsSnapshot.map(({ data }) => ({
    readinessScore: clampPercent(asNumber(data.readinessScore) ?? asNumber(data.readinessConfidence) ?? 0),
    complianceConfidence: clampPercent(asNumber(data.complianceConfidence) ?? 0),
    tenderLockStatus: asString(data.tenderLockStatus),
    bankVerified: data.bankVerified === true,
  }));

  const clients = clientsSnapshot.map(({ data }) => ({
    status: asString(data.status) ?? "Inactive",
    monthlyRevenue: asNumber(data.monthlyRevenue) ?? 0,
  }));

  const collections = collectionsSnapshot.map(({ data }) => ({
    status: asString(data.status) ?? "Scheduled",
    scheduledDate: asString(data.scheduledDate) ?? null,
    completedAt: asString(data.completedAt) ?? null,
    assignedDriver: asString(data.assignedDriver) ?? null,
  }));

  const complianceDocuments = complianceDocumentsSnapshot.map(({ data }) => ({
    status: asString(data.status) ?? "Pending",
    expiryDate: asString(data.expiryDate) ?? null,
  }));

  const allDocumentRecords = [
    ...topLevelDocumentsSnapshot,
    ...documentGroupsSnapshot.docs.map((doc) => ({ id: doc.id, data: (doc.data() ?? {}) as RawRecord, path: doc.ref.path })),
  ];

  const driverIds = new Set(collections.map((collection) => collection.assignedDriver).filter((value): value is string => Boolean(value)));
  const documentCounts = {
    total: topLevelDocumentsSnapshot.length + documentGroupsSnapshot.docs.length,
    topLevel: topLevelDocumentsSnapshot.length,
    opportunityDocuments: documentGroupsSnapshot.docs.filter((doc) => doc.ref.path.includes("/opportunities/")).length,
    contractorDocuments: documentGroupsSnapshot.docs.filter((doc) => doc.ref.path.includes("/contractors/")).length,
    uploadedToday: allDocumentRecords.filter(({ data }) => isToday(data.uploadedAt ?? data.createdAt ?? data.updatedAt, now)).length,
  };

  const complianceCounts = {
    valid: complianceDocuments.filter((document) => document.status === "Active" || document.status === "Compliance Green").length,
    expiringSoon: complianceDocuments.filter((document) => {
      const expiry = toMillis(document.expiryDate);
      return expiry !== null && expiry >= now && expiry <= now + EXPIRING_SOON_MS;
    }).length,
    expired: complianceDocuments.filter((document) => {
      const expiry = toMillis(document.expiryDate);
      return expiry !== null && expiry < now;
    }).length,
  };

  const collectionsThisWeek = collections.filter((collection) => {
    if (collection.status === "Completed" || collection.status === "Cancelled") return false;
    return isWithinDays(collection.scheduledDate, 7, now);
  }).length;

  const collectionsToday = collections.filter((collection) => isToday(collection.scheduledDate, now) || isToday(collection.completedAt, now)).length;

  return {
    schemaVersion: "2026-07",
    generatedAt: new Date(now).toISOString(),
    dashboardSummary: opportunitySummary.summary,
    opportunities: opportunitySummary.opportunityCounts,
    contractors: {
      total: contractors.length,
      ready: contractors.filter((contractor) => contractor.tenderLockStatus === "READY" || contractor.readinessScore >= 80).length,
      compliant: contractors.filter((contractor) => contractor.complianceConfidence >= 80 || contractor.bankVerified).length,
      assigned: contractorAssignments.size,
      unassigned: Math.max(0, contractors.length - contractorAssignments.size),
      avgReadiness: contractors.length > 0 ? clampPercent(contractors.reduce((total, contractor) => total + contractor.readinessScore, 0) / contractors.length) : 0,
    },
    clients: {
      total: clients.length,
      active: clients.filter((client) => client.status === "Active").length,
      inactive: clients.filter((client) => client.status !== "Active").length,
      monthlyRevenue: Math.round(clients.reduce((total, client) => total + client.monthlyRevenue, 0)),
    },
    drivers: {
      total: driversSnapshot.docs.length,
      activeAssignments: driverIds.size,
      collectionsToday,
      collectionsThisWeek,
    },
    collections: {
      total: collections.length,
      scheduled: collections.filter((collection) => collection.status === "Scheduled").length,
      inProgress: collections.filter((collection) => collection.status === "In Progress").length,
      completed: collections.filter((collection) => collection.status === "Completed").length,
      overdue: collections.filter((collection) => collection.status === "Overdue" || (collection.scheduledDate !== null && toMillis(collection.scheduledDate) !== null && toMillis(collection.scheduledDate)! < now && collection.status !== "Completed" && collection.status !== "Cancelled")).length,
      dueThisWeek: collectionsThisWeek,
    },
    compliance: {
      total: complianceDocuments.length,
      valid: complianceCounts.valid,
      expiringSoon: complianceCounts.expiringSoon,
      expired: complianceCounts.expired,
    },
    submissions: opportunitySummary.submissionCounts,
    revenue: opportunitySummary.revenueCounts,
    documents: documentCounts,
    readiness: opportunitySummary.readinessCounts,
  };
}
