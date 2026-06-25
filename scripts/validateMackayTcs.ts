import fs from "node:fs";
import path from "node:path";

type LogEntry = {
  level: "log" | "warn" | "error";
  tag: string | null;
  payload: unknown;
};

type ContractorCandidate = {
  id: string;
  data: Record<string, unknown>;
};

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function includesMackay(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.toLowerCase();
  return normalized.includes("mackay") || normalized.includes("daughters");
}

function normalizeStoragePath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("gs://")) {
    const withoutScheme = trimmed.slice("gs://".length);
    const slashIndex = withoutScheme.indexOf("/");
    return slashIndex >= 0 ? withoutScheme.slice(slashIndex + 1) : null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      const encodedPath = parsed.pathname.split("/o/")[1];
      return encodedPath ? decodeURIComponent(encodedPath).trim() : null;
    } catch {
      return null;
    }
  }

  return trimmed.replace(/^\/+/, "");
}

function getDocumentStoragePath(data: Record<string, unknown>): string | null {
  const raw =
    asString(data.storagePath) ??
    asString(data.filePath) ??
    asString(data.downloadURL) ??
    asString(data.downloadUrl) ??
    asString(data.fileUrl) ??
    asString(data.url);

  return raw ? normalizeStoragePath(raw) : null;
}

function getSearchText(data: Record<string, unknown>) {
  return [
    data.companyName,
    data.name,
    data.company,
    data.registeredCompanyName,
    data.tradingName,
    data.email,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

function captureLogs(logs: LogEntry[]) {
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  const capture = (level: LogEntry["level"]) => (...args: unknown[]) => {
    const tag = typeof args[0] === "string" && /^\[[^\]]+\]/.test(args[0])
      ? args[0]
      : null;
    logs.push({
      level,
      tag,
      payload: args.length === 2 ? args[1] : args,
    });
    original[level](...args);
  };

  console.log = capture("log");
  console.warn = capture("warn");
  console.error = capture("error");

  return () => {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  };
}

function findLastLog(logs: LogEntry[], tag: string) {
  return [...logs].reverse().find((entry) => entry.tag === tag)?.payload ?? null;
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  const { getFirebaseAdmin, getFirebaseStorageBucket } = await import("../src/lib/firebase/admin");
  const { verifyStoredContractorDocument } = await import("../src/server/services/documentVerificationService");

  const db = getFirebaseAdmin();
  const contractorsSnapshot = await db.collection("contractors").get();
  const candidates: ContractorCandidate[] = contractorsSnapshot.docs
    .map((doc) => ({ id: doc.id, data: (doc.data() ?? {}) as Record<string, unknown> }))
    .filter((candidate) => includesMackay(getSearchText(candidate.data)));

  if (candidates.length === 0) {
    throw new Error("No contractor matching Mackay or Daughters found in Firestore.");
  }

  const selected = candidates[0];
  const taxDocRef = db
    .collection("contractors")
    .doc(selected.id)
    .collection("documents")
    .doc("taxClearance");
  const taxDocSnapshot = await taxDocRef.get();

  if (!taxDocSnapshot.exists) {
    throw new Error(`Mackay contractor ${selected.id} has no taxClearance document.`);
  }

  const taxDoc = (taxDocSnapshot.data() ?? {}) as Record<string, unknown>;
  const storagePath = getDocumentStoragePath(taxDoc);
  if (!storagePath) {
    throw new Error(`Mackay taxClearance document has no usable storage path.`);
  }

  const [buffer] = await getFirebaseStorageBucket().file(storagePath).download();
  const fileName = storagePath.split("/").filter(Boolean).pop() ?? "taxClearance.pdf";
  const diagnosticId = `mackay_tcs_validation_${Date.now()}`;
  const logs: LogEntry[] = [];
  const restoreLogs = captureLogs(logs);

  try {
    const result = await verifyStoredContractorDocument(Buffer.from(buffer), "taxClearance", {
      companyName: asString(selected.data.companyName) ?? asString(selected.data.name),
      registrationNumber:
        asString(selected.data.registrationNumber) ??
        asString(selected.data.companyRegistrationNumber),
      extractionDiagnostics: {
        contractorId: selected.id,
        documentType: "taxClearance",
        storagePath,
        fileName,
        diagnosticId,
      },
    });

    const evidence = {
      contractorId: selected.id,
      contractorName: asString(selected.data.companyName) ?? asString(selected.data.name),
      documentType: "taxClearance",
      storagePath,
      fileName,
      diagnosticId,
      directPdfExtraction: {
        source: result.extractionSource,
        directTextLength: result.directTextLength ?? 0,
        pageCount: result.pageCount ?? 0,
        pdfTextLengthLogs: logs
          .filter((entry) => entry.tag === "[PDF_TEXT_LENGTH]")
          .map((entry) => entry.payload),
      },
      ocrTriggerDecision: findLastLog(logs, "[OCR_TRIGGER_DECISION]"),
      ocrExecution: {
        fallback: findLastLog(logs, "[OCR_FALLBACK]"),
        execution: findLastLog(logs, "[OCR_REQUEST_SUCCESS]") ?? findLastLog(logs, "[OCR_PROVIDER_SUCCESS]") ?? findLastLog(logs, "[OCR_PROVIDER_FAILED]"),
        textLength: findLastLog(logs, "[OCR_TEXT_LENGTH]"),
      },
      extractedTextLength: result.extractedTextLength ?? 0,
      extractionSource: result.extractionSource,
      taxReferenceExtraction: {
        taxpayerReference: result.extractedFields.taxpayerReference ?? null,
        matchedLabel: result.extractedFields.taxpayerReferenceMatchedLabel ?? null,
        rawValue: result.extractedFields.taxpayerReferenceRawValue ?? null,
        rejectedReasons: result.extractedFields.taxpayerReferenceRejectedReasons ?? null,
      },
      companyNameExtraction: {
        taxpayerName: result.extractedFields.taxpayerName ?? null,
        expectedCompanyMatch: result.extractedFields.expectedCompanyMatch ?? null,
      },
      validationStatus: result.status,
      reviewReason: result.reason ?? null,
      missingFields: result.missingFields,
    };

    restoreLogs();
    console.log(JSON.stringify(evidence, null, 2));
  } catch (error) {
    restoreLogs();
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
