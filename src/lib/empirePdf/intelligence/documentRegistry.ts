import type {
  PdfDocumentRegistry,
  PdfDocumentRegistryRecord,
  PdfDocumentReadiness,
} from "./types";

function registryKey(record: Pick<PdfDocumentRegistryRecord, "documentName" | "version" | "municipality">): string {
  return [record.documentName, record.version, record.municipality ?? ""].join("::");
}

export class InMemoryDocumentRegistry {
  private readonly records = new Map<string, PdfDocumentRegistryRecord>();

  constructor(initialRecords: PdfDocumentRegistryRecord[] = []) {
    initialRecords.forEach((record) => this.upsert(record));
  }

  upsert(record: PdfDocumentRegistryRecord): PdfDocumentRegistryRecord {
    this.records.set(registryKey(record), record);
    return record;
  }

  get(params: Pick<PdfDocumentRegistryRecord, "documentName" | "version" | "municipality">): PdfDocumentRegistryRecord | null {
    return this.records.get(registryKey(params)) ?? null;
  }

  updateReadiness(
    params: Pick<PdfDocumentRegistryRecord, "documentName" | "version" | "municipality">,
    readiness: PdfDocumentReadiness,
    confidenceScore?: number
  ): PdfDocumentRegistryRecord | null {
    const existing = this.get(params);
    if (!existing) {
      return null;
    }

    const updated = {
      ...existing,
      readiness,
      confidenceScore: confidenceScore ?? existing.confidenceScore,
    };
    this.upsert(updated);
    return updated;
  }

  toJSON(): PdfDocumentRegistry {
    return {
      records: Array.from(this.records.values()),
    };
  }
}
