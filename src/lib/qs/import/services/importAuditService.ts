import { QS_COLLECTIONS } from "@/lib/qs/collections";
import { createQsRecord, listQsRecords } from "@/lib/qs/firestore";
import type { QsCreateInput, QsFailedImport, QsImportLog, QsMaterialImport } from "@/types/qs";

export function createMaterialImportRecord(payload: QsCreateInput<QsMaterialImport>) {
  return createQsRecord<QsMaterialImport>(QS_COLLECTIONS.materialImports, "materialImportId", payload);
}

export function listMaterialImports(limit?: number) {
  return listQsRecords<QsMaterialImport>(QS_COLLECTIONS.materialImports, { limit });
}

export function createImportLog(payload: QsCreateInput<QsImportLog>) {
  return createQsRecord<QsImportLog>(QS_COLLECTIONS.importLogs, "importLogId", payload);
}

export function listImportLogs(limit?: number) {
  return listQsRecords<QsImportLog>(QS_COLLECTIONS.importLogs, { limit });
}

export function createFailedImport(payload: QsCreateInput<QsFailedImport>) {
  return createQsRecord<QsFailedImport>(QS_COLLECTIONS.failedImports, "failedImportId", payload);
}

export function listFailedImports(limit?: number) {
  return listQsRecords<QsFailedImport>(QS_COLLECTIONS.failedImports, { limit });
}
