import type { PdfReferenceStatus, PdfValidationIssue, PdfValidationReport } from "./types";
import { buildValidationReport } from "./validationReport";

export type ReferenceLibraryAssetKind = "blank_pdf" | "approved_completed_pdf" | "field_mapping_note";

export type ReferenceLibraryDocumentMetadata = {
  documentName: string;
  version: string;
  municipality?: string;
  department?: string;
  revision?: string;
  approvalDate?: string;
  referenceStatus: PdfReferenceStatus;
};

export type ReferenceLibraryAssetDescriptor = ReferenceLibraryDocumentMetadata & {
  kind: ReferenceLibraryAssetKind;
  relativePath: string;
  checksum?: string;
  capturedAt?: string;
};

export type ReferenceLibraryDocumentRecord = ReferenceLibraryDocumentMetadata & {
  assets: ReferenceLibraryAssetDescriptor[];
  createdAt?: string;
  updatedAt?: string;
};

export type ReferenceLibraryRegistry = {
  schemaVersion: string;
  records: ReferenceLibraryDocumentRecord[];
};

export type ReferenceLibraryRegistryLoader = {
  load(): Promise<ReferenceLibraryRegistry>;
};

export type ReferenceLibraryValidationHook = {
  name: string;
  validate(record: ReferenceLibraryDocumentRecord): PdfValidationIssue[];
};

function registryKey(metadata: Pick<ReferenceLibraryDocumentMetadata, "documentName" | "version" | "municipality" | "department">): string {
  return [metadata.documentName, metadata.version, metadata.municipality ?? "", metadata.department ?? ""].join("::");
}

export class StaticReferenceLibraryRegistryLoader implements ReferenceLibraryRegistryLoader {
  constructor(private readonly registry: ReferenceLibraryRegistry) {}

  async load(): Promise<ReferenceLibraryRegistry> {
    return this.registry;
  }
}

export class ReferenceLibraryVersionTracker {
  constructor(private readonly records: ReferenceLibraryDocumentRecord[]) {}

  versionsFor(documentName: string): ReferenceLibraryDocumentRecord[] {
    return this.records
      .filter((record) => record.documentName === documentName)
      .sort((a, b) => a.version.localeCompare(b.version));
  }

  latestVersion(documentName: string): ReferenceLibraryDocumentRecord | null {
    return this.versionsFor(documentName).at(-1) ?? null;
  }
}

export class ReferenceLibraryManager {
  private readonly records = new Map<string, ReferenceLibraryDocumentRecord>();

  constructor(records: ReferenceLibraryDocumentRecord[] = []) {
    records.forEach((record) => this.upsert(record));
  }

  static async fromLoader(loader: ReferenceLibraryRegistryLoader): Promise<ReferenceLibraryManager> {
    const registry = await loader.load();
    return new ReferenceLibraryManager(registry.records);
  }

  upsert(record: ReferenceLibraryDocumentRecord): ReferenceLibraryDocumentRecord {
    this.records.set(registryKey(record), record);
    return record;
  }

  get(metadata: Pick<ReferenceLibraryDocumentMetadata, "documentName" | "version" | "municipality" | "department">): ReferenceLibraryDocumentRecord | null {
    return this.records.get(registryKey(metadata)) ?? null;
  }

  list(): ReferenceLibraryDocumentRecord[] {
    return Array.from(this.records.values());
  }

  assetsFor(metadata: Pick<ReferenceLibraryDocumentMetadata, "documentName" | "version" | "municipality" | "department">): ReferenceLibraryAssetDescriptor[] {
    return this.get(metadata)?.assets ?? [];
  }

  versionTracker(): ReferenceLibraryVersionTracker {
    return new ReferenceLibraryVersionTracker(this.list());
  }

  toRegistry(schemaVersion = "1.0.0"): ReferenceLibraryRegistry {
    return {
      schemaVersion,
      records: this.list(),
    };
  }
}

export function createReferenceLibraryAsset(params: ReferenceLibraryAssetDescriptor): ReferenceLibraryAssetDescriptor {
  return params;
}

export const requiredReferenceAssetHook: ReferenceLibraryValidationHook = {
  name: "required_reference_assets",
  validate(record) {
    const issues: PdfValidationIssue[] = [];
    const hasBlank = record.assets.some((asset) => asset.kind === "blank_pdf");
    const hasApproved = record.assets.some((asset) => asset.kind === "approved_completed_pdf");
    const hasNotes = record.assets.some((asset) => asset.kind === "field_mapping_note");

    if (!hasBlank) {
      issues.push({
        code: "missing_mandatory_value",
        severity: "warning",
        message: `Blank PDF missing for ${record.documentName} ${record.version}`,
        confidenceImpact: 0.08,
      });
    }

    if (!hasApproved) {
      issues.push({
        code: "missing_mandatory_value",
        severity: "warning",
        message: `Approved completed PDF missing for ${record.documentName} ${record.version}`,
        confidenceImpact: 0.12,
      });
    }

    if (!hasNotes) {
      issues.push({
        code: "missing_mandatory_value",
        severity: "info",
        message: `Field mapping notes missing for ${record.documentName} ${record.version}`,
        confidenceImpact: 0.02,
      });
    }

    return issues;
  },
};

export function validateReferenceLibraryRecord(
  record: ReferenceLibraryDocumentRecord,
  hooks: ReferenceLibraryValidationHook[] = [requiredReferenceAssetHook]
): PdfValidationReport {
  const issues = hooks.flatMap((hook) => hook.validate(record));
  const confidenceScore = Math.max(0, 1 - issues.reduce((sum, issue) => sum + issue.confidenceImpact, 0));

  return buildValidationReport({
    documentName: record.documentName,
    documentVersion: record.version,
    issues,
    confidenceScore,
  });
}
