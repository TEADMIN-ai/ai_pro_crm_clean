import crypto from "node:crypto";

import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";
import {
  type VehicleFinanceTrainingCategory,
  type VehicleFinanceTrainingDocument,
  VEHICLE_FINANCE_TRAINING_DOCUMENT_COLLECTION,
  VEHICLE_FINANCE_TRAINING_STORAGE_ROOT,
} from "./types";
import { getVehicleFinanceTrainingTemplate } from "./datasets";
import {
  getVehicleFinanceTrainingOverview,
  listVehicleFinanceTrainingDocuments,
  listVehicleFinanceTrainingResults,
  runVehicleFinanceTrainingValidation,
  runVehicleFinanceTrainingValidationForDocument,
} from "./validation";

function sanitizeFileName(fileName: string): string {
  return fileName
    .trim()
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

type ActorContext = {
  actorId?: string;
  actorRole?: string;
  actorName?: string;
};

export function getVehicleFinanceTrainingUploadPath(category: VehicleFinanceTrainingCategory, fileName: string) {
  const template = getVehicleFinanceTrainingTemplate(category);
  const safeFileName = sanitizeFileName(fileName) || "document.pdf";
  const documentId = crypto.randomUUID();
  return {
    documentId,
    storagePath: `${VEHICLE_FINANCE_TRAINING_STORAGE_ROOT}/${template.storageFolder}/${documentId}_${safeFileName}`,
  };
}

export async function uploadVehicleFinanceTrainingDocument(args: {
  category: VehicleFinanceTrainingCategory;
  filename: string;
  fileBuffer: Buffer;
}, actor: ActorContext): Promise<VehicleFinanceTrainingDocument> {
  const { documentId, storagePath } = getVehicleFinanceTrainingUploadPath(args.category, args.filename);
  const bucket = getFirebaseStorageBucket();
  const file = bucket.file(storagePath);

  await file.save(args.fileBuffer, {
    contentType: "application/pdf",
    resumable: false,
    metadata: {
      cacheControl: "private, max-age=0, no-transform",
    },
  });

  const createdAt = new Date().toISOString();
  const record: VehicleFinanceTrainingDocument = {
    documentId,
    category: args.category,
    filename: args.filename,
    storagePath,
    uploadedBy: actor.actorName ?? actor.actorId ?? "system",
    uploadedAt: createdAt,
    status: "UPLOADED",
  };

  await getFirebaseAdmin()
    .collection(VEHICLE_FINANCE_TRAINING_DOCUMENT_COLLECTION)
    .doc(documentId)
    .set(record);

  return record;
}

export {
  getVehicleFinanceTrainingOverview,
  listVehicleFinanceTrainingDocuments,
  listVehicleFinanceTrainingResults,
  runVehicleFinanceTrainingValidation,
  runVehicleFinanceTrainingValidationForDocument,
};
