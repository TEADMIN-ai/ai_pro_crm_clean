import type { QsImportFileType } from "@/types/qs";

export function detectImportFileType(fileName: string): QsImportFileType {
  const extension = fileName.trim().toLowerCase().split(".").pop();

  if (extension === "csv") return "csv";
  if (extension === "xlsx") return "xlsx";
  if (extension === "json") return "json";

  throw new Error(`Unsupported QS import file type: ${extension ?? "unknown"}`);
}
