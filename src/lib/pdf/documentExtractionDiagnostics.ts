import { getFirebaseAdmin } from "@/lib/firebase/admin";

const DIAGNOSTIC_WRITE_TIMEOUT_MS = 5000;

export type DocumentExtractionDiagnosticUpdate = {
  diagnosticId?: string;
  contractorId?: string | null;
  documentType?: string | null;
  storagePath?: string | null;
  fileName?: string | null;
  pageCount?: number | null;
  pdfTextLength?: number | null;
  ocrAttempted?: boolean | null;
  ocrStarted?: boolean | null;
  ocrCompleted?: boolean | null;
  ocrTextLength?: number | null;
  renderSuccess?: boolean | null;
  renderFailureReason?: string | null;
  ocrFailureReason?: string | null;
  finalExtractionSource?: string | null;
  step?: string;
  enteredAt?: string;
  exitedAt?: string;
  success?: boolean | null;
  errorMessage?: string | null;
  timingMs?: number;
  metadata?: Record<string, unknown>;
};

function cleanPayload(update: DocumentExtractionDiagnosticUpdate) {
  return Object.fromEntries(
    Object.entries(update).filter(([, value]) => value !== undefined)
  );
}

export async function recordDocumentExtractionDiagnostic(
  update: DocumentExtractionDiagnosticUpdate
): Promise<string | null> {
  try {
    const db = getFirebaseAdmin();
    const collection = db.collection("documentExtractionDiagnostics");
    const now = new Date();
    const payload = {
      ...cleanPayload(update),
      updatedAt: now,
    };

    if (update.diagnosticId) {
      await Promise.race([
        collection.doc(update.diagnosticId).set(payload, { merge: true }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("diagnostic_write_timeout")), DIAGNOSTIC_WRITE_TIMEOUT_MS)
        ),
      ]);
      return update.diagnosticId;
    }

    const ref = await Promise.race([
      collection.add({
        ...payload,
        createdAt: now,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("diagnostic_write_timeout")), DIAGNOSTIC_WRITE_TIMEOUT_MS)
      ),
    ]);
    return ref.id;
  } catch (error) {
    console.warn("[DOCUMENT_EXTRACTION_DIAGNOSTIC_WRITE_FAILED]", {
      step: update.step ?? null,
      fileName: update.fileName ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
    return update.diagnosticId ?? null;
  }
}

export async function recordExtractionStep<T>(
  diagnostic: DocumentExtractionDiagnosticUpdate,
  step: string,
  action: () => Promise<T>
): Promise<T> {
  const enteredAt = new Date().toISOString();
  const startedAt = Date.now();

  console.log("[DOCUMENT_EXTRACTION_STEP_ENTER]", {
    step,
    fileName: diagnostic.fileName ?? null,
    contractorId: diagnostic.contractorId ?? null,
    documentType: diagnostic.documentType ?? null,
  });

  await recordDocumentExtractionDiagnostic({
    ...diagnostic,
    step,
    enteredAt,
    success: null,
  });

  try {
    const result = await action();
    const timingMs = Date.now() - startedAt;

    console.log("[DOCUMENT_EXTRACTION_STEP_EXIT]", {
      step,
      fileName: diagnostic.fileName ?? null,
      success: true,
      timingMs,
    });

    await recordDocumentExtractionDiagnostic({
      ...diagnostic,
      step,
      enteredAt,
      exitedAt: new Date().toISOString(),
      success: true,
      errorMessage: null,
      timingMs,
    });

    return result;
  } catch (error) {
    const timingMs = Date.now() - startedAt;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error("[DOCUMENT_EXTRACTION_STEP_FAILURE]", {
      step,
      fileName: diagnostic.fileName ?? null,
      success: false,
      timingMs,
      error: errorMessage,
    });

    await recordDocumentExtractionDiagnostic({
      ...diagnostic,
      step,
      enteredAt,
      exitedAt: new Date().toISOString(),
      success: false,
      errorMessage,
      timingMs,
    });

    throw error;
  }
}
