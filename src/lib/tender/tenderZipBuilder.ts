// src/lib/tender/tenderZipBuilder.ts

import JSZip from "jszip";
import type { TenderExportModel } from "./tenderExportModel";

/**
 * Build ZIP file in-memory from tender export model
 * Browser-safe, type-safe
 */
export async function buildTenderZip(
  model: TenderExportModel
): Promise<Blob> {
  const zip = new JSZip();

  // Root folder
  const rootName = sanitize(model.tenderTitle || "tender");
  const root = zip.folder(rootName);
  if (!root) {
    throw new Error("Failed to create ZIP root folder");
  }

  // README
 root.file(
  "README.txt",
  model.tenderTitle || "Tender export"
);

  // Documents
  const docsFolder = root.folder("documents");
  if (docsFolder && Array.isArray(model.documents)) {
    for (const doc of model.documents) {
      if (!doc?.name || !doc.content) continue;

      docsFolder.file(
        sanitize(doc.name),
        doc.content
      );
    }
  }

  // Metadata
  root.file(
    "metadata.json",
    JSON.stringify(model.metadata ?? {}, null, 2)
  );

  // Generate ZIP
  const data = await zip.generateAsync({
    type: "uint8array",
  });

  // Force real ArrayBuffer (Blob-safe)
  const buffer = new Uint8Array(data.byteLength);
  buffer.set(data);

  return new Blob([buffer.buffer], {
    type: "application/zip",
  });
}

/**
 * Prevent invalid ZIP filenames
 */
function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*]+/g, "_");
}

