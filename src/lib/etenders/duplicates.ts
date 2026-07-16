import type { EtendersDuplicateCheckResult, EtendersSourceRecord } from "@/lib/etenders/types";

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeUrl(value: string | null | undefined): string {
  try {
    const url = new URL(value ?? "");
    url.hash = "";
    url.searchParams.sort();
    return url.toString().toLowerCase();
  } catch {
    return normalize(value);
  }
}

export function detectEtendersDuplicate(
  incoming: EtendersSourceRecord,
  existingRecords: Array<Record<string, unknown> & { id?: string }>,
): EtendersDuplicateCheckResult {
  for (const record of existingRecords) {
    const source = record.etendersSource && typeof record.etendersSource === "object"
      ? (record.etendersSource as Partial<EtendersSourceRecord>)
      : {};

    if (source.sourceSystem === incoming.sourceSystem && source.sourceOpportunityId === incoming.sourceOpportunityId) {
      return { duplicate: true, reason: "source_id", existingId: record.id };
    }

    const tenderNumber = normalize((record.tenderNumber as string | undefined) ?? source.tenderNumber);
    const issuer = normalize((record.issuingAuthority as string | undefined) ?? source.organOfState ?? source.department);
    if (tenderNumber && tenderNumber === normalize(incoming.tenderNumber) && issuer === normalize(incoming.organOfState ?? incoming.department)) {
      return { duplicate: true, reason: "tender_issuer", existingId: record.id };
    }

    if (normalizeUrl((record.sourceUrl as string | undefined) ?? source.sourceUrl) === normalizeUrl(incoming.sourceUrl)) {
      return { duplicate: true, reason: "source_url", existingId: record.id };
    }

    if (source.sourceFingerprint && source.sourceFingerprint === incoming.sourceFingerprint) {
      return { duplicate: true, reason: "fingerprint", existingId: record.id };
    }
  }

  return { duplicate: false, reason: null };
}

