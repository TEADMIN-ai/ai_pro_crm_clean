import { NextRequest, NextResponse } from "next/server";

import { logActivity } from "@/lib/activity/logActivity";
import { runAutomation } from "@/lib/automation/automationEngine";
import { normalizeSupportedDocumentType } from "@/lib/compliance/contractorCompliance";
import { updateContractorIntelligence } from "@/lib/contractors/updateContractorIntelligence";
import { executeContractorDocumentAnalysis } from "@/lib/documents/executeContractorDocumentAnalysis";
import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { sendWhatsAppMessage } from "@/lib/notifications/sendWhatsApp";
import { AuthorizationError, assertCanAccessContractor, requireAuthorizedUser } from "@/lib/server/authz";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

type ContractorAutomationState = {
  readinessStatus: string;
  missingDocsCount: number;
  aiStatusSummary: string;
};

function shouldResolveAlert(code: unknown, contractor: ContractorAutomationState) {
  switch (code) {
    case "BLOCKED_CONTRACTOR":
      return contractor.readinessStatus !== "BLOCKED";

    case "MISSING_DOCUMENTS":
      return contractor.missingDocsCount === 0;

    case "AI_FAILED":
      return contractor.aiStatusSummary !== "failed";

    case "AI_PENDING_TIMEOUT":
      return contractor.aiStatusSummary !== "pending";

    default:
      return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getFirebaseAdmin();
    const user = await requireAuthorizedUser(req);
    const formData = await req.formData();

    const uploadedFile = formData.get("file");
    const contractorId = String(formData.get("contractorId") ?? "").trim();
    const documentType = normalizeSupportedDocumentType(formData.get("documentType"));

    console.log("[UPLOAD_RECEIVED]", {
      hasFile: uploadedFile instanceof File,
      contractorId,
      documentType,
    });

    if (
      !(uploadedFile instanceof File) ||
      !contractorId ||
      !documentType ||
      uploadedFile.size <= 0 ||
      (uploadedFile.type && uploadedFile.type !== "application/pdf") ||
      !uploadedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      return jsonError("Missing required fields", 400);
    }

    assertCanAccessContractor(user, contractorId);

    const buffer = Buffer.from(await uploadedFile.arrayBuffer());
    const bucket = getFirebaseStorageBucket();
    const timestamp = Date.now();
    const file = bucket.file(`contractors/${contractorId}/${documentType}_${timestamp}.pdf`);

    await file.save(buffer, {
      contentType: uploadedFile.type || "application/pdf",
      resumable: false,
      metadata: {
        cacheControl: "private, max-age=0, no-transform",
      },
    });

    const [fileUrl] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10,
    });

    const documentRef = db
      .collection("contractors")
      .doc(contractorId)
      .collection("documents")
      .doc(documentType);

    await documentRef.set(
      {
        contractorId,
        documentType,
        docType: documentType,
        documentName: uploadedFile.name,
        fileName: uploadedFile.name,
        originalName: uploadedFile.name,
        filename: file.name,
        storagePath: file.name,
        fileUrl,
        downloadURL: fileUrl,
        url: fileUrl,
        uploadedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        verified: false,
        verifiedAt: null,
        verifiedBy: null,
        aiStatus: "pending",
        aiError: null,
        aiValidated: false,
        validationStatus: null,
        validationError: null,
        reviewReason: null,
        confidenceScore: null,
        confidenceNotes: [],
        missingFields: [],
        suggestions: [],
        extractedFields: {},
        analysisTimestamp: null,
        expiresAt: null,
        expiryDate: null,
        expiryAlert: null,
        expiryAlertMessage: null,
        manualDecisionAvailable: false,
        status: "uploaded",
        isExpired: false,
      },
      { merge: true }
    );

    await logActivity({
      contractorId,
      action: `Uploaded ${documentType}`,
      performedBy: user.email?.trim() || user.uid,
    });

    console.log("[UPLOAD_PERSISTED]", {
      contractorId,
      documentId: documentRef.id,
      documentType,
      storagePath: file.name,
    });

    const execution = await executeContractorDocumentAnalysis({
      contractorId,
      documentType,
      actorEmail: user.email,
      actorId: user.uid,
      writeActivity: false,
    });
    const intelligenceSummary = await updateContractorIntelligence(db, contractorId, {
      precomputedSummary: execution.summary,
    });
    const contractorSnapshot = await db.collection("contractors").doc(contractorId).get();
    const contractorRecord = contractorSnapshot.data() as Record<string, unknown> | undefined;
    const contractorName =
      typeof contractorRecord?.name === "string" && contractorRecord.name.trim().length > 0
        ? contractorRecord.name.trim()
        : typeof contractorRecord?.companyName === "string" && contractorRecord.companyName.trim().length > 0
          ? contractorRecord.companyName.trim()
          : "Contractor";
    const alerts = await runAutomation({
      contractorId,
      name: contractorName,
      readinessStatus: intelligenceSummary.readinessStatus,
      missingDocsCount: intelligenceSummary.missingDocsCount,
      aiStatusSummary: intelligenceSummary.aiStatusSummary,
      aiStatusPendingSince: intelligenceSummary.aiStatusPendingSince,
    });
    const contractorData: ContractorAutomationState = {
      readinessStatus: intelligenceSummary.readinessStatus,
      missingDocsCount: intelligenceSummary.missingDocsCount,
      aiStatusSummary: intelligenceSummary.aiStatusSummary,
    };
    const existingAlertsSnapshot = await db
      .collection("automationAlerts")
      .where("contractorId", "==", contractorId)
      .where("resolved", "==", false)
      .get();
    const existingCodes = new Set(
      existingAlertsSnapshot.docs.map((doc) => {
        const data = doc.data() as { code?: unknown };
        return typeof data.code === "string" ? data.code : "";
      }).filter(Boolean)
    );
    const newAlerts = alerts.filter((alert) => !existingCodes.has(alert.code));
    let resolvedCount = 0;

    if (existingAlertsSnapshot.docs.length > 0 || newAlerts.length > 0) {
      const batch = db.batch();

      for (const doc of existingAlertsSnapshot.docs) {
        const data = doc.data() as { code?: unknown };

        if (shouldResolveAlert(data.code, contractorData)) {
          batch.update(doc.ref, {
            resolved: true,
            resolvedAt: new Date(),
          });
          resolvedCount += 1;
        }
      }

      for (const alert of newAlerts) {
        const alertRef = db.collection("automationAlerts").doc();
        batch.set(alertRef, {
          contractorId,
          type: alert.type,
          code: alert.code,
          message: alert.message,
          createdAt: new Date(),
          resolved: false,
          resolvedAt: null,
        });
        await logActivity({
          contractorId,
          action: `Alert triggered: ${alert.message}`,
          performedBy: "system",
        });

        if (alert.type === "CRITICAL") {
          const contractorPhone =
            typeof contractorRecord?.phone === "string" && contractorRecord.phone.trim().length > 0
              ? contractorRecord.phone.trim()
              : null;

          if (contractorPhone) {
            try {
              const contractorDisplayName =
                typeof contractorRecord?.name === "string" && contractorRecord.name.trim().length > 0
                  ? contractorRecord.name.trim()
                  : "Contractor";
              const formattedMessage = `
Torque Empire Alert

${contractorDisplayName}: ${alert.message}

Please log in to your dashboard and resolve this issue immediately.

- Torque Empire AI System
`;
              await sendWhatsAppMessage(contractorPhone, formattedMessage);
            } catch (error) {
              console.error("WhatsApp alert dispatch failed:", error);
            }
          }
        }
      }

      await batch.commit();
    }

    const savedDocument = await documentRef.get();

    return NextResponse.json(
      {
        success: true,
        contractorId,
        documentId: savedDocument.id,
        documentType,
        analysisQueued: true,
        document: {
          id: savedDocument.id,
          ...(savedDocument.data() ?? {}),
        },
        compliance: {
          complianceScore: intelligenceSummary.complianceScore,
          complianceCompleted: intelligenceSummary.complianceCompleted,
          complianceMissing: intelligenceSummary.complianceMissing,
          complianceStatus: intelligenceSummary.complianceStatus,
        },
        readiness: {
          documentQualityScore: intelligenceSummary.documentQualityScore,
          readinessScore: intelligenceSummary.readinessScore,
          readinessStatus: intelligenceSummary.readinessStatus,
        },
        alerts,
        resolvedAlerts: resolvedCount,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Upload failed:", error);
    return jsonError(error instanceof Error ? error.message : "Upload failed", 500);
  }
}
