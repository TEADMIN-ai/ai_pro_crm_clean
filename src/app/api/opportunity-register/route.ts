import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { AuthorizationError, isPrivilegedRole, requireAuthorizedUser } from "@/lib/server/authz";
import { extractOpportunityMetadataFromPdf } from "@/lib/opportunities/opportunityDocumentExtraction";
import {
  canCreateOpportunity,
  clearExtractedOpportunityFields,
  createOpportunityDraft,
  getMissingCreateRequirements,
  mergeExtractionIntoDraft,
  normalizeEstimatedValue,
  type OpportunityDraft,
  type OpportunityDocumentKey,
  type OpportunityUploadedDocument,
} from "@/lib/opportunities/opportunityIntake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DOCUMENT_TYPES: readonly OpportunityDocumentKey[] = ["rfq", "boq", "annexures", "sbd", "supporting"];

function sanitizeFilename(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : "document.pdf";
}

function normalizeDraft(value: unknown): OpportunityDraft {
  const source = value && typeof value === "object" ? (value as Partial<OpportunityDraft>) : {};
  return {
    ...createOpportunityDraft(typeof source.draftId === "string" ? source.draftId : undefined),
    ...source,
    uploadedDocuments: Array.isArray(source.uploadedDocuments) ? source.uploadedDocuments : [],
    extractionMetadata: Array.isArray(source.extractionMetadata) ? source.extractionMetadata : [],
    fieldSources: source.fieldSources && typeof source.fieldSources === "object" ? source.fieldSources : {},
  };
}

function getFileList(formData: FormData, key: OpportunityDocumentKey): File[] {
  return formData.getAll(`file:${key}`).filter((item): item is File => item instanceof File);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthorizedUser(request);
    if (!isPrivilegedRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const draftJson = String(formData.get("draft") ?? "");
    const workspaceId = String(formData.get("workspaceId") ?? "").trim();
    const draft = normalizeDraft(draftJson ? JSON.parse(draftJson) : {});
    const filesByType = new Map<OpportunityDocumentKey, File[]>();

    for (const documentType of DOCUMENT_TYPES) {
      filesByType.set(documentType, getFileList(formData, documentType));
    }

    const primaryFiles = filesByType.get("rfq") ?? [];
    const hasPersistedPrimaryDocument = draft.uploadedDocuments.some(
      (document) =>
        document.documentType === "rfq" &&
        typeof document.storagePath === "string" &&
        document.storagePath.trim().length > 0,
    );

    if (!hasPersistedPrimaryDocument) {
      draft.uploadedDocuments = draft.uploadedDocuments.filter(
        (document) => document.documentType !== "rfq",
      );
    }

    if (primaryFiles.length > 0 && !draft.uploadedDocuments.some((document) => document.documentType === "rfq")) {
      draft.uploadedDocuments.push({
        id: `rfq-${Date.now()}`,
        documentType: "rfq",
        name: primaryFiles[0].name,
        size: primaryFiles[0].size,
        contentType: primaryFiles[0].type || "application/pdf",
      });
    }

    const missing = getMissingCreateRequirements(draft);
    if (!canCreateOpportunity(draft)) {
      return NextResponse.json({ error: "Missing required fields", missing }, { status: 400 });
    }

    const db = getFirebaseAdmin();
    const userProfile = await db.collection("users").doc(user.uid).get();
    const profileData = (userProfile.data() ?? {}) as Record<string, unknown>;
    const userWorkspaceId = typeof profileData.workspaceId === "string" ? profileData.workspaceId.trim() : "";
    if (workspaceId && userWorkspaceId && workspaceId !== userWorkspaceId) {
      return NextResponse.json({ error: "Workspace access rejected" }, { status: 403 });
    }
    const resolvedWorkspaceId = workspaceId || userWorkspaceId || null;
    const idempotencyKey = draft.draftId.trim();
    const existingSnapshot = await db
      .collection("deals")
      .where("opportunityDraftId", "==", idempotencyKey)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      const existing = existingSnapshot.docs[0];
      return NextResponse.json(
        {
          success: true,
          id: existing.id,
          opportunity: { id: existing.id, ...(existing.data() ?? {}) },
          idempotent: true,
        },
        { status: 200 },
      );
    }

    const now = new Date();
    const dealRef = db.collection("deals").doc();
    const uploadedDocuments: OpportunityUploadedDocument[] = [];
    const extractionMetadata = primaryFiles.length > 0 ? [] : [...draft.extractionMetadata];
    let enrichedDraft = primaryFiles.length > 0 ? clearExtractedOpportunityFields(draft) : draft;
    const bucket = getFirebaseStorageBucket();

    for (const documentType of DOCUMENT_TYPES) {
      const files = filesByType.get(documentType) ?? [];
      for (const uploadedFile of files) {
        if (!uploadedFile.name.toLowerCase().endsWith(".pdf")) {
          return NextResponse.json({ error: `Only PDF files are allowed: ${uploadedFile.name}` }, { status: 400 });
        }

        const buffer = Buffer.from(await uploadedFile.arrayBuffer());
        const safeFilename = sanitizeFilename(uploadedFile.name);
        const storagePath = `uploads/deals/${dealRef.id}/opportunity-intake/${documentType}/${Date.now()}_${safeFilename}`;
        const storageFile = bucket.file(storagePath);
        await storageFile.save(buffer, {
          metadata: { contentType: uploadedFile.type || "application/pdf" },
          resumable: false,
        });
        const [downloadURL] = await storageFile.getSignedUrl({
          action: "read",
          expires: Date.now() + 5 * 60 * 1000,
        });

        let analysis = null;
        if (documentType === "rfq") {
          analysis = await extractOpportunityMetadataFromPdf({ fileName: uploadedFile.name, buffer, extractionId: enrichedDraft.activeRfqExtractionId });
          enrichedDraft = mergeExtractionIntoDraft(enrichedDraft, analysis);
          extractionMetadata.push(analysis);
        }

        const documentRef = dealRef.collection("documents").doc();
        const documentPayload = {
          id: documentRef.id,
          dealId: dealRef.id,
          documentType,
          name: uploadedFile.name,
          fileName: uploadedFile.name,
          originalName: uploadedFile.name,
          contentType: uploadedFile.type || "application/pdf",
          size: uploadedFile.size,
          storagePath,
          downloadURL,
          uploadedBy: user.email ?? user.uid,
          uploadedByUid: user.uid,
          uploadedByRole: user.role,
          uploadedAt: Timestamp.fromDate(now),
          createdAt: now.toISOString(),
          updatedAt: Timestamp.fromDate(now),
          status: "pending",
          version: 1,
          opportunityIntake: true,
          extraction: analysis,
        };

        await documentRef.set(documentPayload);
        uploadedDocuments.push({
          id: documentRef.id,
          documentType,
          name: uploadedFile.name,
          size: uploadedFile.size,
          contentType: uploadedFile.type || "application/pdf",
          storagePath,
          downloadURL,
          analysis,
        });
      }
    }

    const value = normalizeEstimatedValue(enrichedDraft.estimatedValue);
    const contractorAssignmentCandidate = enrichedDraft.assignedContractorId.trim() || null;
    const payload = {
      opportunityDraftId: idempotencyKey,
      type: "opportunity",
      source: "opportunity-register-upload",
      title: enrichedDraft.opportunityTitle.trim(),
      name: enrichedDraft.opportunityTitle.trim(),
      companyId: "unassigned",
      contractorId: null,
      contractorName: null,
      status: "draft",
      stage: "lead",
      value,
      estimatedDealValue: value || null,
      currency: "ZAR",
      tenderNumber: enrichedDraft.referenceNumber.trim() || null,
      rfqNumber: enrichedDraft.referenceNumber.trim() || null,
      clientName: enrichedDraft.clientName.trim(),
      issuingAuthority: enrichedDraft.clientName.trim(),
      municipalityName: enrichedDraft.municipality.trim() || null,
      department: enrichedDraft.department.trim() || null,
      province: enrichedDraft.province.trim() || null,
      category: enrichedDraft.category.trim() || null,
      description: enrichedDraft.description.trim() || null,
      closingDate: enrichedDraft.closingDate.trim(),
      deadline: enrichedDraft.closingDate.trim(),
      workspaceId: resolvedWorkspaceId,
      createdByUid: user.uid,
      createdByEmail: user.email ?? null,
      createdByName: user.email ?? user.uid,
      createdAt: now.getTime(),
      updatedAt: now,
      workflowStatus: "intake_created",
      opportunityIntake: {
        draft: enrichedDraft,
        uploadedDocuments,
        extractionMetadata,
        createdFrom: "opportunity-register-upload",
        contractorAssignmentCandidate: contractorAssignmentCandidate
          ? {
              contractorReference: contractorAssignmentCandidate,
              source: "opportunity_intake_draft",
              authoritative: false,
              reviewStatus: "REVIEW_REQUIRED",
            }
          : null,
      },
      tenderAnalysis: {
        issuingAuthority: enrichedDraft.clientName.trim() || null,
        tenderNumber: enrichedDraft.referenceNumber.trim() || null,
        deadline: enrichedDraft.closingDate.trim() || null,
        scope: enrichedDraft.description.trim() || enrichedDraft.opportunityTitle.trim(),
        requiredCertificates: [],
        estimatedValue: value || null,
        location: enrichedDraft.municipality.trim() || null,
        aiAnalyzedAt: now.toISOString(),
      },
      readinessScore: 0,
      docsMissing: 0,
      tenderLockStatus: "RISK",
      isTenderLocked: false,
      documents: uploadedDocuments,
    };

    await dealRef.set(payload);
    await dealRef.collection("activity").add({
      type: "created",
      message: "Opportunity created from upload intake wizard",
      performedByEmail: user.email ?? null,
      createdAt: Timestamp.fromDate(now),
    });

    return NextResponse.json(
      {
        success: true,
        id: dealRef.id,
        opportunity: { id: dealRef.id, ...payload },
        idempotent: false,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[opportunity-register/create] failed", error);
    return NextResponse.json(
      { error: "Failed to create opportunity", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
