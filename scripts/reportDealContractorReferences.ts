import { loadEnvConfig } from "@next/env";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { resolveContractorReference } from "@/lib/contractors/contractorReferenceResolver";

loadEnvConfig(process.cwd());

type Bucket =
  | "validCanonicalReferences"
  | "legacyUidReferences"
  | "missingContractorReferences"
  | "ambiguousReferences"
  | "crossWorkspaceReferences"
  | "orphanedDealReferences";

interface ReportEntry {
  dealId: string;
  title: string | null;
  storedContractorReference: string | null;
  result: string;
  resolvedContractorId?: string | null;
  referenceType?: string | null;
  failureReason?: string | null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function classify(entry: ReportEntry): Bucket {
  if (!entry.storedContractorReference) {
    return "missingContractorReferences";
  }

  if (entry.result === "resolved" && entry.referenceType === "firestore_document_id") {
    return "validCanonicalReferences";
  }

  if (entry.result === "resolved" && (entry.referenceType === "uid_field" || entry.referenceType === "authUid_field" || entry.referenceType === "userId_field")) {
    return "legacyUidReferences";
  }

  if (entry.failureReason === "ambiguous_reference") {
    return "ambiguousReferences";
  }

  if (entry.failureReason === "cross_workspace") {
    return "crossWorkspaceReferences";
  }

  return "orphanedDealReferences";
}

async function main() {
  const snapshot = await getFirebaseAdmin().collection("deals").get();
  const buckets: Record<Bucket, ReportEntry[]> = {
    validCanonicalReferences: [],
    legacyUidReferences: [],
    missingContractorReferences: [],
    ambiguousReferences: [],
    crossWorkspaceReferences: [],
    orphanedDealReferences: [],
  };

  for (const doc of snapshot.docs) {
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    const storedContractorReference = asString(data.contractorId)
      ?? asString(data.contractorUid)
      ?? asString(data.contractorUserId)
      ?? asString(data.linkedContractorId)
      ?? null;

    const title = asString(data.title) ?? asString(data.name);

    if (!storedContractorReference) {
      const entry: ReportEntry = {
        dealId: doc.id,
        title,
        storedContractorReference: null,
        result: "missing",
        failureReason: "missing_reference",
      };
      buckets[classify(entry)].push(entry);
      continue;
    }

    const resolution = await resolveContractorReference({
      reference: storedContractorReference,
      expectedWorkspaceId: asString(data.workspaceId),
      dealId: doc.id,
      logContext: "scripts.reportDealContractorReferences",
    });

    const entry: ReportEntry = resolution.ok === true
      ? {
          dealId: doc.id,
          title,
          storedContractorReference,
          result: "resolved",
          resolvedContractorId: resolution.contractorId,
          referenceType: resolution.referenceType,
        }
      : {
          dealId: doc.id,
          title,
          storedContractorReference,
          result: "unresolved",
          referenceType: resolution.referenceType,
          failureReason: resolution.failureReason,
        };

    buckets[classify(entry)].push(entry);
  }

  const summary = Object.fromEntries(
    Object.entries(buckets).map(([key, entries]) => [key, entries.length]),
  );

  console.log(JSON.stringify({ summary, buckets }, null, 2));
}

main().catch((error) => {
  console.error("reportDealContractorReferences failed", error);
  process.exitCode = 1;
});
