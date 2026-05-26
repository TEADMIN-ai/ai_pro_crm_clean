import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { ManusContext, ToolExecutionResult } from "@/lib/manus/types/manus.types";
import { BaseTool } from "@/lib/manus/tools/baseTool";
import { assertContractorIsolation, assertToolAccess } from "@/lib/manus/utils/permissionGuard";
import { safeFirestoreQuery } from "@/lib/server/safeFirestore";

type FirestoreReadInput = {
  mode: "read";
  collection: string;
  docId: string;
  contractorId?: string;
};

type FirestoreWriteInput = {
  mode: "write";
  collection: string;
  docId: string;
  contractorId?: string;
  data: Record<string, unknown>;
};

type FirestoreToolInput = FirestoreReadInput | FirestoreWriteInput;

const ALLOWED_COLLECTIONS = new Set([
  "contractors",
  "deals",
  "documents",
  "tenders",
  "manusWorkflows",
  "manusWorkflowAudit",
  "contractorActivity",
]);

export class FirestoreTool extends BaseTool<FirestoreToolInput, Record<string, unknown>> {
  readonly name = "firestoreTool";

  validate(input: FirestoreToolInput, _context: ManusContext) {
    if (!ALLOWED_COLLECTIONS.has(input.collection)) {
      throw new Error(`Collection '${input.collection}' is not approved for Manus access`);
    }

    if (!input.docId.trim()) {
      throw new Error("docId is required");
    }

    if (input.mode === "write" && (!input.data || typeof input.data !== "object")) {
      throw new Error("Write operations require a data payload");
    }
  }

  permissions(context: ManusContext) {
    assertToolAccess(context, this.name);
  }

  async execute(input: FirestoreToolInput, context: ManusContext): Promise<ToolExecutionResult<Record<string, unknown>>> {
    this.validate(input, context);
    this.permissions(context);
    assertContractorIsolation(context, input.contractorId ?? context.contractorId);

    const db = getFirebaseAdmin();

    if (input.mode === "read") {
      const snapshot = await safeFirestoreQuery(() => db.collection(input.collection).doc(input.docId).get());
      return {
        ok: true,
        toolName: this.name,
        data: {
          exists: snapshot.exists,
          id: snapshot.id,
          ...(snapshot.data() ?? {}),
        },
        warnings: [],
        audit: { mode: input.mode, collection: input.collection, docId: input.docId },
      };
    }

    if (context.actor.role === "contractor" && input.collection !== "manusWorkflows") {
      throw new Error("Contractor writes are limited to workflow state only");
    }

    if (!context.dryRun) {
      await safeFirestoreQuery(() =>
        db.collection(input.collection).doc(input.docId).set(
          {
            ...input.data,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        )
      );
    }

    return {
      ok: true,
      toolName: this.name,
      data: {
        collection: input.collection,
        docId: input.docId,
      },
      warnings: context.dryRun ? ["Dry run enabled: write skipped"] : [],
      audit: { mode: input.mode, collection: input.collection, docId: input.docId },
      rollbackToken: `${input.collection}:${input.docId}`,
    };
  }
}
