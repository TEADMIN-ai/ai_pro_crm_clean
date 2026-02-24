const RECOVERED_PLACEHOLDER = "Recovered document";

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractFromPathLike(value: string): string | null {
  const normalized = value.replace(/\\/g, "/").trim();
  if (!normalized) return null;

  const withoutQuery = normalized.split("?")[0]?.split("#")[0] ?? "";
  const segment = withoutQuery.substring(withoutQuery.lastIndexOf("/") + 1).trim();
  if (!segment) return null;

  const decoded = safeDecodeURIComponent(segment);
  if (!decoded) return null;

  if (decoded.includes("/")) {
    const nested = decoded.substring(decoded.lastIndexOf("/") + 1).trim();
    return nested || null;
  }

  return decoded;
}

export function extractFileNameFromStoragePath(value: unknown): string | null {
  const path = asNonEmptyString(value);
  if (!path) return null;
  return extractFromPathLike(path);
}

export function extractFileNameFromUrl(value: unknown): string | null {
  const urlValue = asNonEmptyString(value);
  if (!urlValue) return null;

  const paramMatch = /(?:^|[?&])(name|filename)=([^&]+)/i.exec(urlValue);
  if (paramMatch?.[2]) {
    const fromParam = extractFromPathLike(safeDecodeURIComponent(paramMatch[2]));
    if (fromParam) return fromParam;
  }

  try {
    const parsed = new URL(urlValue);
    const fromNameParam = parsed.searchParams.get("name") ?? parsed.searchParams.get("filename");
    if (fromNameParam) {
      const fromParam = extractFromPathLike(fromNameParam);
      if (fromParam) return fromParam;
    }

    const pathSegment = parsed.pathname.substring(parsed.pathname.lastIndexOf("/") + 1);
    const fromPath = extractFromPathLike(pathSegment);
    if (fromPath) return fromPath;
  } catch {
    const fallback = extractFromPathLike(urlValue);
    if (fallback) return fallback;
  }

  return null;
}

export function resolveDocumentFileName(
  data: Record<string, unknown>,
  fallback: string = RECOVERED_PLACEHOLDER
): string {
  const rawFileName = asNonEmptyString(data.fileName);
  if (rawFileName && rawFileName !== RECOVERED_PLACEHOLDER) return rawFileName;

  const directCandidates = [
    data.originalName,
    data.filename,
    data.name,
    data.title,
  ];

  for (const candidate of directCandidates) {
    const value = asNonEmptyString(candidate);
    if (value) return value;
  }

  const pathCandidates = [data.storagePath, data.filePath];
  for (const candidate of pathCandidates) {
    const value = extractFileNameFromStoragePath(candidate);
    if (value) return value;
  }

  const urlCandidates = [data.url, data.downloadUrl, data.downloadURL];
  for (const candidate of urlCandidates) {
    const value = extractFileNameFromUrl(candidate);
    if (value) return value;
  }

  return fallback;
}

export function normalizeCreatedAt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    const maybeMillis = (value as { toMillis: () => number }).toMillis();
    if (Number.isFinite(maybeMillis)) {
      return maybeMillis;
    }
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "_seconds" in value &&
    typeof (value as { _seconds?: unknown })._seconds === "number"
  ) {
    const seconds = (value as { _seconds: number })._seconds;
    return seconds * 1000;
  }

  return Date.now();
}

export function detectDocTypeFromFileName(fileName: string | null | undefined): string {
  const value = (fileName ?? "").toLowerCase().trim();
  const extension = value.includes(".") ? value.split(".").pop() ?? "" : "";

  if (extension === "pdf") return "certificate";
  if (extension === "csv" || extension === "xls" || extension === "xlsx") return "tax";
  if (extension === "jpg" || extension === "jpeg" || extension === "png" || extension === "webp") {
    return "identity";
  }
  if (extension === "doc" || extension === "docx") return "general";

  return "general";
}

export function getString(value: unknown): string | null {
  return asNonEmptyString(value);
}

export const RECOVERED_DOCUMENT_PLACEHOLDER = RECOVERED_PLACEHOLDER;
