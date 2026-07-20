import { loadEnvConfig } from "@next/env";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  classifyContractorRecord,
  getContractorRecordWorkspaceId,
  type ContractorRecordClassification,
} from "@/lib/contractors/contractorVisibility";

loadEnvConfig(process.cwd());

type Counts = Record<ContractorRecordClassification, number>;

function emptyCounts(): Counts {
  return {
    PRODUCTION: 0,
    QA: 0,
    TEST: 0,
    DEMO: 0,
    BENCHMARK: 0,
    ARCHIVED: 0,
    LEGACY_UNASSIGNED: 0,
  };
}

async function main() {
  const snapshot = await getFirebaseAdmin().collection("contractors").get();
  const classificationCounts = emptyCounts();
  const productionByWorkspace: Record<string, number> = {};

  for (const doc of snapshot.docs) {
    const record = { id: doc.id, ...(doc.data() ?? {}) } as Record<string, unknown>;
    const classification = classifyContractorRecord(record);
    classificationCounts[classification] += 1;

    if (classification === "PRODUCTION") {
      const workspaceId = getContractorRecordWorkspaceId(record) ?? "LEGACY_UNASSIGNED";
      productionByWorkspace[workspaceId] = (productionByWorkspace[workspaceId] ?? 0) + 1;
    }
  }

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: "contractors",
    totalRecords: snapshot.size,
    productionByWorkspace,
    classificationCounts,
    notes: [
      "Read-only aggregate diagnostic.",
      "No contractor names, IDs, emails, documents, or storage paths are emitted.",
      "No Firestore records are modified or deleted.",
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error("[contractor-visibility-diagnostics] failed", error);
  process.exit(1);
});
