import type { QsImportParser, QsParseResult } from "./types";

export const jsonImportParser: QsImportParser = {
  async parse(buffer: Buffer): Promise<QsParseResult> {
    const parsed = JSON.parse(buffer.toString("utf8")) as unknown;
    const rowsInput = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { rows?: unknown }).rows)
        ? (parsed as { rows: unknown[] }).rows
        : [];

    const rowsAsRecords = rowsInput.filter(
      (row): row is Record<string, unknown> => Boolean(row && typeof row === "object" && !Array.isArray(row)),
    );
    const columns = Array.from(new Set(rowsAsRecords.flatMap((row) => Object.keys(row))));

    return {
      fileType: "json",
      columns,
      rows: rowsAsRecords.map((row, index) => ({
        rowNumber: index + 1,
        raw: Object.fromEntries(columns.map((column) => [column, String(row[column] ?? "")])),
      })),
    };
  },
};
