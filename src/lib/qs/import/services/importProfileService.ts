import { QS_COLLECTIONS } from "@/lib/qs/collections";
import { createQsRecord, deleteQsRecord, getQsRecord, listQsRecords, updateQsRecord } from "@/lib/qs/firestore";
import type { QsCreateInput, QsImportProfile, QsUpdateInput } from "@/types/qs";

export function listImportProfiles(limit?: number) {
  return listQsRecords<QsImportProfile>(QS_COLLECTIONS.importProfiles, { limit });
}

export function getImportProfile(importProfileId: string) {
  return getQsRecord<QsImportProfile>(QS_COLLECTIONS.importProfiles, importProfileId);
}

export function createImportProfile(payload: QsCreateInput<QsImportProfile>) {
  return createQsRecord<QsImportProfile>(QS_COLLECTIONS.importProfiles, "importProfileId", payload);
}

export function updateImportProfile(importProfileId: string, updates: QsUpdateInput<QsImportProfile>) {
  return updateQsRecord<QsImportProfile>(QS_COLLECTIONS.importProfiles, importProfileId, updates);
}

export function deleteImportProfile(importProfileId: string) {
  return deleteQsRecord(QS_COLLECTIONS.importProfiles, importProfileId);
}
