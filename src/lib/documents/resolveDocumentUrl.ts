import { getFirebaseAdmin, getFirebaseStorageBucket } from "@/lib/firebase/admin";

type DocumentMetadata = Record<string, unknown>;

export type ResolvedDocumentUrl = {
  url: string;
  fileName: string;
  isPreviewable: boolean;
  extension: string;
};

const PREVIEWABLE_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png"]);

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getFileNameFromPath(pathValue: string): string {
  const normalized = pathValue.split("?")[0];
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? "document";
}

function getExtension(fileName: string): string {
  const cleanName = fileName.split("?")[0];
  const dotIndex = cleanName.lastIndexOf(".");
  if (dotIndex < 0 || dotIndex === cleanName.length - 1) {
    return "";
  }

  return cleanName.slice(dotIndex + 1).toLowerCase();
}

async function resolveFromStoragePath(storagePath: string): Promise<string> {
  getFirebaseAdmin();
  const bucket = getFirebaseStorageBucket();
  const [signedUrl] = await bucket.file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 1000 * 60 * 60 * 24,
  });

  return signedUrl;
}

export async function resolveDocumentUrl(metadata: DocumentMetadata): Promise<ResolvedDocumentUrl> {
  const directUrl =
    asString(metadata.downloadURL) ??
    asString(metadata.downloadUrl) ??
    asString(metadata.url);

  const storagePath = asString(metadata.storagePath);

  let url = directUrl;
  if (!url && storagePath) {
    url = await resolveFromStoragePath(storagePath);
  }

  if (!url) {
    throw new Error("Document URL could not be resolved");
  }

  const fileName =
    asString(metadata.fileName) ??
    asString(metadata.filename) ??
    asString(metadata.originalName) ??
    (storagePath ? getFileNameFromPath(storagePath) : getFileNameFromPath(url));

  const extension = getExtension(fileName);

  return {
    url,
    fileName,
    extension,
    isPreviewable: PREVIEWABLE_EXTENSIONS.has(extension),
  };
}
