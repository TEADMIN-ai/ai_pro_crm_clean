import { Timestamp } from "firebase-admin/firestore";
import { detectEtendersDuplicate } from "@/lib/etenders/duplicates";
import { fetchEtendersOpportunities } from "@/lib/etenders/client";
import { compareEtendersSourceChange, buildEtendersImportPayload, createEtendersExecutionWorkspace } from "@/lib/etenders/workflow";
import type { EtendersImportReviewInput, EtendersSearchFilters, EtendersSourceRecord } from "@/lib/etenders/types";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { AuthorizedUser } from "@/lib/server/authz";
import { getContractorById } from "@/server/services/contractorService";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function searchEtendersOpportunities(filters: EtendersSearchFilters, options?: { start?: number; length?: number }) {
  return fetchEtendersOpportunities({ filters, start: options?.start, length: options?.length });
}

export async function importReviewedEtendersOpportunity(input: EtendersImportReviewInput, actor: AuthorizedUser) {
  const db = getFirebaseAdmin();
  const candidates = await db
    .collection("deals")
    .where("etendersSource.sourceSystem", "==", input.sourceRecord.sourceSystem)
    .where("etendersSource.sourceOpportunityId", "==", input.sourceRecord.sourceOpportunityId)
    .limit(5)
    .get();
  const fallbackCandidates = await db.collection("deals").where("tenderNumber", "==", input.sourceRecord.tenderNumber ?? "__none__").limit(10).get();
  const existingRecords = [...candidates.docs, ...fallbackCandidates.docs].map((doc) => ({ id: doc.id, ...(doc.data() ?? {}) }));
  const duplicate = detectEtendersDuplicate(input.sourceRecord, existingRecords);

  if (duplicate.duplicate && duplicate.existingId) {
    await db.collection("deals").doc(duplicate.existingId).set(
      {
        etendersSource: {
          ...input.sourceRecord,
          refreshedAt: new Date().toISOString(),
          duplicateRefreshReason: duplicate.reason,
        },
        sourceChangeAlerts: [],
        updatedAt: new Date(),
      },
      { merge: true },
    );
    return { id: duplicate.existingId, duplicate: true, duplicateReason: duplicate.reason };
  }

  const now = new Date();
  const payload = buildEtendersImportPayload({ ...input, reviewedByUid: actor.uid }, now.toISOString());
  const docRef = db.collection("deals").doc();
  await docRef.set({
    ...payload,
    id: docRef.id,
    createdByUid: actor.uid,
    createdByEmail: actor.email ?? null,
    createdByName: actor.email ?? actor.uid,
    createdAt: now.getTime(),
    updatedAt: now,
  });
  await docRef.collection("activity").add({
    type: "etenders_imported",
    message: "eTenders opportunity imported after staff review",
    performedByEmail: actor.email ?? null,
    createdAt: Timestamp.fromDate(now),
  });
  return { id: docRef.id, duplicate: false, duplicateReason: null };
}

export async function refreshImportedEtendersOpportunity(input: {
  dealId: string;
  previousSource: EtendersSourceRecord;
  latestSource: EtendersSourceRecord;
  actor: AuthorizedUser;
}) {
  const alerts = compareEtendersSourceChange(input.previousSource, input.latestSource);
  await getFirebaseAdmin().collection("deals").doc(input.dealId).set(
    {
      etendersSourceLatest: input.latestSource,
      sourceChangeAlerts: alerts.map((alert) => ({
        alert,
        status: "REVIEW_REQUIRED",
        createdAt: new Date().toISOString(),
        createdByUid: input.actor.uid,
      })),
      updatedAt: new Date(),
    },
    { merge: true },
  );
  return { alerts };
}

export async function assignEtendersContractor(input: {
  dealId: string;
  contractorId: string;
  actor: AuthorizedUser;
}) {
  const db = getFirebaseAdmin();
  const [dealSnapshot, contractor] = await Promise.all([
    db.collection("deals").doc(input.dealId).get(),
    getContractorById(input.contractorId),
  ]);

  if (!dealSnapshot.exists) throw new Error("Deal not found");
  if (!contractor) throw new Error("Contractor not found");

  const deal = (dealSnapshot.data() ?? {}) as Record<string, unknown>;
  const source = deal.etendersSource as EtendersSourceRecord | undefined;
  if (!source?.sourceOpportunityId) throw new Error("Deal is not linked to an eTenders source");

  const contractorWorkspaceId = asString((contractor as Record<string, unknown>).workspaceId);
  const dealWorkspaceId = asString(deal.workspaceId);
  if (contractorWorkspaceId && dealWorkspaceId && contractorWorkspaceId !== dealWorkspaceId) {
    throw new Error("Cross-workspace contractor assignment rejected");
  }

  const missing = Array.isArray((contractor as Record<string, unknown>).missingCriticalDocuments)
    ? ((contractor as Record<string, unknown>).missingCriticalDocuments as unknown[]).filter((item): item is string => typeof item === "string")
    : [];
  const execution = createEtendersExecutionWorkspace({
    opportunityId: input.dealId,
    dealId: input.dealId,
    contractorId: input.contractorId,
    workspaceId: dealWorkspaceId ?? contractorWorkspaceId ?? "default",
    sourceTenderId: source.sourceOpportunityId,
    complianceMissing: missing,
    boqRequired: (deal.boqRequired as { required?: boolean } | undefined)?.required === true,
  });

  await db.collection("deals").doc(input.dealId).set(
    {
      companyId: input.contractorId,
      contractorId: input.contractorId,
      contractorName: asString((contractor as Record<string, unknown>).companyName) ?? asString((contractor as Record<string, unknown>).businessName) ?? input.contractorId,
      workflowStatus: missing.length > 0 ? "COMPLIANCE_REVIEW" : "CONTRACTOR_ASSIGNED",
      etendersExecutionWorkspace: execution,
      updatedAt: new Date(),
    },
    { merge: true },
  );
  await db.collection("deals").doc(input.dealId).collection("activity").add({
    type: "contractor_assigned",
    message: "Contractor assigned and eTenders execution workspace created",
    to: input.contractorId,
    performedByEmail: input.actor.email ?? null,
    createdAt: new Date(),
  });
  return execution;
}

