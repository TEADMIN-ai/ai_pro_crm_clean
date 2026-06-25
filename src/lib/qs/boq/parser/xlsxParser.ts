import { xlsxImportParser } from "@/lib/qs/import/parsers";
import type { QsBoqParsedDocument, QsBoqParserInput } from "./types";

export async function parseXlsxBoq(input: QsBoqParserInput): Promise<QsBoqParsedDocument> {
  const parsed = await xlsxImportParser.parse(input.buffer);
  const rows = parsed.rows.map((row) => parsed.columns.map((column) => row.raw[column] ?? "").join(" | "));

  return {
    fileType: "xlsx",
    parserUsed: "xlsx-sheet-parser",
    extractionSource: "spreadsheet",
    ocrUsed: false,
    text: [parsed.columns.join(" | "), ...rows].join("\n").trim(),
  };
}
